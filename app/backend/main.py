from contextlib import asynccontextmanager
import logging
import os
from time import monotonic

import cv2
from fastapi import FastAPI
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import TimeoutError as DatabasePoolTimeout
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config.settings import FRONTEND_ORIGINS, OPENCV_THREADS
from .routes import analyses, health, live_estimates, set_reviews
from .sessions import routes as session_routes
from .auth.routes import router as auth_router
from .services.jobs import AnalysisJobManager


@asynccontextmanager
async def lifespan(app):
    app.state.jobs = AnalysisJobManager()
    try:
        yield
    finally:
        app.state.jobs.close()


cv2.setNumThreads(OPENCV_THREADS)
app = FastAPI(title="RepLens API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
    allow_credentials=True,
)

capacity_logger = logging.getLogger("replens.capacity")


@app.middleware("http")
async def log_slow_api_requests(request, call_next):
    started = monotonic()
    response = await call_next(request)
    elapsed_ms = (monotonic() - started) * 1000
    if os.getenv("REPLENS_API_TIMING_LOGS") == "1" and elapsed_ms >= 250:
        route = request.scope.get("route")
        route_template = getattr(route, "path", "unmatched")
        capacity_logger.warning(
            "slow_api route=%s method=%s status=%d elapsed_ms=%.1f",
            route_template,
            request.method,
            response.status_code,
            elapsed_ms,
        )
    return response
app.include_router(auth_router)
app.include_router(session_routes.router)
app.include_router(health.router)
app.include_router(analyses.router)
app.include_router(live_estimates.router)
app.include_router(set_reviews.router)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    if request.url.path == "/api/set-reviews":
        return JSONResponse(
            status_code=422,
            content={
                "detail": [
                    {key: error[key] for key in ("type", "loc", "msg")}
                    for error in exc.errors()
                ]
            },
        )
    return await request_validation_exception_handler(request, exc)


@app.exception_handler(DatabasePoolTimeout)
async def database_pool_timeout(_request, _exc):
    return JSONResponse(
        status_code=503,
        content={"detail": "The service is busy. Please try again shortly."},
        headers={"Retry-After": "2"},
    )
