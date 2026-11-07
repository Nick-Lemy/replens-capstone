from contextlib import asynccontextmanager

import cv2
from fastapi import FastAPI
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config.settings import FRONTEND_ORIGINS, OPENCV_THREADS
from .routes import analyses, health, set_reviews
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
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
    allow_credentials=True,
)
app.include_router(auth_router)
app.include_router(health.router)
app.include_router(analyses.router)
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
