import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BUNDLE = Path(
    os.environ.get("REPLENS_MODEL_PATH") or ROOT / "app/backend/assets/rir_model.json"
)
POSE_MODEL = ROOT / "training/models/pose_landmarker_heavy.task"
OPENCV_THREADS = 2
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]
