from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from ..services.predictor import model_catalog, resolve_model

router = APIRouter()


@router.get("/api/models")
def list_models():
    return model_catalog()


@router.post("/api/analyses", status_code=202)
def create_analysis(
    request: Request,
    video: UploadFile = File(...),
    model: Literal["speed_only", "speed_shaking"] | None = Form(None),
):
    try:
        choice = resolve_model(model)
    except ValueError as exc:
        video.file.close()
        raise HTTPException(422, str(exc)) from exc
    except RuntimeError as exc:
        video.file.close()
        raise HTTPException(503, str(exc)) from exc
    return request.app.state.jobs.create(video, choice)


@router.get("/api/analyses/{job_id}")
def get_analysis(job_id: str, request: Request):
    return request.app.state.jobs.get(job_id)


@router.delete("/api/analyses/{job_id}", status_code=204)
def cancel_analysis(job_id: str, request: Request):
    request.app.state.jobs.cancel(job_id)
