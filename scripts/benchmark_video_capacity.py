#!/usr/bin/env python3
"""Bounded local real-video analysis capacity probe using private source clips."""

import concurrent.futures
import hashlib
import json
import os
import platform
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = Path("/Users/zkaynl7/Projects/alu/velocity-tremor-ml")
VIDEO_PATHS = {
    "clip_1": ORIGINAL / "training/data/cropped_videos/replens-video-1.MOV",
    "clip_3": ORIGINAL / "training/data/cropped_videos/replens-video-3.MOV",
}
POSE_MODEL = ORIGINAL / "training/models/pose_landmarker_heavy.task"
BASE_URL = "http://127.0.0.1:8101"
MAX_RUNTIME_SECONDS = 20 * 60


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def video_metadata(path, alias):
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_name,width,height,avg_frame_rate,r_frame_rate", "-of", "json", str(path)],
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(probe.stdout)
    stream = next((item for item in data.get("streams", []) if item.get("width")), {})
    return {
        "clip": alias,
        "source_sha256": sha256(path),
        "size_bytes": path.stat().st_size,
        "duration_s": round(float(data.get("format", {}).get("duration", 0)), 3),
        "codec": stream.get("codec_name"),
        "width": stream.get("width"),
        "height": stream.get("height"),
        "avg_frame_rate": stream.get("avg_frame_rate"),
        "r_frame_rate": stream.get("r_frame_rate"),
    }


