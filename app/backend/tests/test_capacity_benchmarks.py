import unittest

from scripts.benchmark_video_capacity import prediction_summary


class CapacityBenchmarkResultTests(unittest.TestCase):
    def test_counts_rir_field_and_distinguishes_history_from_unavailable(self):
        reps = [
            {"rir": None, "prediction_status": "building_history"},
            {"rir": None, "prediction_status": "building_history"},
            {"rir": None, "prediction_status": "building_history"},
            {"rir": 5.2, "prediction_status": "available"},
            {"rir": 0.0, "prediction_status": "available"},
            {"rir": None, "prediction_status": "unavailable"},
        ]
        self.assertEqual(
            prediction_summary(reps),
            {
                "available_predictions": 2,
                "prediction_status_counts": {
                    "available": 2,
                    "building_history": 3,
                    "unavailable": 1,
                },
            },
        )


if __name__ == "__main__":
    unittest.main()
