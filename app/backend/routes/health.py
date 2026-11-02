from fastapi import APIRouter

from ..services.analysis import predictor

router = APIRouter()


@router.get("/api/health")
def health():
    try:
        predictor.load()
    except (RuntimeError, OSError, ValueError) as exc:
        return {"status":"ok", "model_available":False, "mode":"experimental", "model_error":str(exc)}
    return {"status":"ok", "model_available":True, "mode":"experimental",
            "model_family":predictor.metadata["family"], "model_version":predictor.metadata["version"]}
