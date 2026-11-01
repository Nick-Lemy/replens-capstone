from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd

from .predictor import Predictor
from ..config.settings import ROOT, POSE_MODEL
from .rep_signals import _landmarks, detect_reps

predictor = Predictor()


def analyze(path: Path, progress, cancelled):
    model_path = POSE_MODEL
    if not model_path.is_file():
        matches = list((ROOT / "training/models").rglob("*heavy*.task"))
        if not matches:
            raise ValueError(
                "Pose annotation model is missing. Run the video review setup first."
            )
        model_path = matches[0]
    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path)),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_poses=1,
    )
    capture = cv2.VideoCapture(str(path))
    fps = capture.get(cv2.CAP_PROP_FPS)
    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    if not capture.isOpened() or not np.isfinite(fps) or not 5 <= fps <= 120:
        capture.release()
        raise ValueError("This video could not be decoded. Try a different MP4 or MOV.")
    if total > 10800 or total / fps > 180:
        capture.release()
        raise ValueError("Choose a single set lasting no more than 3 minutes.")
    rows, index, last_timestamp = [], 0, -1
    try:
        with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
            while not cancelled():
                ok, frame = capture.read()
                if not ok:
                    break
                timestamp = round(capture.get(cv2.CAP_PROP_POS_MSEC))
                if timestamp <= last_timestamp:
                    raise ValueError(
                        "The video has unsupported frame timing. Try exporting it as a standard MP4."
                    )
                last_timestamp = timestamp
                if timestamp > 180000 or index >= 10800:
                    raise ValueError("Choose a shorter video, up to 3 minutes.")
                h, w = frame.shape[:2]
                if h * w > 17000000:
                    raise ValueError("Video resolution is too large. Export at 1080p.")
                if w > 960:
                    frame = cv2.resize(frame, (960, round(h * 960 / w)))
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pose = detector.detect_for_video(
                    mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), timestamp
                )
                row = _landmarks(pose, rgb)
                row["time_s"] = timestamp / 1000
                rows.append(row)
                index += 1
                if index % 30 == 0:
                    progress(
                        5 + min(45, int(index / max(1, total) * 45)),
                        "Finding completed curls",
                    )
    finally:
        capture.release()
    if cancelled():
        raise ValueError("Analysis cancelled.")
    if not rows:
        raise ValueError("The video contains no readable frames.")
    frames = pd.DataFrame(rows)
    proposed = detect_reps(frames, fps)
    frames.attrs.clear()
    reps = (
        proposed[["rep", "start_s", "top_s", "end_s"]].to_dict("records")
        if len(proposed)
        else []
    )
    coverage = float(
        frames[["left_flexion", "right_flexion"]].notna().all(axis=1).mean()
    )
    warnings = ["Rep detection is automatic. Check the count against your video."]
    if coverage < 0.6:
        warnings.append(
            "Both arms were visible for less than 60% of the clip. Reps may be missed."
        )
    predictions, metadata = [None] * len(reps), None
    unavailable = None
    if reps and coverage < 0.35:
        unavailable = "Arm visibility was too low for a usable estimate. Keep both arms in the frame and try again."
    elif reps:
        try:
            predictions, metadata = predictor.predict(path, reps, progress, cancelled, pose_frames=frames)
        except (RuntimeError, ValueError, OSError) as exc:
            unavailable = str(exc)
    else:
        unavailable = "No complete curls could be identified. Keep your shoulders, elbows and wrists visible."
    if metadata is not None and len(reps) < 4:
        unavailable = "The first estimate is available after 4 completed reps. This set does not contain enough detected reps."
    elif metadata is not None and not any(value is not None for value in predictions):
        unavailable = "Small movement could not be measured reliably. Use a steady camera, good light and a clear view of both arms."
    quality = {item["rep"]: item["reason"] for item in (metadata or {}).get("rep_quality", [])}
    if metadata is not None and metadata.get("family") == "ridge_speed_transverse":
        warnings.append("This model was evaluated on only 33 quality-filtered examples from four people. Its error does not describe every uploaded video.")
    finite_predictions = [p for p in predictions if p is not None]
    if len(finite_predictions) >= 3 and np.std(finite_predictions) < 0.1:
        warnings.append(
            "The model produced nearly constant estimates across this set. Do not use these estimates to decide when to stop."
        )
    for rep, value in zip(reps, predictions):
        rep["rir"] = value
        rep["prediction_status"] = "building_history" if metadata is not None and rep["rep"] < 4 else ("available" if value is not None else "unavailable")
        rep["prediction_reason"] = quality.get(rep["rep"])
    progress(98, "Preparing your results")
    return {
        "exercise": "Simultaneous dumbbell curl",
        "reps": reps,
        "rep_count": len(reps),
        "duration_s": float(frames.time_s.iloc[-1]),
        "tracking_coverage": coverage,
        "warnings": warnings,
        "prediction_unavailable_reason": unavailable,
        "model": metadata,
    }
