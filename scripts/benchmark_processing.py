#!/usr/bin/env python3
"""Compare motion inference with a committed baseline using local video and pose data."""

import argparse
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time

import cv2
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.backend.services import motion_features as current
from app.backend.services.linear_predictor import FEATURES, LinearPredictor
from app.backend.services.rep_signals import detect_reps


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True, type=Path)
    parser.add_argument("--pose", required=True, type=Path)
    parser.add_argument(
        "--reps", type=Path, help="Optional CSV of reviewed rep boundaries"
    )
    parser.add_argument(
        "--model", type=Path, default=ROOT / "app/backend/assets/rir_model.json"
    )
    parser.add_argument("--baseline-ref", default="a0f903d")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    baseline_ref = subprocess.check_output(
        ["git", "rev-parse", "--verify", f"{args.baseline_ref}^{{commit}}"],
        cwd=ROOT,
        text=True,
    ).strip()
    source = subprocess.check_output(
        ["git", "show", f"{baseline_ref}:app/backend/services/motion_features.py"],
        cwd=ROOT,
    )
    with tempfile.TemporaryDirectory(prefix="replens-benchmark-") as tmp:
        module_path = Path(tmp) / "baseline_motion.py"
        module_path.write_bytes(source)
        spec = importlib.util.spec_from_file_location("baseline_motion", module_path)
        baseline = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(baseline)
        pose = pd.read_csv(args.pose)
        capture = cv2.VideoCapture(str(args.video))
        fps = capture.get(cv2.CAP_PROP_FPS)
        capture.release()
        reps = pd.read_csv(args.reps) if args.reps else detect_reps(pose, fps)
        reps = reps.to_dict("records")
        predictor = LinearPredictor(args.model)
        cv2.setNumThreads(2)
        cv2.setRNGSeed(42)
        start = time.perf_counter()
        original = baseline.pixel_motion(args.video, pose)
        persistent = baseline.pixel_motion(args.video, pose, persistent=True)
        before = time.perf_counter() - start
        cv2.setRNGSeed(42)
        start = time.perf_counter()
        new_original, new_persistent = current.pixel_motion_dual(args.video, pose)
        after = time.perf_counter() - start

        flows = {}
        for label, expected, actual in (
            ("original", original, new_original),
            ("persistent", persistent, new_persistent),
        ):
            if expected.shape != actual.shape or list(expected.columns) != list(
                actual.columns
            ):
                raise AssertionError(f"{label}: flow table shape or columns differ")
            expected_values = expected.to_numpy(float)
            actual_values = actual.to_numpy(float)
            masks_match = np.array_equal(
                np.isnan(expected_values), np.isnan(actual_values)
            )
            if not masks_match:
                raise AssertionError(f"{label}: NaN masks differ")
            np.testing.assert_allclose(
                expected_values, actual_values, atol=1e-9, rtol=0, equal_nan=True
            )
            finite = np.isfinite(expected_values) & np.isfinite(actual_values)
            max_diff = (
                float(np.max(np.abs(expected_values[finite] - actual_values[finite])))
                if finite.any()
                else 0.0
            )
            flows[label] = {
                "rows": len(expected),
                "columns": len(expected.columns),
                "nan_masks_match": masks_match,
                "max_finite_difference": max_diff,
            }

        available = 0
        for index in range(3, len(reps)):
            bounds = (
                reps[index - 3]["start_s"],
                reps[index]["end_s"],
                reps[index]["start_s"],
            )
            old_speed, old_reason = baseline.candidate_features(original, *bounds)
            old_shake, old_shake_reason = baseline.transverse_shaking(
                persistent, *bounds
            )
            new_speed, new_reason = current.candidate_features(new_original, *bounds)
            new_shake, new_shake_reason = current.transverse_shaking(
                new_persistent, *bounds
            )
            if (old_reason, old_shake_reason) != (new_reason, new_shake_reason):
                raise AssertionError(f"rep {index + 1}: quality decisions differ")
            if (old_speed is None, old_shake is None) != (
                new_speed is None,
                new_shake is None,
            ):
                raise AssertionError(f"rep {index + 1}: feature availability differs")
            if old_speed is None or old_shake is None:
                continue
            old_features = {**old_speed, **old_shake}
            new_features = {**new_speed, **new_shake}
            np.testing.assert_allclose(
                [old_features[k] for k in FEATURES],
                [new_features[k] for k in FEATURES],
                atol=1e-9,
                rtol=0,
            )
            np.testing.assert_allclose(
                predictor.estimate(old_features),
                predictor.estimate(new_features),
                atol=1e-9,
                rtol=0,
            )
            available += 1
        report = {
            "baseline_commit": baseline_ref,
            "measurement": "single local run; motion only; OpenCV threads=2",
            "model": "same unchanged bundle for both implementations",
            "boundary_source": "supplied CSV" if args.reps else "automatic detection",
            "rep_count": len(reps),
            "quality_decisions_compared": max(0, len(reps) - 3),
            "feature_vectors_and_predictions_compared": available,
            "absolute_tolerance": 1e-9,
            "flows": flows,
            "seconds": {"baseline": before, "optimized": after},
        }
        rendered = json.dumps(report, indent=2, allow_nan=False) + "\n"
        if args.output:
            args.output.write_text(rendered)
        print(rendered, end="")


if __name__ == "__main__":
    main()