class ProcessSampler:
    def __init__(self, pid):
        import psutil

        self.psutil = psutil
        self.process = psutil.Process(pid)
        self.stop_event = threading.Event()
        self.samples = []
        self.thread = threading.Thread(target=self.sample, daemon=True)

    def start(self):
        self.process.cpu_percent(interval=None)
        self.thread.start()

    def sample(self):
        psutil = self.psutil
        while not self.stop_event.wait(0.5):
            try:
                self.samples.append({
                    "time": round(time.monotonic(), 3),
                    "rss_mb": self.process.memory_info().rss / (1024 * 1024),
                    "cpu_percent": self.process.cpu_percent(interval=None),
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                break

    def stop(self):
        self.stop_event.set()
        self.thread.join(2)

    def summary(self):
        return {
            "sample_count": len(self.samples),
            "peak_rss_mb": round(max((item["rss_mb"] for item in self.samples), default=0), 1),
            "average_cpu_percent": round(sum(item["cpu_percent"] for item in self.samples) / len(self.samples), 1) if self.samples else None,
        }


def prediction_summary(reps):
    """Count current analysis response fields without confusing RIR key names."""
    return {
        "available_predictions": sum(rep.get("rir") is not None for rep in reps),
        "prediction_status_counts": {
            status: sum(rep.get("prediction_status") == status for rep in reps)
            for status in ("available", "building_history", "unavailable")
        },
    }


def submit(video_path, title):
    started = time.monotonic()
    with video_path.open("rb") as stream, httpx.Client(timeout=httpx.Timeout(30, connect=10, write=120, read=30)) as client:
        response = client.post(
            BASE_URL + "/api/analyses",
            data={"model": "speed_only"},
            files={"video": (video_path.name, stream, "video/quicktime")},
        )
    elapsed = time.monotonic() - started
    if response.status_code != 202:
        return {"status": response.status_code, "upload_elapsed_s": round(elapsed, 3), "body": response.text[:200]}
    return {
        "status": 202,
        "job_id": response.json()["id"],
        "accepted_after_upload_s": round(elapsed, 3),
        "accepted_at_monotonic": time.monotonic(),
        "clip": title,
    }


def poll_jobs(jobs, timeout=MAX_RUNTIME_SECONDS):
    deadline = time.monotonic() + timeout
    for item in jobs:
        item["first_processing_after_accept_s"] = None
        item["terminal_state"] = None
    pending = {item["job_id"]: item for item in jobs if item.get("status") == 202}
    last_status_print = 0
    while pending and time.monotonic() < deadline:
        for job_id, item in list(pending.items()):
            response = httpx.get(BASE_URL + f"/api/analyses/{job_id}", timeout=10)
            if response.status_code != 200:
                item["poll_error"] = response.status_code
                continue
            job = response.json()
            item["state"] = job.get("state")
            if job.get("state") == "processing" and item["first_processing_after_accept_s"] is None:
                item["first_processing_after_accept_s"] = round(time.monotonic() - item["accepted_at_monotonic"], 3)
            if job.get("state") in {"completed", "failed", "cancelled"}:
                item["terminal_state"] = job["state"]
                item["terminal_after_accept_s"] = round(time.monotonic() - item["accepted_at_monotonic"], 3)
                if "result" in job:
                    result = job["result"]
                    item["model_choice"] = result.get("model_choice")
                    item["rep_count"] = result.get("rep_count")
                    item.update(prediction_summary(result.get("reps", [])))
                else:
                    item["terminal_message"] = job.get("message")
                pending.pop(job_id)
        if time.monotonic() - last_status_print >= 5:
            print(json.dumps({"pending_jobs": len(pending), "completed_jobs": len(jobs) - len(pending)}), flush=True)
            last_status_print = time.monotonic()
        if pending:
            time.sleep(0.5)
    for job_id, item in pending.items():
        item["terminal_state"] = "poll_timeout"
        item["terminal_after_accept_s"] = round(time.monotonic() - item["accepted_at_monotonic"], 3)


def synchronized_burst(video_path, count=5):
    barrier = threading.Barrier(count)

    def send(index):
        barrier.wait()
        return submit(video_path, f"burst_clip_1_{index + 1}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=count) as executor:
        return list(executor.map(send, range(count)))


def host_details():
    import psutil

    detail = {
        "platform": platform.platform(),
        "architecture": platform.machine(),
        "logical_cpus": psutil.cpu_count(logical=True),
        "physical_cpus": psutil.cpu_count(logical=False),
        "total_memory_gib": round(psutil.virtual_memory().total / (1024 ** 3), 2),
        "python": sys.version,
    }
    if sys.platform == "darwin":
        try:
            detail["cpu_model"] = subprocess.check_output(["sysctl", "-n", "machdep.cpu.brand_string"], text=True).strip()
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass
    return detail


def main():
    for path in (*VIDEO_PATHS.values(), POSE_MODEL):
        if not path.is_file():
            raise SystemExit(f"Required local asset is missing: {path.name}")
    video_info = {alias: video_metadata(path, alias) for alias, path in VIDEO_PATHS.items()}
    env = os.environ.copy()
    env["REPLENS_POSE_MODEL_PATH"] = str(POSE_MODEL)
    server_log_path = ROOT / "training/results/validation_capacity/video-api.log"
    server_log_path.parent.mkdir(parents=True, exist_ok=True)
    server_log = server_log_path.open("w")
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.backend.main:app", "--host", "127.0.0.1", "--port", "8101", "--log-level", "warning"],
        cwd=ROOT,
        env=env,
        stdout=server_log,
        stderr=subprocess.STDOUT,
    )
    sampler = ProcessSampler(server.pid)
    try:
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if server.poll() is not None:
                raise RuntimeError("analysis API exited before the video run")
            try:
                if httpx.get(BASE_URL + "/api/health", timeout=0.5).status_code == 200:
                    break
            except httpx.HTTPError:
                time.sleep(0.1)
        else:
            raise RuntimeError("local analysis API did not become healthy within 20 seconds")
        sampler.start()

        singles = []
        for alias in ("clip_1", "clip_3"):
            job = submit(VIDEO_PATHS[alias], alias)
            singles.append(job)
            print(json.dumps({"single_upload": alias, "status": job["status"], "accepted_after_upload_s": job.get("accepted_after_upload_s")}), flush=True)
            if job.get("status") == 202:
                poll_jobs([job])

        burst = synchronized_burst(VIDEO_PATHS["clip_1"], count=5)
        counts = {}
        for result in burst:
            counts[str(result["status"])] = counts.get(str(result["status"]), 0) + 1
        print(json.dumps({"burst5_status_counts": counts}), flush=True)
        poll_jobs(burst)
        sampler.stop()
        results = {
            "metadata": {
                "run_started_at_utc": datetime.now(timezone.utc).isoformat(),
                "commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
                "local_api": BASE_URL,
                "worker_count": 1,
                "model_choice": "speed_only",
                "host": host_details(),
                "pose_model_sha256": sha256(POSE_MODEL),
                "model_bundle_sha256": sha256(ROOT / "app/backend/assets/rir_speed_only.json"),
                "source_clips": video_info,
                "job_policy": {"single_jobs": 2, "synchronized_burst_uploads": 5, "expected_burst_admitted": 3, "expected_burst_rejected_429": 2},
            },
            "single_jobs": singles,
            "burst5": burst,
            "api_process_resources": sampler.summary(),
        }
        output = ROOT / "training/results/validation_capacity/video-jobs.json"
        output.write_text(json.dumps(results, indent=2) + "\n")
        print(json.dumps({"result_file": str(output.relative_to(ROOT)), "api_process_resources": sampler.summary()}), flush=True)
    finally:
        sampler.stop()
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=3)
        server_log.close()


if __name__ == "__main__":
    main()
