import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from app.backend.services.linear_predictor import FEATURES, SPEED_FEATURES, LinearPredictor


ASSETS = Path(__file__).parents[1] / "assets"


class FrozenModelContractTests(unittest.TestCase):
    def test_bundled_models_preserve_family_feature_order_and_scaling(self):
        contracts = {
            "rir_speed_only.json": ("ridge_speed_only", SPEED_FEATURES, "wrist_pixels_speed_v1"),
            "rir_model.json": (
                "ridge_speed_transverse", FEATURES,
                "wrist_pixels_speed_v1_persistent_transverse_v3",
            ),
        }
        for filename, (family, names, preprocessing) in contracts.items():
            with self.subTest(filename=filename):
                model = LinearPredictor(ASSETS / filename)
                self.assertEqual(model.metadata["family"], family)
                self.assertEqual(model.metadata["feature_names"], names)
                self.assertEqual(model.metadata["preprocessing"], preprocessing)
                self.assertEqual(model.mean.shape, (len(names),))
                self.assertEqual(model.scale.shape, (len(names),))
                self.assertEqual(model.coefficients.shape, (len(names),))
                self.assertTrue(np.isfinite(model.mean).all())
                self.assertTrue(np.isfinite(model.scale).all())
                self.assertTrue((model.scale > 0).all())
                self.assertTrue(np.isfinite(model.coefficients).all())
                self.assertTrue(np.isfinite(model.intercept))

    def test_rejects_corrupt_metadata_shapes_nonfinite_and_nonpositive_scale(self):
        source = json.loads((ASSETS / "rir_model.json").read_text())
        mutations = []
        bad = json.loads(json.dumps(source)); bad["metadata"]["feature_names"] = list(reversed(bad["metadata"]["feature_names"]))
        mutations.append(bad)
        bad = json.loads(json.dumps(source)); bad["mean"] = bad["mean"][:-1]
        mutations.append(bad)
        bad = json.loads(json.dumps(source)); bad["scale"][0] = 0
        mutations.append(bad)
        bad = json.loads(json.dumps(source)); bad["coefficients"][0] = float("nan")
        mutations.append(bad)
        bad = json.loads(json.dumps(source)); bad["metadata"]["family"] = "tcn"
        mutations.append(bad)
        for bundle in mutations:
            with self.subTest(bundle=bundle):
                with tempfile.TemporaryDirectory() as directory:
                    path = Path(directory) / "bad.json"
                    path.write_text(json.dumps(bundle))
                    with self.assertRaises(RuntimeError):
                        LinearPredictor(path)

    def test_inference_scales_in_declared_order(self):
        model = LinearPredictor(ASSETS / "rir_model.json")
        values = {name: float(i + 1) for i, name in enumerate(reversed(model.features))}
        expected = ((np.array([values[name] for name in model.features]) - model.mean) / model.scale) @ model.coefficients + model.intercept
        self.assertAlmostEqual(model.estimate(values), float(expected), places=12)
        for broken in ({}, {**values, model.features[0]: float("inf")}):
            with self.assertRaises((KeyError, ValueError)):
                model.estimate(broken)

    def test_signal_predictions_are_unavailable_before_fourth_rep(self):
        model = LinearPredictor(ASSETS / "rir_model.json")
        predictions, metadata = model.predict(
            "unused.mp4", [{"rep": 1}, {"rep": 2}, {"rep": 3}],
            progress=lambda *_: None, cancelled=lambda: False, pose_frames=[],
        )
        self.assertEqual(predictions, [None, None, None])
        self.assertEqual(metadata["rep_quality"], [])


if __name__ == "__main__":
    unittest.main()
