"""Refit the selected signal model and export portable inference coefficients."""

import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


FEATURES = [
    "speed_mean", "speed_p90", "speed_current", "speed_change",
    "transverse_log_rms", "transverse_power_fraction", "transverse_peak_fraction",
]
RUN = "persistent_tremor_20261101T105947439502Z"


def export_demo(root):
    root = Path(root)
    original = root / "training/artifacts" / RUN
    packaged = root / "training/results" / RUN
    source = packaged if (packaged / "deployment_features.csv").exists() else original
    features_path = source / ("deployment_features.csv" if source == packaged else "features.csv")
    table = pd.read_csv(features_path)
    selection = pd.read_csv(source / "inner_selection.csv")
    selection = selection.loc[selection.model.eq("speed_plus_persistent_transverse")]
    if selection.empty or table.empty or table.participant_id.nunique() < 3:
        raise ValueError("Missing reviewed training features or inner-fold selections.")
    if not np.isfinite(table[FEATURES + ["reps_left"]].to_numpy()).all():
        raise ValueError("Training features must be finite.")
    alpha = float(selection.regularization.median())
    weights = (1 / table.groupby("participant_id").participant_id.transform("size")).to_numpy(copy=True)
    weights *= len(weights) / weights.sum()
    pipeline = make_pipeline(StandardScaler(), Ridge(alpha=alpha))
    pipeline.fit(table[FEATURES], table.reps_left, ridge__sample_weight=weights)
    scaler, model = pipeline.steps[0][1], pipeline.steps[1][1]
    comparison = pd.read_csv(source / "comparison.csv").set_index("model")
    metadata = {
        "family": "ridge_speed_transverse", "display_name": "Speed + transverse shaking",
        "version": RUN, "experimental": True, "evaluated_refit": False,
        "participant_mae_reps": float(comparison.loc["speed_plus_persistent_transverse", "mae"]),
        "baseline_participant_mae_reps": float(comparison.loc["speed_only", "mae"]),
        "evaluation_examples": len(table), "evaluation_participants": int(table.participant_id.nunique()),
        "evaluation_scope": "33 quality-filtered examples from four people; exploratory reused test folds",
        "training_reps": len(table), "training_participants": int(table.participant_id.nunique()),
        "preprocessing": "wrist_pixels_speed_v1_persistent_transverse_v3",
        "history_reps": 4, "min_prediction_rep": 4, "minimum_fps": 25,
        "ridge_alpha": alpha, "feature_names": FEATURES,
        "training_features_sha256": hashlib.sha256(features_path.read_bytes()).hexdigest(),
        "limitations": "Candidate video shaking, not validated physiological tremor. One tested person has one usable example. Automatic rep boundaries can differ from reviewed training boundaries.",
    }
    bundle = {"metadata": metadata, "mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(),
              "coefficients": model.coef_.tolist(), "intercept": float(model.intercept_)}
    exported = ((table[FEATURES].to_numpy() - scaler.mean_) / scaler.scale_) @ model.coef_ + model.intercept_
    np.testing.assert_allclose(exported, pipeline.predict(table[FEATURES]), rtol=1e-12, atol=1e-12)
    destination = root / "app/backend/replens/assets/rir_model.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(bundle, indent=2, allow_nan=False) + "\n")
    return destination


if __name__ == "__main__":
    print(export_demo(Path(__file__).resolve().parents[1]))
