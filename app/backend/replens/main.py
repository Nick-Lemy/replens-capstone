import logging
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Lock
from time import monotonic
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .analysis import analyze, predictor
from .video import discard_audio

app = FastAPI(title="RepLens API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(","),
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)
workers = ThreadPoolExecutor(max_workers=1)
lock = Lock()
jobs = {}
storage = TemporaryDirectory(prefix="replens-")
logger = logging.getLogger("replens")


def execute(job_id, path):
    with lock:
        if jobs[job_id].get("cancelled"):
            path.unlink(missing_ok=True)
            jobs[job_id]["finished_at"] = monotonic()
            return

    def progress(value, message):
        with lock:
            jobs[job_id].update(progress=value, message=message, state="processing")

    try:
        progress(1, "Removing audio")
        discard_audio(path)
        result = analyze(path, progress, lambda: jobs[job_id].get("cancelled", False))
        with lock:
            if not jobs[job_id].get("cancelled"):
                jobs[job_id].update(
                    state="completed",
                    progress=100,
                    message="Analysis complete",
                    result=result,
                )
    except Exception as exc:
        logger.exception("Analysis failed for %s", job_id)
        message = (
            str(exc)
            if isinstance(exc, ValueError)
            else "Analysis could not finish. Please try a shorter, clearer video."
        )
        with lock:
            jobs[job_id].update(
                state="cancelled" if jobs[job_id].get("cancelled") else "failed",
                message=message,
            )
    finally:
        path.unlink(missing_ok=True)
        with lock:
            jobs[job_id]["finished_at"] = monotonic()


@app.get("/api/health")
def health():
    try:
        predictor.load()
    except (RuntimeError, OSError, ValueError) as exc:
        return {"status":"ok", "model_available":False, "mode":"experimental", "model_error":str(exc)}
    return {"status":"ok", "model_available":True, "mode":"experimental",
            "model_family":predictor.metadata["family"], "model_version":predictor.metadata["version"]}


@app.post("/api/analyses", status_code=202)
def create_analysis(video: UploadFile = File(...)):
    suffix = Path(video.filename or "").suffix.lower()
    if suffix not in {".mp4", ".mov", ".m4v", ".webm"}:
        raise HTTPException(422, "Choose an MP4, MOV, M4V or WebM video.")
    with lock:
        for key in list(jobs):
            if monotonic() - jobs[key].get("finished_at", monotonic()) > 7200:
                del jobs[key]
        if sum(j["state"] in {"queued", "processing"} for j in jobs.values()) >= 3:
            raise HTTPException(429, "The analyzer is busy. Please try again shortly.")
        job_id = uuid4().hex
        jobs[job_id] = {
            "id": job_id,
            "state": "queued",
            "progress": 0,
            "message": "Waiting to analyze",
        }
    path = Path(storage.name) / (job_id + suffix)
    try:
        size = 0
        with path.open("wb") as dest:
            while chunk := video.file.read(1024 * 1024):
                size += len(chunk)
                if size > 250 * 1024 * 1024:
                    raise HTTPException(413, "Choose a video smaller than 250 MB.")
                dest.write(chunk)
        if not size:
            raise HTTPException(422, "This video is empty.")
    except Exception:
        path.unlink(missing_ok=True)
        with lock:
            del jobs[job_id]
        raise
    finally:
        video.file.close()
    workers.submit(execute, job_id, path)
    return {"id": job_id}


@app.get("/api/analyses/{job_id}")
def get_analysis(job_id: str):
    with lock:
        if job_id not in jobs:
            raise HTTPException(
                404, "This analysis is unavailable. Please analyze the video again."
            )
        return {
            k: v
            for k, v in jobs[job_id].items()
            if k not in {"cancelled", "finished_at"}
        }


@app.delete("/api/analyses/{job_id}", status_code=204)
def cancel_analysis(job_id: str):
    with lock:
        if job_id not in jobs:
            raise HTTPException(404, "Analysis not found.")
        jobs[job_id].update(
            cancelled=True, state="cancelled", message="Analysis cancelled"
        )
