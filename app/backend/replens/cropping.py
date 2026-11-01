import json
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np


def whole_lifter_crop(path: Path, model_path: Path, progress, cancelled):
    capture = cv2.VideoCapture(str(path))
    count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = capture.get(cv2.CAP_PROP_FPS)
    if count < 1 or not np.isfinite(fps) or fps <= 0:
        capture.release()
        raise ValueError("Cannot read video dimensions and timing.")
    indices = np.unique(np.linspace(0, count - 1, min(65, max(12, int(count / fps * 2)))).astype(int))
    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path)),
        running_mode=mp.tasks.vision.RunningMode.IMAGE, num_poses=1,
    )
    points, arm_lengths = [], []
    tracked = 0
    width = height = None
    try:
        with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
            for index in indices:
                if cancelled():
                    raise ValueError("Analysis cancelled.")
                capture.set(cv2.CAP_PROP_POS_FRAMES, int(index))
                ok, frame = capture.read()
                if not ok:
                    continue
                height, width = frame.shape[:2]
                scale = min(1, 960 / max(width, height))
                image = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), (round(width * scale), round(height * scale)))
                result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=image))
                if not result.pose_landmarks:
                    continue
                pose = result.pose_landmarks[0]
                if min(pose[11].visibility, pose[12].visibility) < .5:
                    continue
                tracked += 1
                for point in pose:
                    if point.visibility >= .55 and point.presence >= .55 and -.1 <= point.x <= 1.1 and -.1 <= point.y <= 1.1:
                        points.append([point.x * width, point.y * height])
                for elbow, wrist in [(13, 15), (14, 16)]:
                    if min(pose[elbow].visibility, pose[wrist].visibility) > .6:
                        arm_lengths.append(float(np.hypot((pose[elbow].x-pose[wrist].x)*width, (pose[elbow].y-pose[wrist].y)*height)))
                progress(56 + int(np.searchsorted(indices,index)/len(indices)*6), "Framing the lifter")
    finally:
        capture.release()
    if width is None:
        raise ValueError("No readable frames for cropping.")
    if tracked < max(4, len(indices)*.35) or len(points) < 20:
        return [0, 0, width//2*2, height//2*2], "full_frame_low_visibility"
    points = np.asarray(points)
    margin = max(.04*width, .07*height, np.median(arm_lengths)*.8 if arm_lengths else 0)
    x1=max(0,int(points[:,0].min()-margin));x2=min(width,int(points[:,0].max()+margin))
    y1=max(0,int(points[:,1].min()-margin*.55));y2=min(height,int(points[:,1].max()+margin*.55))
    if (x2-x1)*(y2-y1)/(width*height) > .93:
        x1,y1,x2,y2=0,0,width,height
    x1,y1,x2,y2=[v//2*2 for v in [x1,y1,x2,y2]]
    x1=max(0,int(x1-.02*width));x2=min(width,int(x2+.02*width))
    y1=max(0,int(y1-max(.06*height,.1*(y2-y1))));y2=min(height,int(y2+.03*height))
    if (x2-x1)*(y2-y1)/(width*height) > .95:
        x1,y1,x2,y2=0,0,width,height
    return [v//2*2 for v in [x1,y1,x2,y2]], "whole_lifter_crop"


def input_crop(path, root, digest, progress, cancelled):
    exports = root / "training/data/review/whole_lifter_crops/exports.json"
    if exports.is_file():
        for record in json.loads(exports.read_text()):
            if record["output_sha256"] == digest:
                return [0,0,record["output_width"],record["output_height"]], "verified_cropped_input"
            if record["source_sha256"] == digest:
                return record["rect"], "verified_source_crop"
    return whole_lifter_crop(path, root/"training/models/pose_landmarker_heavy.task", progress, cancelled)
