from threading import Lock

from ..config.settings import BUNDLE


class Predictor:
    def __init__(self):
        self.delegate = None
        self.metadata = None
        self.load_lock = Lock()

    def load(self):
        with self.load_lock:
            if self.delegate is not None:
                return
            if not BUNDLE.is_file():
                raise RuntimeError("The prediction model is missing. Rep counting is available.")
            if BUNDLE.suffix == ".json":
                from .linear_predictor import LinearPredictor
                delegate = LinearPredictor(BUNDLE)
            elif BUNDLE.suffix == ".pt":
                import torch
                from .legacy_predictor import Predictor as LegacyPredictor
                torch.set_num_threads(2)
                delegate = LegacyPredictor()
                delegate.load()
            else:
                raise RuntimeError("Unsupported model bundle format.")
            self.metadata = delegate.metadata
            self.delegate = delegate

    def predict(self, path, reps, progress, cancelled, pose_frames=None):
        self.load()
        if self.metadata["family"] == "ridge_speed_transverse":
            if pose_frames is None:
                raise ValueError("Wrist locations are required for the signal model.")
            return self.delegate.predict(path, reps, progress, cancelled, pose_frames)
        return self.delegate.predict(path, reps, progress, cancelled)
