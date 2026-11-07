"""Shared image-motion features for notebook experiments and app inference."""

from pathlib import Path
import hashlib
import json

import cv2
import numpy as np
import pandas as pd
from scipy.signal import butter, sosfiltfilt, welch


def tremor_hash(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _grouped_flow_vectors(previous, current, groups):
    empty = (np.empty((0, 2)), np.empty((0, 2)))
    outputs = {key: empty for key in groups}
    active = []
    boundaries = []
    total = 0
    for key, points in groups.items():
        if points is None or len(points) < 5:
            continue
        active.append(points.reshape(-1, 2))
        boundaries.append((key, total, total + len(points)))
        total += len(points)
    if not active:
        return outputs

    points = np.concatenate(active).reshape(-1, 1, 2).astype(np.float32)
    q, ok, _ = cv2.calcOpticalFlowPyrLK(
        previous, current, points, None, winSize=(21, 21), maxLevel=3
    )
    if q is None:
        return outputs
    back, back_ok, _ = cv2.calcOpticalFlowPyrLK(
        current, previous, q, None, winSize=(21, 21), maxLevel=3
    )
    if back is None:
        return outputs

    p = points.reshape(-1, 2)
    q = q.reshape(-1, 2)
    valid = ok.ravel().astype(bool) & back_ok.ravel().astype(bool)
    valid &= np.isfinite(q).all(1) & (
        np.linalg.norm(back.reshape(-1, 2) - p, axis=1) < 1.0
    )
    for key, start, end in boundaries:
        outputs[key] = p[start:end][valid[start:end]], q[start:end][valid[start:end]]
    return outputs


SIDES = ("left", "right")
# Each row has shoulder, elbow and wrist x/y pairs for each side.
POSE_COLUMNS = [
    f"{side}_{joint}_{axis}"
    for side in SIDES
    for joint in ("shoulder", "elbow", "wrist")
    for axis in ("x", "y")
]
POSE_PAIR = {
    (side, joint): slice(2 * index, 2 * index + 2)
    for index, (side, joint) in enumerate(
        (side, joint) for side in SIDES for joint in ("shoulder", "elbow", "wrist")
    )
}


def _background_points(previous, previous_pose):
    h, w = previous.shape
    points = []
    for side in SIDES:
        for joint in ("shoulder", "elbow", "wrist"):
            xy = previous_pose[POSE_PAIR[side, joint]] * [w, h]
            if np.isfinite(xy).all():
                points.append(xy)
    mask = np.full(previous.shape, 255, np.uint8)
    if len(points) >= 3:
        p = np.asarray(points)
        lo = np.maximum(p.min(0) - 0.12 * np.array([w, h]), 0).astype(int)
        hi = np.minimum(p.max(0) + 0.12 * np.array([w, h]), [w - 1, h - 1]).astype(int)
        cv2.rectangle(mask, tuple(lo), tuple(hi), 0, -1)
    return cv2.goodFeaturesToTrack(
        previous, maxCorners=160, qualityLevel=0.02, minDistance=12, mask=mask
    )


def _background_camera(previous_pose, shape, p, q):
    h, w = shape
    affine = None
    inlier_fraction = 0.0
    noise = np.nan
    if len(p) >= 12:
        affine, inliers = cv2.estimateAffinePartial2D(
            p, q, method=cv2.RANSAC, ransacReprojThreshold=1.5
        )
        if affine is not None:
            inlier_fraction = float(inliers.mean())
            noise = float(
                np.median(
                    np.linalg.norm(q - (p @ affine[:, :2].T + affine[:, 2]), axis=1)
                )
            )
    shoulder = (
        previous_pose[POSE_PAIR["left", "shoulder"]]
        - previous_pose[POSE_PAIR["right", "shoulder"]]
    ) * [w, h]
    return affine, inlier_fraction, noise, float(np.linalg.norm(shoulder))


def _wrist_points(previous, previous_pose, width, side, persistent, tracked):
    h, w = previous.shape
    xy = previous_pose[POSE_PAIR[side, "wrist"]] * [w, h]
    if (
        not np.isfinite(width)
        or width < 20
        or not np.isfinite(xy).all()
        or not (0 <= xy[0] < w and 0 <= xy[1] < h)
    ):
        return None
    region = np.zeros(previous.shape, np.uint8)
    cv2.circle(region, tuple(xy.astype(int)), max(12, int(0.25 * width)), 255, -1)
    target = tracked if persistent else None
    if target is not None:
        distance = np.linalg.norm(target.reshape(-1, 2) - xy, axis=1)
        target = target[distance < max(25, 0.6 * width)]
    if target is None or len(target) < 8:
        target = cv2.goodFeaturesToTrack(
            previous,
            maxCorners=(60 if persistent else 40),
            qualityLevel=0.01,
            minDistance=3,
            mask=region,
        )
    return target


def _track_wrists(affine, inlier_fraction, persistent, tracked, item, flows):
    for side in SIDES:
        item[f"{side}_dx"] = item[f"{side}_dy"] = np.nan
        if affine is None or inlier_fraction < 0.5:
            tracked[side] = None
            continue
        p, q = flows[persistent, side]
        if persistent:
            tracked[side] = (
                q.reshape(-1, 1, 2).astype(np.float32) if len(q) >= 5 else None
            )
        if len(p) >= 5:
            residual = q - (p @ affine[:, :2].T + affine[:, 2])
            displacement = np.median(residual, axis=0)
            item[f"{side}_dx"], item[f"{side}_dy"] = displacement


def pixel_motion(
    video, pose_path, output=None, persistent=False, progress=None, cancelled=None
):
    pose_is_table = isinstance(pose_path, pd.DataFrame)
    pose = pose_path.copy() if pose_is_table else pd.read_csv(pose_path)
    pose.attrs.clear()
    if output is not None:
        output = Path(output)
        if pose_is_table:
            raise ValueError("Persistent caches require a source pose CSV.")
        contract = {
            "method": (
                "persistent_median_v3"
                if persistent
                else "wrist_roi_lk_affine_camera_v1"
            ),
            "max_dimension": 1280,
            "source_sha256": tremor_hash(video),
            "pose_sha256": tremor_hash(pose_path),
        }
        metadata = output.with_suffix(".json")
        if (
            output.exists()
            and metadata.exists()
            and json.loads(metadata.read_text()) == contract
        ):
            return pd.read_csv(output)
    table = _pixel_motion_modes(video, pose, (persistent,), progress, cancelled)[
        persistent
    ]
    if output is not None:
        table.to_csv(output, index=False)
        metadata.write_text(json.dumps(contract, indent=2))
    return table


def pixel_motion_dual(video, pose_path, progress=None, cancelled=None):
    pose = (
        pose_path.copy()
        if isinstance(pose_path, pd.DataFrame)
        else pd.read_csv(pose_path)
    )
    pose.attrs.clear()
    tables = _pixel_motion_modes(video, pose, (False, True), progress, cancelled)
    return tables[False], tables[True]


def _pixel_motion_modes(video, pose, modes, progress, cancelled):
    if True in modes:
        cv2.setRNGSeed(42)
    for side in ("left", "right"):
        for joint in ("wrist", "elbow"):
            for axis in ("x", "y"):
                pose[f"{side}_{joint}_{axis}"] += pose[f"{side}_shoulder_{axis}"]
    capture = cv2.VideoCapture(str(video))
    fps = capture.get(cv2.CAP_PROP_FPS)
    if fps < 25:
        capture.release()
        raise ValueError(
            "Small-movement analysis needs at least 25 frames per second. Try a 30 fps video."
        )
    rows = {mode: [] for mode in modes}
    previous = None
    previous_time = None
    previous_pose = None
    tracked = {mode: {side: None for side in SIDES} for mode in modes}
    pose_times = pose.time_s.to_numpy()
    pose_values = pose[POSE_COLUMNS].to_numpy(float)
    try:
        while True:
            if cancelled is not None and cancelled():
                raise ValueError("Analysis cancelled.")
            ok, frame = capture.read()
            if not ok:
                break
            time = capture.get(cv2.CAP_PROP_POS_MSEC) / 1000
            if (
                progress is not None
                and int(capture.get(cv2.CAP_PROP_POS_FRAMES)) % 60 == 0
            ):
                progress(
                    min(
                        1.0,
                        capture.get(cv2.CAP_PROP_POS_FRAMES)
                        / max(1, capture.get(cv2.CAP_PROP_FRAME_COUNT)),
                    )
                )
            scale = min(1.0, 1280 / max(frame.shape[:2]))
            if scale < 1:
                frame = cv2.resize(
                    frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA
                )
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            h, w = gray.shape
            index = int(np.searchsorted(pose_times, time))
            options = [i for i in (index - 1, index) if 0 <= i < len(pose)]
            index = min(options, key=lambda i: abs(pose_times[i] - time))
            current_pose = (
                pose_values[index]
                if abs(pose_times[index] - time) <= 1.5 / fps
                else None
            )
            if (
                previous is not None
                and previous_pose is not None
                and 0 < time - previous_time < 1.5 / fps
            ):
                h, w = gray.shape
                shoulders = (
                    previous_pose[POSE_PAIR["left", "shoulder"]]
                    - previous_pose[POSE_PAIR["right", "shoulder"]]
                ) * [w, h]
                width = float(np.linalg.norm(shoulders))
                groups = {"background": _background_points(previous, previous_pose)}
                for persistent in modes:
                    for side in SIDES:
                        groups[persistent, side] = _wrist_points(
                            previous,
                            previous_pose,
                            width,
                            side,
                            persistent,
                            tracked[persistent][side],
                        )
                flows = _grouped_flow_vectors(previous, gray, groups)
                affine, inlier_fraction, noise, width = _background_camera(
                    previous_pose, gray.shape, *flows["background"]
                )
                for persistent in modes:
                    item = {
                        "time_s": time,
                        "dt": time - previous_time,
                        "shoulder_px": width,
                        "camera_inliers": inlier_fraction,
                        "background_error_px": noise,
                    }
                    _track_wrists(
                        affine,
                        inlier_fraction,
                        persistent,
                        tracked[persistent],
                        item,
                        flows,
                    )
                    rows[persistent].append(item)
            else:
                tracked = {mode: {side: None for side in SIDES} for mode in modes}
            previous, previous_time, previous_pose = gray, time, current_pose
    finally:
        capture.release()
    return {mode: pd.DataFrame(rows[mode]) for mode in modes}


def candidate_features(flow, start, end, rep_start):
    if flow.empty or 'time_s' not in flow:
        return None, 'no usable wrist/camera tracking'
    part = flow.loc[flow.time_s.between(start, end)].copy()
    if len(part) < 60:
        return None, 'less than two seconds of tracking'
    dt = float(np.median(part.dt))
    fs = 1 / dt
    if fs < 25 or part.dt.max() > 1.5 * dt or np.max(np.diff(part.time_s)) > 1.5 * dt:
        return None, 'irregular or interrupted frame times'
    coverage = {
        s: float(part[[f'{s}_dx', f'{s}_dy']].notna().all(axis=1).mean())
        for s in ('left', 'right')
    }
    side = max(coverage, key=coverage.get)
    if coverage[side] < 0.85:
        return None, 'less than 85% valid wrist/camera tracking'
    xy = part[[f'{side}_dx', f'{side}_dy']]
    missing = xy.isna().any(axis=1).to_numpy()
    longest = current = 0
    for absent in missing:
        current = current + 1 if absent else 0
        longest = max(longest, current)
    if longest > 2 or missing[0] or missing[-1]:
        return None, 'tracking gap exceeds two frames or reaches an edge'
    xy = xy.interpolate(limit=2).to_numpy(float)
    width = float(part.shoulder_px.median())
    if not np.isfinite(width) or width < 20 or not np.isfinite(xy).all():
        return None, 'invalid image scale or unfilled tracking gap'
    velocity = xy / (part.dt.to_numpy()[:, None] * width)
    smooth = sosfiltfilt(butter(3, 3, fs=fs, output='sos'), velocity, axis=0)
    speed = np.linalg.norm(smooth, axis=1)

    f, power = welch(
        velocity,
        fs=fs,
        nperseg=min(len(velocity), int(2 * fs)),
        axis=0,
        detrend='linear',
    )
    power = power.sum(axis=1)
    band = (f >= 4) & (f <= 10)
    broad = (f >= 0.5) & (f <= 12)
    displacement_power = power[band] / (2 * np.pi * f[band]) ** 2
    band_power = float(np.trapezoid(power[band], f[band]))
    total_power = float(np.trapezoid(power[broad], f[broad]))
    tremor_rms = float(np.sqrt(max(0, np.trapezoid(displacement_power, f[band]))))
    current_rep = part.time_s.to_numpy() >= rep_start

    result = {
        'speed_mean': float(speed.mean()),
        'speed_p90': float(np.quantile(speed, 0.9)),
        'speed_current': float(speed[current_rep].mean()),
        'speed_change': float(
            speed[-max(1, len(speed) // 4) :].mean()
            - speed[: max(1, len(speed) // 4)].mean()
        ),
        'candidate_log_rms': float(np.log10(tremor_rms + 1e-8)),
        'candidate_power_fraction': band_power / (total_power + 1e-12),
        'candidate_peak_fraction': float(
            power[band].max() / (power[band].sum() + 1e-12)
        ),
        'peak_hz': float(f[band][np.argmax(power[band])]),
        'tracking_coverage': coverage[side],
        'background_error_px': float(part.background_error_px.median()),
        'side': side,
        'fps': fs,
    }
    if not all(np.isfinite(v) for v in result.values() if not isinstance(v, str)):
        return None, 'nonfinite signal'
    return result, None


def transverse_shaking(flow, start, end, rep_start):
    basic, reason = candidate_features(flow, start, end, rep_start)
    if basic is None:
        return None, reason
    part = flow.loc[flow.time_s.between(start, end)].copy()
    side = basic['side']
    dt = float(np.median(part.dt))
    fs = 1 / dt
    values = part[[f'{side}_dx', f'{side}_dy']].interpolate(limit=2).to_numpy(float)
    velocity = values / (part.dt.to_numpy()[:, None] * float(part.shoulder_px.median()))

    # Resample small timestamp jitter before spectral analysis.
    times = part.time_s.to_numpy()
    grid = np.arange(times[0], times[-1], dt)
    velocity = np.column_stack(
        [np.interp(grid, times, velocity[:, i]) for i in range(2)]
    )

    slow = sosfiltfilt(butter(3, 1.5, fs=fs, output='sos'), velocity, axis=0)
    eigenvalues, axes = np.linalg.eigh(np.cov(slow.T))
    if eigenvalues[-1] < 1e-10:
        return None, 'no stable main movement axis'

    transverse = velocity @ axes[:, 0]
    f, power = welch(
        transverse, fs=fs, nperseg=min(len(transverse), int(2 * fs)), detrend='linear'
    )
    band = (f >= 4) & (f <= 10)
    broad = (f >= 0.5) & (f <= 12)
    rms = float(
        np.sqrt(max(0, np.trapezoid(power[band] / (2 * np.pi * f[band]) ** 2, f[band])))
    )
    features = {
        'persistent_log_rms': basic['candidate_log_rms'],
        'persistent_power_fraction': basic['candidate_power_fraction'],
        'persistent_peak_fraction': basic['candidate_peak_fraction'],
        'transverse_log_rms': float(np.log10(rms + 1e-8)),
        'transverse_power_fraction': float(
            np.trapezoid(power[band], f[band])
            / (np.trapezoid(power[broad], f[broad]) + 1e-12)
        ),
        'transverse_peak_fraction': float(
            power[band].max() / (power[band].sum() + 1e-12)
        ),
        'transverse_peak_hz': float(f[band][power[band].argmax()]),
        'persistent_coverage': basic['tracking_coverage'],
    }
    if not all(np.isfinite(v) for v in features.values()):
        return None, 'nonfinite stabilized signal'
    return features, None
