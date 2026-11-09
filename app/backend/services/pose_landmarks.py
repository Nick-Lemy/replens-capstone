import numpy as np


LANDMARKS = {"left": (11, 13, 15), "right": (12, 14, 16)}


def _angle(shoulder: np.ndarray, elbow: np.ndarray, wrist: np.ndarray) -> float:
    a = shoulder - elbow
    b = wrist - elbow
    denominator = np.linalg.norm(a) * np.linalg.norm(b)
    if denominator < 1e-8:
        return np.nan
    cosine = np.clip(np.dot(a, b) / denominator, -1.0, 1.0)
    return float(np.degrees(np.arccos(cosine)))


def extract_landmarks(result) -> dict[str, float]:
    row = {
        key: np.nan
        for key in (
            "left_flexion",
            "right_flexion",
            "left_wrist_x",
            "left_wrist_y",
            "right_wrist_x",
            "right_wrist_y",
            "left_elbow_x",
            "left_elbow_y",
            "right_elbow_x",
            "right_elbow_y",
            "left_upper_arm",
            "right_upper_arm",
            "left_shoulder_x",
            "left_shoulder_y",
            "right_shoulder_x",
            "right_shoulder_y",
            "shoulder_width",
        )
    }
    if not result.pose_landmarks:
        return row

    points = result.pose_landmarks[0]
    shoulders = [points[11], points[12]]
    if min(p.visibility for p in shoulders) >= 0.6:
        row["shoulder_width"] = float(
            np.hypot(
                shoulders[0].x - shoulders[1].x,
                shoulders[0].y - shoulders[1].y,
            )
        )

    for side, indices in LANDMARKS.items():
        shoulder, elbow, wrist = (points[i] for i in indices)
        if min(p.visibility for p in (shoulder, elbow, wrist)) < 0.6:
            continue
        s = np.array([shoulder.x, shoulder.y])
        e = np.array([elbow.x, elbow.y])
        w = np.array([wrist.x, wrist.y])
        row[f"{side}_flexion"] = 180.0 - _angle(s, e, w)
        row[f"{side}_shoulder_x"] = float(s[0])
        row[f"{side}_shoulder_y"] = float(s[1])
        row[f"{side}_wrist_x"] = float(w[0] - s[0])
        row[f"{side}_wrist_y"] = float(w[1] - s[1])
        row[f"{side}_elbow_x"] = float(e[0] - s[0])
        row[f"{side}_elbow_y"] = float(e[1] - s[1])
        row[f"{side}_upper_arm"] = float(np.linalg.norm(e - s))
    return row
