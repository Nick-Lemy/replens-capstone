import cv2

LANDMARKS = {"left": (11, 13, 15), "right": (12, 14, 16)}

import numpy as np
import pandas as pd
from scipy.signal import find_peaks, savgol_filter


def _angle(shoulder: np.ndarray, elbow: np.ndarray, wrist: np.ndarray) -> float:
    a = shoulder - elbow
    b = wrist - elbow
    denominator = np.linalg.norm(a) * np.linalg.norm(b)
    if denominator < 1e-8:
        return np.nan
    cosine = np.clip(np.dot(a, b) / denominator, -1.0, 1.0)
    return float(np.degrees(np.arccos(cosine)))


def _landmarks(result, frame_rgb: np.ndarray) -> dict[str, float]:
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
        height, width = frame_rgb.shape[:2]
        for point in (shoulder, elbow, wrist):
            cv2.circle(
                frame_rgb,
                (int(point.x * width), int(point.y * height)),
                6,
                (255, 210, 0),
                -1,
            )
        cv2.line(
            frame_rgb,
            (int(s[0] * width), int(s[1] * height)),
            (int(e[0] * width), int(e[1] * height)),
            (80, 230, 255),
            3,
        )
        cv2.line(
            frame_rgb,
            (int(e[0] * width), int(e[1] * height)),
            (int(w[0] * width), int(w[1] * height)),
            (80, 230, 255),
            3,
        )
    return row


def _smooth(values: pd.Series, fps: float) -> np.ndarray:
    missing_limit = max(1, int(round(0.2 * fps)))
    filled = values.interpolate(limit=missing_limit, limit_area="inside").to_numpy(
        dtype=float
    )
    window = max(5, int(round(0.25 * fps)) | 1)
    if len(filled) < window:
        return filled
    output = np.full_like(filled, np.nan)
    valid = np.isfinite(filled)
    edges = np.diff(np.r_[False, valid, False].astype(int))
    for start, end in zip(np.where(edges == 1)[0], np.where(edges == -1)[0]):
        segment = filled[start:end]
        if len(segment) >= window:
            output[start:end] = savgol_filter(segment, window, 2)
        else:
            output[start:end] = segment
    return output


