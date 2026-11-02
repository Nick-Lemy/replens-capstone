from pathlib import Path

import numpy as np

from .predictor import Predictor
from .pose_tracking import track_pose
from .rep_signals import detect_reps

predictor = Predictor()


def analyze(path: Path, progress, cancelled, model_choice="speed_shaking"):
    frames, fps = track_pose(path, progress, cancelled)
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
            predictions, metadata = predictor.predict(
                path,
                reps,
                progress,
                cancelled,
                pose_frames=frames,
                model_choice=model_choice,
            )
        except (RuntimeError, ValueError, OSError) as exc:
            unavailable = str(exc)
    else:
        unavailable = "No complete curls could be identified. Keep your shoulders, elbows and wrists visible."

    if metadata is not None and len(reps) < 4:
        unavailable = "The first estimate is available after 4 completed reps. This set does not contain enough detected reps."
    elif metadata is not None and not any(value is not None for value in predictions):
        if model_choice == "speed_only":
            unavailable = "Lifting speed could not be measured reliably. Use a steady camera, good light and a clear view of both arms."
        else:
            unavailable = "Small movement could not be measured reliably. Use a steady camera, good light and a clear view of both arms."

    quality = {
        item["rep"]: item["reason"] for item in (metadata or {}).get("rep_quality", [])
    }

    if metadata is not None and metadata.get("family") in {
        "ridge_speed_transverse",
        "ridge_speed_only",
    }:
        warnings.append(
            "This model was evaluated on only 33 quality-filtered examples from four people. Its error does not describe every uploaded video."
        )

    finite_predictions = [p for p in predictions if p is not None]
    if len(finite_predictions) >= 3 and np.std(finite_predictions) < 0.1:
        warnings.append(
            "The model produced nearly constant estimates across this set. Do not use these estimates to decide when to stop."
        )

    for rep, value in zip(reps, predictions):
        rep["rir"] = value
        rep["prediction_status"] = (
            "building_history"
            if metadata is not None and rep["rep"] < 4
            else ("available" if value is not None else "unavailable")
        )
        rep["prediction_reason"] = quality.get(rep["rep"])

    progress(98, "Preparing your results")
    return {
        "exercise": "Simultaneous dumbbell curl",
        "model_choice": model_choice,
        "reps": reps,
        "rep_count": len(reps),
        "duration_s": float(frames.time_s.iloc[-1]),
        "tracking_coverage": coverage,
        "warnings": warnings,
        "prediction_unavailable_reason": unavailable,
        "model": metadata,
    }
