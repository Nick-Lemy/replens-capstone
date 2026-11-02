from fastapi import APIRouter, File, Request, UploadFile

router = APIRouter()


@router.post("/api/analyses", status_code=202)
def create_analysis(request: Request, video: UploadFile = File(...)):
    return request.app.state.jobs.create(video)


@router.get("/api/analyses/{job_id}")
def get_analysis(job_id: str, request: Request):
    return request.app.state.jobs.get(job_id)


@router.delete("/api/analyses/{job_id}", status_code=204)
def cancel_analysis(job_id: str, request: Request):
    request.app.state.jobs.cancel(job_id)
