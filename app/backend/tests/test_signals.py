import unittest

import numpy as np
import pandas as pd

from app.backend.services.motion_features import (
    _background_camera,
    _track_wrists,
    candidate_features,
    motion_pose,
    transverse_shaking,
)
from app.backend.services.rep_signals import detect_reps
from app.backend.services.review import review_set
from app.backend.schemas import SetReviewRequest


class SignalTests(unittest.TestCase):
    def test_detects_complete_synthetic_curls(self):
        fps = 30
        times = np.arange(0, 12, 1 / fps)
        lift = (1 - np.cos(np.pi * times)) / 2
        frames = pd.DataFrame({"time_s": times})
        for side in ("left", "right"):
            frames[f"{side}_wrist_y"] = -0.2 * lift
            frames[f"{side}_upper_arm"] = 0.2
            frames[f"{side}_flexion"] = 20 + 100 * lift

        reps = detect_reps(frames, fps)

        self.assertEqual(len(reps), 6)
        self.assertTrue((reps.start_s < reps.top_s).all())
        self.assertTrue((reps.top_s < reps.end_s).all())

    def test_rejects_stationary_synthetic_arms(self):
        times = np.arange(0, 5, 1 / 30)
        frames = pd.DataFrame({"time_s": times})
        for side in ("left", "right"):
            frames[f"{side}_wrist_y"] = -0.1
            frames[f"{side}_upper_arm"] = 0.2
            frames[f"{side}_flexion"] = 30.0

        self.assertTrue(detect_reps(frames, 30).empty)

    def test_camera_translation_is_removed_from_wrist_motion(self):
        rng = np.random.default_rng(7)
        background = rng.uniform([0, 0], [960, 720], size=(30, 2))
        translation = np.array([2.0, -1.0])
        pose = np.array([0.4, 0.3, 0.4, 0.5, 0.4, 0.7,
                         0.6, 0.3, 0.6, 0.5, 0.6, 0.7])
        affine, inliers, noise, width = _background_camera(
            pose, (720, 960), background, background + translation
        )
        wrist = rng.uniform([300, 200], [500, 500], size=(12, 2))
        wrist_motion = np.array([0.0, 3.0])
        item = {}
        tracked = {"left": None, "right": None}
        flows = {
            (False, "left"): (wrist, wrist + translation + wrist_motion),
            (False, "right"): (wrist, wrist + translation + wrist_motion),
        }
        _track_wrists(affine, inliers, False, tracked, item, flows)

        self.assertGreater(inliers, 0.9)
        self.assertLess(noise, 0.01)
        self.assertAlmostEqual(width, 192.0, places=2)
        self.assertAlmostEqual(item["left_dx"], 0.0, places=2)
        self.assertAlmostEqual(item["left_dy"], 3.0, places=2)

    def test_synthetic_transverse_shaking_and_tracking_quality(self):
        times = np.arange(1, 6, 1 / 30)
        flow = pd.DataFrame({
            "time_s": times,
            "dt": np.full(len(times), 1 / 30),
            "shoulder_px": np.full(len(times), 100.0),
            "camera_inliers": np.ones(len(times)),
            "background_error_px": np.full(len(times), 0.2),
        })
        for side in ("left", "right"):
            flow[f"{side}_dx"] = 2 * np.sin(2 * np.pi * times)
            flow[f"{side}_dy"] = 0.3 * np.sin(2 * np.pi * 6 * times)

        features, reason = transverse_shaking(flow, 1, 5.97, 5)
        self.assertIsNone(reason)
        self.assertAlmostEqual(features["transverse_peak_hz"], 6.0, delta=0.6)

        flow.loc[20:50, ["left_dx", "left_dy", "right_dx", "right_dy"]] = np.nan
        unavailable, reason = candidate_features(flow, 1, 5.97, 5)
        self.assertIsNone(unavailable)
        self.assertIn("tracking", reason)

    def test_future_motion_does_not_change_current_window(self):
        times = np.arange(1, 6, 1 / 30)
        flow = pd.DataFrame({
            "time_s": times,
            "dt": np.full(len(times), 1 / 30),
            "shoulder_px": np.full(len(times), 100.0),
            "camera_inliers": np.ones(len(times)),
            "background_error_px": np.full(len(times), 0.2),
            "left_dx": np.sin(2 * np.pi * times),
            "left_dy": np.sin(2 * np.pi * 6 * times) * 0.2,
            "right_dx": np.sin(2 * np.pi * times),
            "right_dy": np.sin(2 * np.pi * 6 * times) * 0.2,
        })
        current, reason = candidate_features(flow, 1, 5.97, 5)
        self.assertIsNone(reason)
        future = flow.iloc[:30].copy()
        future["time_s"] += 5
        future[["left_dx", "left_dy", "right_dx", "right_dy"]] *= 100
        extended = pd.concat([flow, future], ignore_index=True)
        unchanged, reason = candidate_features(extended, 1, 5.97, 5)
        self.assertIsNone(reason)
        for name in ("speed_mean", "speed_p90", "speed_current", "speed_change"):
            self.assertAlmostEqual(current[name], unchanged[name])

    def test_confirmed_failure_labels_count_back(self):
        request = SetReviewRequest.model_validate({
            "failure_confirmed": True,
            "all_remaining_reps_visible": True,
            "reps": [
                {"start_s": i, "top_s": i + 0.25, "end_s": i + 0.5}
                for i in range(3)
            ],
        })
        result = review_set(request)
        self.assertEqual([rep.observed_rir for rep in result.reps], [2, 1, 0])
        self.assertFalse(result.is_prediction)

    def test_motion_pose_restores_absolute_coordinates(self):
        row = {}
        for side, shoulder in (("left", (0.2, 0.3)), ("right", (0.7, 0.3))):
            row[f"{side}_shoulder_x"], row[f"{side}_shoulder_y"] = shoulder
            row[f"{side}_elbow_x"], row[f"{side}_elbow_y"] = (0.0, 0.2)
            row[f"{side}_wrist_x"], row[f"{side}_wrist_y"] = (0.0, 0.4)

        self.assertTrue(np.allclose(
            motion_pose(row),
            [0.2, 0.3, 0.2, 0.5, 0.2, 0.7, 0.7, 0.3, 0.7, 0.5, 0.7, 0.7],
        ))


if __name__ == "__main__":
    unittest.main()
