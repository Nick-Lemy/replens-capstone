import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Lock
from time import monotonic
from uuid import uuid4

from fastapi import HTTPException

from .analysis import analyze
from .video import discard_audio

logger = logging.getLogger("replens")


class AnalysisJobManager:
    def __init__(self):
        self.lock = Lock()
        self.jobs = {}
        self.inflight = set()
        self.storage = TemporaryDirectory(prefix="replens-")
        self.worker = ThreadPoolExecutor(max_workers=1)

    def create(self, video):
        suffix = Path(video.filename or "").suffix.lower()
        if suffix not in {".mp4", ".mov", ".m4v", ".webm"}:
            video.file.close()
            raise HTTPException(422, "Choose an MP4, MOV, M4V or WebM video.")
        try:
            with self.lock:
                now = monotonic()
                for key in list(self.jobs):
                    if key not in self.inflight and now - self.jobs[key].get("finished_at", now) > 7200:
                        del self.jobs[key]
                if len(self.inflight) >= 3:
                    raise HTTPException(429, "The analyzer is busy. Please try again shortly.")
                job_id = uuid4().hex
                self.jobs[job_id] = {"id": job_id, "state": "queued", "progress": 0, "message": "Waiting to analyze"}
                self.inflight.add(job_id)
            path = Path(self.storage.name) / (job_id + suffix)
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
                self.worker.submit(self.execute, job_id, path)
            except Exception:
                path.unlink(missing_ok=True)
                with self.lock:
                    self.jobs.pop(job_id, None)
                    self.inflight.discard(job_id)
                raise
            return {"id": job_id}
        finally:
            video.file.close()

    def cancelled(self, job_id):
        with self.lock:
            return self.jobs[job_id].get("cancelled", False)

    def execute(self, job_id, path):
        def progress(value, message):
            with self.lock:
                if not self.jobs[job_id].get("cancelled"):
                    self.jobs[job_id].update(progress=value, message=message, state="processing")

        try:
            if self.cancelled(job_id):
                return
            progress(1, "Removing audio")
            if self.cancelled(job_id):
                return
            discard_audio(path)
            if self.cancelled(job_id):
                return
            result = analyze(path, progress, lambda: self.cancelled(job_id))
            with self.lock:
                if not self.jobs[job_id].get("cancelled"):
                    self.jobs[job_id].update(state="completed", progress=100, message="Analysis complete", result=result)
        except Exception as exc:
            logger.exception("Analysis failed for %s", job_id)
            message = str(exc) if isinstance(exc, ValueError) else "Analysis could not finish. Please try a shorter, clearer video."
            with self.lock:
                if not self.jobs[job_id].get("cancelled"):
                    self.jobs[job_id].update(state="failed", message=message)
        finally:
            path.unlink(missing_ok=True)
            with self.lock:
                self.jobs[job_id]["finished_at"] = monotonic()
                self.inflight.discard(job_id)

    def get(self, job_id):
        with self.lock:
            if job_id not in self.jobs:
                raise HTTPException(404, "This analysis is unavailable. Please analyze the video again.")
            return {k: v for k, v in self.jobs[job_id].items() if k not in {"cancelled", "finished_at"}}

    def cancel(self, job_id):
        with self.lock:
            if job_id not in self.jobs:
                raise HTTPException(404, "Analysis not found.")
            self.jobs[job_id].update(cancelled=True, state="cancelled", message="Analysis cancelled")

    def close(self):
        with self.lock:
            for job_id in self.inflight:
                self.jobs[job_id].update(cancelled=True, state="cancelled", message="Analysis cancelled")
        self.worker.shutdown(wait=True)
        self.storage.cleanup()
