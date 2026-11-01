import hashlib
import os
from pathlib import Path
from threading import Lock

import cv2
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F
from torchvision.models import resnet18

ROOT = Path(__file__).resolve().parents[3]
BUNDLE = Path(
    os.environ.get("REPLENS_MODEL_PATH", ROOT / "training/models/demo/model.pt")
)


class CausalBlock(nn.Module):
    def __init__(self, channels, dilation):
        super().__init__()
        self.padding = 2 * dilation
        self.conv = nn.Conv1d(channels, channels, 3, dilation=dilation)
        self.dropout = nn.Dropout(0.1)

    def forward(self, values):
        return values + self.dropout(
            F.relu(self.conv(F.pad(values, (self.padding, 0))))
        )


class TemporalRegressor(nn.Module):
    def __init__(self, family, hidden_size):
        super().__init__()
        self.family = family
        self.project = nn.Sequential(
            nn.LayerNorm(512), nn.Linear(512, hidden_size), nn.ReLU()
        )
        self.temporal = (
            nn.Sequential(*[CausalBlock(hidden_size, d) for d in [1, 2, 4, 8, 16]])
            if family == "tcn"
            else nn.LSTM(hidden_size, hidden_size, batch_first=True)
        )
        self.output = nn.Linear(hidden_size, 1)

    def forward(self, values, lengths):
        projected = self.project(values)
        if self.family == "tcn":
            encoded = self.temporal(projected.transpose(1, 2)).transpose(1, 2)
            mask = (
                torch.arange(values.shape[1], device=values.device)[None, :]
                < lengths[:, None]
            )
            pooled = (encoded * mask.unsqueeze(-1)).sum(1) / lengths[:, None]
        else:
            encoded, _ = self.temporal(projected)
            pooled = encoded[
                torch.arange(len(values), device=values.device), lengths - 1
            ]
        return self.output(pooled).squeeze(-1)


def prepare_frame(frame):
    height, width = frame.shape[:2]
    scale = 224 / max(height, width)
    image = cv2.resize(
        cv2.cvtColor(frame, cv2.COLOR_BGR2RGB),
        (max(1, round(width * scale)), max(1, round(height * scale))),
        interpolation=cv2.INTER_AREA,
    )
    canvas = np.empty((224, 224, 3), dtype=np.uint8)
    canvas[:] = [124, 116, 104]
    y, x = (224 - image.shape[0]) // 2, (224 - image.shape[1]) // 2
    canvas[y : y + image.shape[0], x : x + image.shape[1]] = image
    value = torch.from_numpy(canvas).permute(2, 0, 1).float() / 255
    return (value - torch.tensor([0.485, 0.456, 0.406])[:, None, None]) / torch.tensor(
        [0.229, 0.224, 0.225]
    )[:, None, None]


class Predictor:
    def __init__(self):
        self.head = self.encoder = None
        self.metadata = None
        self.delegate = None
        self.load_lock = Lock()

    def load(self):
        with self.load_lock:
            self._load()

    def _load(self):
        if self.head is not None or self.delegate is not None:
            return
        if not BUNDLE.is_file():
            raise RuntimeError(
                "The prediction model is not installed. Rep counting is available."
            )
        bundle = torch.load(BUNDLE, map_location="cpu", weights_only=True)
        self.metadata = bundle["metadata"]
        if self.metadata.get("family") == "r3d_adapter_tcn":
            from .r3d_predictor import R3DPredictor
            self.delegate = R3DPredictor(bundle)
            return
        if self.metadata.get("video_variant", "original") != "original":
            raise RuntimeError("This model requires matching cropped-video preprocessing. The current analyzer uses original framing.")
        if (
            self.metadata.get("preprocessing")
            != "rgb_aspect_pad_224_imagenet_normalization_v1"
        ):
            raise RuntimeError("The model preprocessing version is unsupported.")
        weights = ROOT / "training/models/torch/checkpoints/resnet18-f37072fd.pth"
        if (
            hashlib.sha256(weights.read_bytes()).hexdigest()
            != self.metadata["encoder_weights_sha256"]
        ):
            raise RuntimeError("The video encoder does not match the trained model.")
        encoder = resnet18(weights=None)
        encoder.load_state_dict(
            torch.load(weights, map_location="cpu", weights_only=True)
        )
        encoder.fc = nn.Identity()
        head = TemporalRegressor(self.metadata["family"], self.metadata["hidden_size"])
        head.load_state_dict(bundle["state_dict"])
        self.encoder = encoder.eval().requires_grad_(False)
        self.head = head.eval().requires_grad_(False)

    def predict(self, path, reps, progress, cancelled):
        self.load()
        if self.delegate is not None:
            return self.delegate.predict(path,reps,progress,cancelled)
        metadata = {**self.metadata, "min_prediction_rep": 4}
        if len(reps) < 4:
            return [None] * len(reps), metadata
        capture = cv2.VideoCapture(str(path))
        vectors, times, pending = [], [], []
        total = max(1, int(capture.get(cv2.CAP_PROP_FRAME_COUNT)))
        index = 0
        try:
            with torch.inference_mode():
                while not cancelled():
                    ok, frame = capture.read()
                    if not ok:
                        break
                    timestamp = capture.get(cv2.CAP_PROP_POS_MSEC) / 1000
                    if times and timestamp <= times[-1]:
                        raise ValueError(
                            "Video frame times are irregular. Predictions are unavailable for this clip."
                        )
                    times.append(timestamp)
                    pending.append(prepare_frame(frame))
                    index += 1
                    if len(pending) == 16:
                        vectors.append(self.encoder(torch.stack(pending)).numpy())
                        pending.clear()
                    if index % 60 == 0:
                        progress(
                            55 + min(35, int(index / total * 35)),
                            "Reading video movement",
                        )
                    if timestamp > reps[-1]["end_s"]:
                        break
                if pending:
                    vectors.append(self.encoder(torch.stack(pending)).numpy())
        finally:
            capture.release()
        if cancelled():
            raise ValueError("Analysis cancelled.")
        if not vectors:
            raise ValueError("No readable video frames.")
        features = np.concatenate(vectors)
        times = np.asarray(times)
        result = []
        with torch.inference_mode():
            for i, rep in enumerate(reps):
                if i < 3:
                    result.append(None)
                    continue
                start = reps[max(0, i - 3)]["start_s"]
                selected = features[(times >= start) & (times <= rep["end_s"])]
                if not len(selected):
                    result.append(None)
                    continue
                prediction = float(
                    self.head(
                        torch.from_numpy(selected)[None], torch.tensor([len(selected)])
                    )[0]
                )
                result.append(prediction if np.isfinite(prediction) else None)
        return result, metadata
