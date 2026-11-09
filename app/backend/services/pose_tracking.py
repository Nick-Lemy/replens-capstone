from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd

from ..config.settings import POSE_MODEL, ROOT
from .motion_features import MotionTracker, motion_pose
from .pose_landmarks import extract_landmarks


def track_pose(path: Path, progress, cancelled, motion_modes=None):
    model_path = POSE_MODEL
    if not model_path.is_file():
        matches = list((ROOT / "training/models").rglob("*heavy*.task"))
        if not matches:
            raise ValueError(
                "Pose annotation model is missing. Run the video review setup first."
            )
        model_path = matches[0]

    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path)),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_poses=1,
    )

    capture = cv2.VideoCapture(str(path))
    fps = capture.get(cv2.CAP_PROP_FPS)
    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))

    if not capture.isOpened() or not np.isfinite(fps) or not 5 <= fps <= 120:
        capture.release()
        raise ValueError("This video could not be decoded. Try a different MP4 or MOV.")
    if total > 10800 or total / fps > 180:
        capture.release()
        raise ValueError("Choose a single set lasting no more than 3 minutes.")

    rows, index, last_timestamp = [], 0, -1
    motion = MotionTracker(motion_modes, fps) if motion_modes else None

    try:
        with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
            while not cancelled():
                ok, frame = capture.read()
                if not ok:
                    break

                timestamp = round(capture.get(cv2.CAP_PROP_POS_MSEC))
                if timestamp <= last_timestamp:
                    raise ValueError(
                        "The video has unsupported frame timing. Try exporting it as a standard MP4."
                    )
                last_timestamp = timestamp
                if timestamp > 180000 or index >= 10800:
                    raise ValueError("Choose a shorter video, up to 3 minutes.")

                h, w = frame.shape[:2]
                if h * w > 17000000:
                    raise ValueError("Video resolution is too large. Export at 1080p.")
                if motion is not None:
                    scale = min(1.0, 1280 / max(frame.shape[:2]))
                    motion_frame = (
                        cv2.resize(
                            frame,
                            None,
                            fx=scale,
                            fy=scale,
                            interpolation=cv2.INTER_AREA,
                        )
                        if scale < 1
                        else frame
                    )
                    gray = cv2.cvtColor(motion_frame, cv2.COLOR_BGR2GRAY)
                if w > 960:
                    frame = cv2.resize(frame, (960, round(h * 960 / w)))

                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pose = detector.detect_for_video(
                    mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), timestamp
                )
                row = extract_landmarks(pose)
                row["time_s"] = timestamp / 1000
                rows.append(row)
                if motion is not None:
                    motion.add(
                        gray,
                        capture.get(cv2.CAP_PROP_POS_MSEC) / 1000,
                        motion_pose(row),
                    )
                index += 1

                if index % 30 == 0:
                    progress_span = 88 if motion else 45
                    progress(
                        5 + min(progress_span, int(index / max(1, total) * progress_span)),
                        (
                            "Finding curls and measuring movement"
                            if motion
                            else "Finding completed curls"
                        ),
                    )
    finally:
        capture.release()

    if cancelled():
        raise ValueError("Analysis cancelled.")
    if not rows:
        raise ValueError("The video contains no readable frames.")

    if motion is not None:
        return pd.DataFrame(rows), fps, motion.tables()
    return pd.DataFrame(rows), fps
