import json
import os
from threading import Lock

from ..config.settings import BUNDLE, ROOT

CHOICES = {
    "speed_only": ("ridge_speed_only", ROOT / "app/backend/assets/rir_speed_only.json"),
    "speed_shaking": (
        "ridge_speed_transverse",
        ROOT / "app/backend/assets/rir_model.json",
    ),
}


def resolve_model(choice=None):
    override = os.environ.get("REPLENS_MODEL_PATH")
    if not override:
        return choice or "speed_shaking"
    if not BUNDLE.is_file():
        raise RuntimeError("The configured prediction model is missing.")
    if BUNDLE.suffix == ".pt":
        if choice is not None:
            raise ValueError(
                "The configured legacy model does not match the requested model."
            )
        return "legacy"
    if BUNDLE.suffix != ".json":
        raise RuntimeError("Unsupported model bundle format.")
    try:
        family = json.loads(BUNDLE.read_text())["metadata"]["family"]
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise RuntimeError("The configured prediction model is invalid.") from exc
    selected = next((key for key, (name, _) in CHOICES.items() if name == family), None)
    if selected is None:
        raise RuntimeError("Unsupported configured prediction model family.")
    if choice is not None and choice != selected:
        raise ValueError("The configured model does not match the requested model.")
    return selected


def model_catalog():
    override = bool(os.environ.get("REPLENS_MODEL_PATH"))
    try:
        resolved = resolve_model()
    except (RuntimeError, ValueError):
        resolved = None
    models = []
    for key, (family, path) in CHOICES.items():
        path = BUNDLE if override else path
        available = path.is_file() and (not override or resolved == key)
        if available:
            try:
                from .linear_predictor import LinearPredictor

                available = LinearPredictor(path).metadata.get("family") == family
            except (OSError, ValueError, RuntimeError, KeyError, TypeError):
                available = False
        models.append(
            {
                "id": key,
                "display_name": (
                    "Speed only"
                    if key == "speed_only"
                    else "Speed + transverse shaking"
                ),
                "family": family,
                "experimental": True,
                "available": available,
            }
        )
    return {"default": resolved, "models": models}


class Predictor:
    def __init__(self):
        self.delegates = {}
        self.metadata = None
        self.load_lock = Lock()

    def load(self, model_choice=None):
        choice = model_choice or resolve_model()
        with self.load_lock:
            if choice not in self.delegates:
                path = (
                    BUNDLE
                    if os.environ.get("REPLENS_MODEL_PATH")
                    else CHOICES[choice][1]
                )
                if not path.is_file():
                    raise RuntimeError(
                        "The prediction model is missing. Rep counting is available."
                    )
                if choice == "legacy":
                    import torch
                    from .legacy_predictor import Predictor as LegacyPredictor

                    torch.set_num_threads(2)
                    delegate = LegacyPredictor()
                    delegate.load()
                else:
                    from .linear_predictor import LinearPredictor

                    delegate = LinearPredictor(path)
                    if delegate.metadata.get("family") != CHOICES[choice][0]:
                        raise RuntimeError(
                            "The configured model does not match the requested model."
                        )
                self.delegates[choice] = delegate
            delegate = self.delegates[choice]
            if model_choice is None:
                self.metadata = delegate.metadata
            return delegate

    def predict(
        self, path, reps, progress, cancelled, pose_frames=None, model_choice=None
    ):
        delegate = self.load(model_choice)
        if delegate.metadata["family"] in {
            "ridge_speed_only",
            "ridge_speed_transverse",
        }:
            if pose_frames is None:
                raise ValueError("Wrist locations are required for the signal model.")
            return delegate.predict(path, reps, progress, cancelled, pose_frames)
        return delegate.predict(path, reps, progress, cancelled)
