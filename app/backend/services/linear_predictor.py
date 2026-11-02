import json
from pathlib import Path

import numpy as np

from .motion_features import (
    candidate_features,
    pixel_motion,
    pixel_motion_dual,
    transverse_shaking,
)

FEATURES = [
    "speed_mean",
    "speed_p90",
    "speed_current",
    "speed_change",
    "transverse_log_rms",
    "transverse_power_fraction",
    "transverse_peak_fraction",
]


SPEED_FEATURES = FEATURES[:4]


class LinearPredictor:
    def __init__(self, path):
        bundle = json.loads(Path(path).read_text())
        self.metadata = bundle["metadata"]
        family = self.metadata.get("family")
        expected = {
            "ridge_speed_only": (SPEED_FEATURES, "wrist_pixels_speed_v1"),
            "ridge_speed_transverse": (
                FEATURES,
                "wrist_pixels_speed_v1_persistent_transverse_v3",
            ),
        }.get(family)
        if expected is None or self.metadata.get("feature_names") != expected[0]:
            raise RuntimeError("Unsupported signal model or feature order.")
        if self.metadata.get("preprocessing") != expected[1]:
            raise RuntimeError(
                "The signal preprocessing does not match the trained model."
            )
        self.features = expected[0]
        self.mean = np.asarray(bundle["mean"], float)
        self.scale = np.asarray(bundle["scale"], float)
        self.coefficients = np.asarray(bundle["coefficients"], float)
        self.intercept = float(bundle["intercept"])
        arrays = [self.mean, self.scale, self.coefficients]
        if any(
            value.shape != (len(self.features),) or not np.isfinite(value).all()
            for value in arrays
        ):
            raise RuntimeError("Invalid signal-model coefficients.")
        if not np.isfinite(self.intercept) or (self.scale <= 0).any():
            raise RuntimeError("Invalid signal-model scaling.")

    def estimate(self, features):
        values = np.array([features[name] for name in self.features], float)
        if not np.isfinite(values).all():
            raise ValueError("Unreliable signal features.")
        return float(
            ((values - self.mean) / self.scale) @ self.coefficients + self.intercept
        )

    def predict(self, path, reps, progress, cancelled, pose_frames):
        metadata = {**self.metadata, "rep_quality": []}
        predictions = [None] * len(reps)
        if len(reps) < 4:
            return predictions, metadata
        if self.metadata["family"] == "ridge_speed_only":
            original = pixel_motion(
                path,
                pose_frames,
                progress=lambda p: progress(
                    50 + int(43 * p), "Measuring lifting speed"
                ),
                cancelled=cancelled,
            )
            persistent = None
        else:
            original, persistent = pixel_motion_dual(
                path,
                pose_frames,
                progress=lambda p: progress(50 + int(43 * p), "Measuring movement"),
                cancelled=cancelled,
            )
        for index in range(3, len(reps)):
            if cancelled():
                raise ValueError("Analysis cancelled.")
            start, end = reps[index - 3]["start_s"], reps[index]["end_s"]
            speed, reason = candidate_features(
                original, start, end, reps[index]["start_s"]
            )
            if speed is None:
                metadata["rep_quality"].append(
                    {"rep": reps[index]["rep"], "reason": reason}
                )
                continue
            if persistent is not None:
                shaking, shaking_reason = transverse_shaking(
                    persistent, start, end, reps[index]["start_s"]
                )
                if shaking is None:
                    metadata["rep_quality"].append(
                        {"rep": reps[index]["rep"], "reason": shaking_reason}
                    )
                    continue
                speed = {**speed, **shaking}
            predictions[index] = self.estimate(speed)
        return predictions, metadata