def detect_reps(frames: pd.DataFrame, fps: float) -> pd.DataFrame:
    """Propose curl cycles from wrist lift; retain uncertainty for human review."""
    times = frames["time_s"].to_numpy(dtype=float)
    signals = {}
    coverage = {}
    for side in ("left", "right"):
        frames[f"{side}_flexion_smooth"] = _smooth(frames[f"{side}_flexion"], fps)
        length = frames[f"{side}_upper_arm"].to_numpy(dtype=float)
        usable_length = length[np.isfinite(length) & (length > 0.02)]
        scale = float(np.median(usable_length)) if len(usable_length) else np.nan
        lift = -frames[f"{side}_wrist_y"] / scale
        signals[side] = _smooth(lift, fps)
        coverage[side] = float(np.isfinite(signals[side]).mean())
        frames[f"{side}_lift_signal"] = signals[side]
    frames["mean_flexion"] = frames[
        ["left_flexion_smooth", "right_flexion_smooth"]
    ].mean(axis=1)
    primary = max(coverage, key=coverage.get)
    other = "right" if primary == "left" else "left"
    signal = signals[primary]
    valid = np.isfinite(signal)
    diagnostics = []
    reps = []
    columns = ["rep", "start_s", "top_s", "end_s", "review_warning"]
    if valid.sum() < 10:
        frames.attrs["diagnostics"] = pd.DataFrame(
            [
                {
                    "time_s": None,
                    "result": "Insufficient visible wrist movement; manual annotation needed",
                }
            ]
        )
        return pd.DataFrame(columns=columns)
    low, high = np.nanpercentile(signal, [10, 90])
    span = high - low
    if span < 0.25:
        frames.attrs["diagnostics"] = pd.DataFrame(
            [
                {
                    "time_s": None,
                    "result": "Insufficient wrist range; manual annotation needed",
                }
            ]
        )
        return pd.DataFrame(columns=columns)
    search = np.where(valid, signal, low - 10 * span)
    peaks, _ = find_peaks(
        search, prominence=max(0.18, 0.25 * span), distance=max(1, int(0.5 * fps))
    )
    for position, peak in enumerate(peaks):

        def note(message):
            diagnostics.append(
                {"time_s": round(float(times[peak]), 2), "result": message}
            )

        left_edge = 0 if position == 0 else int(peaks[position - 1])
        right_edge = (
            len(signal) - 1 if position == len(peaks) - 1 else int(peaks[position + 1])
        )
        missing_before = np.flatnonzero(~np.isfinite(signal[left_edge:peak]))
        if len(missing_before):
            left_edge += int(missing_before[-1]) + 1
        missing_after = np.flatnonzero(~np.isfinite(signal[peak : right_edge + 1]))
        if len(missing_after):
            right_edge = peak + int(missing_after[0]) - 1
        before = signal[left_edge : peak + 1]
        after = signal[peak : right_edge + 1]
        if not np.isfinite(before).any() or not np.isfinite(after).any():
            note("Needs manual annotation: incomplete tracking around movement")
            continue
        tolerance = 0.06 * span
        before_bottom = np.nanmin(before)
        after_bottom = np.nanmin(after)
        starts = np.flatnonzero(
            np.isfinite(before) & (before <= before_bottom + tolerance)
        )
        ends = np.flatnonzero(np.isfinite(after) & (after <= after_bottom + tolerance))
        start = left_edge + int(starts[-1])
        end = peak + int(ends[0])
        if not start < peak < end:
            note("Rejected: incomplete up-and-down cycle")
            continue
        if times[peak] - times[start] < 0.15 or times[end] - times[peak] < 0.15:
            note("Rejected: brief tracking spike")
            continue
        if min(signal[peak] - signal[start], signal[peak] - signal[end]) < max(
            0.25, 0.55 * span
        ):
            note("Rejected: partial movement below the recording's typical range")
            continue
        if max(signal[start], signal[end]) > low + 0.3 * span:
            note("Rejected: no clear return to bottom")
            continue
        if np.isfinite(signal[start : end + 1]).mean() < 0.75:
            note("Needs manual annotation: primary wrist missing")
            continue
        bend = (
            frames[f"{primary}_flexion_smooth"]
            .iloc[start : end + 1]
            .to_numpy(dtype=float)
        )
        if (
            np.isfinite(bend).sum() >= 5
            and np.nanpercentile(bend, 90) - np.nanpercentile(bend, 10) < 25
        ):
            note("Rejected: wrist motion without clear elbow flexion")
            continue
        warnings = []
        if times[end] - times[start] > 20:
            warnings.append("long cycle")
        other_segment = signals[other][start : end + 1]
        if np.isfinite(other_segment).mean() < 0.65:
            warnings.append(f"{other} arm partly occluded")
        else:
            other_peak = start + int(np.nanargmax(other_segment))
            if abs(times[other_peak] - times[peak]) > 0.6:
                warnings.append("check arm synchronization")
        if np.isfinite(signal[start : end + 1]).mean() < 0.95:
            warnings.append("short tracking gaps")
        reps.append(
            {
                "rep": len(reps) + 1,
                "start_s": round(float(times[start]), 2),
                "top_s": round(float(times[peak]), 2),
                "end_s": round(float(times[end]), 2),
                "review_warning": "; ".join(warnings),
            }
        )
        note(
            f"Suggested rep {len(reps)}"
            + (f" — {'; '.join(warnings)}" if warnings else "")
        )
    frames.attrs["diagnostics"] = pd.DataFrame(
        diagnostics, columns=["time_s", "result"]
    )
    return pd.DataFrame(reps, columns=columns)
