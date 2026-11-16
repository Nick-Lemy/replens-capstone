import unittest

import numpy as np
import pandas as pd
from pydantic import ValidationError

from app.backend.schemas import SetReviewRequest
from app.backend.services.motion_features import candidate_features


def flow_table(fps=30, gap_at=None):
    times = np.arange(0, 2.5, 1 / fps)
    if gap_at is not None:
        times = np.delete(times, gap_at)
    dt = np.full(len(times), 1 / fps)
    return pd.DataFrame({
        "time_s": times,
        "dt": dt,
        "shoulder_px": np.full(len(times), 100.0),
        "left_dx": np.sin(2 * np.pi * times),
        "left_dy": 0.2 * np.sin(2 * np.pi * 6 * times),
        "right_dx": np.sin(2 * np.pi * times),
        "right_dy": 0.2 * np.sin(2 * np.pi * 6 * times),
    })


class MotionQualityGateTests(unittest.TestCase):
    def test_signal_features_require_at_least_25_hz(self):
        result, reason = candidate_features(flow_table(fps=24), 0, 2.48, 1.7)
        self.assertIsNone(result)
        self.assertEqual(reason, "irregular or interrupted frame times")

    def test_signal_features_reject_frame_time_gap_without_upsampling(self):
        result, reason = candidate_features(flow_table(gap_at=35), 0, 2.45, 1.7)
        self.assertIsNone(result)
        self.assertEqual(reason, "irregular or interrupted frame times")

    def test_signal_features_reject_three_frame_tracking_gap(self):
        flow = flow_table()
        flow.loc[35:37, ["left_dx", "left_dy", "right_dx", "right_dy"]] = np.nan
        result, reason = candidate_features(flow, 0, 2.45, 1.7)
        self.assertIsNone(result)
        self.assertEqual(reason, "tracking gap exceeds two frames or reaches an edge")

    def test_confirmed_failure_and_visible_remaining_reps_are_required(self):
        reps = [{"start_s": i, "top_s": i + 0.2, "end_s": i + 0.4} for i in range(2)]
        for body in (
            {"failure_confirmed": False, "all_remaining_reps_visible": True, "reps": reps},
            {"failure_confirmed": True, "all_remaining_reps_visible": False, "reps": reps},
        ):
            with self.subTest(body=body), self.assertRaises(ValidationError):
                SetReviewRequest.model_validate(body)


if __name__ == "__main__":
    unittest.main()
