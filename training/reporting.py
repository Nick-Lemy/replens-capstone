"""Metrics and figures computed from saved held-out predictions."""

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    balanced_accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    log_loss,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)

RUNS = {
    "original": "pilot_20261030T154433983651Z",
    "cropped": "pilot_20261030T173732179337Z",
    "learning_check": "learning_check_20261030T175736034664Z",
    "adaptation": "r3d_adaptation_20261030T180126927110Z",
    "history": "r3d_history_20261030T183202356628Z",
    "personalization": "personalization_20261101T094914054252Z",
    "classification": "near_failure_20261101T100858193667Z",
    "shaking": "candidate_tremor_20261101T103627645167Z",
    "persistent": "persistent_tremor_20261101T105947439502Z",
}

LABELS = {
    "training_median": "Training median",
    "lstm": "ResNet + LSTM",
    "tcn": "ResNet + TCN",
    "r3d_frozen_tcn": "Frozen R3D + TCN",
    "r3d_adapter_tcn": "Adapted R3D · last 4 reps",
    "r3d_adapter_tcn_prefix": "Adapted R3D · all previous reps",
    "general_r3d": "General video model",
    "personal_bias": "Personal offset",
    "personal_ridge_head": "Personal ridge head",
    "calibration_median": "Calibration median",
    "previous_set_capacity": "Previous set capacity",
    "always_far": "Always farther from failure",
    "always_near": "Always near failure",
    "duration_logistic": "Rep durations",
    "video_logistic": "Video features",
    "video_duration_logistic": "Video + rep durations",
    "r3d_warning": "Adapted R3D classifier",
    "existing_rir_threshold_2": "Existing RIR ≤ 2 rule",
    "speed_only": "Speed only",
    "speed_plus_candidate_tremor": "Speed + original shaking",
    "speed_plus_original_shaking": "Speed + original shaking",
    "speed_plus_persistent_2d": "Speed + persistent 2D shaking",
    "speed_plus_persistent_transverse": "Speed + transverse shaking",
}


def result_folder(root, run):
    name = RUNS.get(run, run)
    local = Path(root) / "training/artifacts" / name
    return (
        local
        if (local / "predictions.csv").is_file()
        else Path(root) / "training/results" / name
    )


def load_predictions(root, run, condition=None, direction=None):
    folder = result_folder(root, run)
    table = pd.read_csv(folder / "predictions.csv")
    if direction is not None:
        table = table.loc[table.direction.eq(direction)].copy()
        if "model" not in table:
            table = table.rename(columns={"method": "model", "test_video": "video_id"})
    if "seed" not in table:
        table["seed"] = 42
    table["condition"] = condition or run
    table["source_run"] = folder.name
    if table.empty or not np.isfinite(table.reps_left).all():
        raise ValueError(f"Missing/invalid predictions: {folder.name}")
    return table.reset_index(drop=True)


def assert_matched_examples(table):
    expected = None
    for _, group in table.groupby(["condition", "model", "seed"], sort=False):
        keys = ["participant_id", "video_id", "rep"]
        if group.duplicated(keys).any():
            raise ValueError("Repeated held-out examples in one model/seed.")
        values = group[keys + ["reps_left"]].sort_values(keys).reset_index(drop=True)
        if expected is None:
            expected = values
        else:
            pd.testing.assert_frame_equal(expected, values, check_dtype=False)
    return len(expected)


def regression_report(table):
    if not np.isfinite(table.prediction).all():
        raise ValueError("Nonfinite regression predictions.")
    rows = []
    for (condition, model, seed, person), group in table.groupby(
        ["condition", "model", "seed", "participant_id"]
    ):
        error = group.prediction.to_numpy() - group.reps_left.to_numpy()
        absolute = np.abs(error)
        r2 = (
            r2_score(group.reps_left, group.prediction)
            if len(group) > 1 and group.reps_left.nunique() > 1
            else np.nan
        )
        rows.append(
            {
                "condition": condition,
                "model": model,
                "seed": seed,
                "participant_id": person,
                "examples": len(group),
                "mae": absolute.mean(),
                "rmse": np.sqrt(np.mean(error**2)),
                "within_1": np.mean(absolute <= 1),
                "within_2": np.mean(absolute <= 2),
                "bias": error.mean(),
                "r2": r2,
            }
        )
    people = pd.DataFrame(rows)
    metrics = ["mae", "rmse", "within_1", "within_2", "bias", "r2"]
    seeds = people.groupby(["condition", "model", "seed"])[metrics].mean().reset_index()
    summary = seeds.groupby(["condition", "model"])[metrics].mean()
    summary["mae_seed_sd"] = (
        seeds.groupby(["condition", "model"]).mae.std(ddof=1).fillna(0)
    )
    summary["seeds"] = seeds.groupby(["condition", "model"]).size()
    counts = people.groupby(["condition", "model", "seed"]).agg(
        examples=("examples", "sum"),
        people=("participant_id", "nunique"),
        r2_people=("r2", "count"),
    )
    if (
        counts.groupby(["condition", "model"])[["examples", "people"]]
        .nunique()
        .gt(1)
        .any()
        .any()
    ):
        raise ValueError("Unequal seed evaluation cohorts.")
    summary = summary.join(counts.groupby(["condition", "model"]).first()).reset_index()
    return summary, people


def classification_report(table):
    rows = []
    for (condition, model, seed, person), group in table.groupby(
        ["condition", "model", "seed", "participant_id"]
    ):
        truth = group.reps_left.le(2).to_numpy(int)
        probability = group.probability_near.to_numpy(float)
        if (
            not np.isfinite(probability).all()
            or ((probability < 0) | (probability > 1)).any()
        ):
            raise ValueError("Invalid classification probabilities.")
        if len(np.unique(truth)) != 2:
            raise ValueError(
                "Participant-balanced classification requires both classes per person."
            )
        guess = probability >= 0.5
        tn, fp, fn, tp = confusion_matrix(truth, guess, labels=[0, 1]).ravel()
        weights = np.where(
            truth == 1,
            len(truth) / (2 * truth.sum()),
            len(truth) / (2 * (len(truth) - truth.sum())),
        )
        rows.append(
            {
                "condition": condition,
                "model": model,
                "seed": seed,
                "participant_id": person,
                "examples": len(group),
                "balanced_accuracy": balanced_accuracy_score(truth, guess),
                "precision": precision_score(truth, guess, zero_division=0),
                "recall": recall_score(truth, guess, zero_division=0),
                "specificity": tn / (tn + fp),
                "f1": f1_score(truth, guess, zero_division=0),
                "accuracy": np.mean(truth == guess),
                "average_precision": average_precision_score(truth, probability),
                "roc_auc": roc_auc_score(truth, probability),
                "brier": brier_score_loss(truth, probability),
                "balanced_log_loss": log_loss(
                    truth,
                    np.clip(probability, 1e-7, 1 - 1e-7),
                    sample_weight=weights,
                    labels=[0, 1],
                ),
                "tn": tn,
                "fp": fp,
                "fn": fn,
                "tp": tp,
            }
        )
    people = pd.DataFrame(rows)
    metrics = [
        "balanced_accuracy",
        "precision",
        "recall",
        "specificity",
        "f1",
        "accuracy",
        "average_precision",
        "roc_auc",
        "brier",
        "balanced_log_loss",
    ]
    seeds = people.groupby(["condition", "model", "seed"])[metrics].mean().reset_index()
    summary = seeds.groupby(["condition", "model"])[metrics].mean()
    summary["balanced_accuracy_seed_sd"] = (
        seeds.groupby(["condition", "model"]).balanced_accuracy.std().fillna(0)
    )
    summary["seeds"] = seeds.groupby(["condition", "model"]).size()
    counts = people.groupby(["condition", "model", "seed"]).agg(
        examples=("examples", "sum"), people=("participant_id", "nunique")
    )
    summary = summary.join(counts.groupby(["condition", "model"]).first()).reset_index()
    return summary, people


def metrics_table(summary, classification=False):
    table = summary.copy()
    table["model"] = table.model.map(lambda name: LABELS.get(name, name))
    if classification:
        columns = [
            "condition",
            "model",
            "examples",
            "people",
            "seeds",
            "balanced_accuracy",
            "precision",
            "recall",
            "specificity",
            "f1",
            "average_precision",
            "roc_auc",
            "brier",
        ]
    else:
        columns = [
            "condition",
            "model",
            "examples",
            "people",
            "seeds",
            "mae",
            "mae_seed_sd",
            "rmse",
            "within_1",
            "within_2",
            "bias",
            "r2",
            "r2_people",
        ]
    return table[columns].round(3)


def plot_errors(summary, title, path=None):
    labels = [
        f"{row.condition} · {LABELS.get(row.model, row.model)}"
        for row in summary.itertuples()
    ]
    figure, axis = plt.subplots(figsize=(11, max(3, 0.46 * len(labels) + 1)))
    bars = axis.barh(
        labels, summary.mae, xerr=summary.mae_seed_sd, color="#52677d", capsize=3
    )
    axis.invert_yaxis()
    for bar, value, spread in zip(bars, summary.mae, summary.mae_seed_sd):
        axis.text(
            bar.get_width() + spread + 0.05,
            bar.get_y() + bar.get_height() / 2,
            f"{value:.2f}",
            va="center",
            fontsize=9,
        )
    axis.set(
        xlabel="Participant-mean absolute RIR error (reps; lower is better)",
        title=title,
    )
    axis.set_xlim(0, max(summary.mae + summary.mae_seed_sd) * 1.2)
    axis.spines[["top", "right"]].set_visible(False)
    figure.tight_layout()
    if path is not None:
        figure.savefig(path, dpi=180, bbox_inches="tight")
    return figure


def plot_participants(people, title, path=None):
    matrix = people.groupby(["model", "participant_id"]).mae.mean().unstack()
    figure, axis = plt.subplots(figsize=(8, max(3, 0.55 * len(matrix) + 1)))
    artist = axis.imshow(matrix, cmap="YlOrRd", aspect="auto", vmin=0)
    axis.set_yticks(
        range(len(matrix)), [LABELS.get(name, name) for name in matrix.index]
    )
    counts = people.groupby("participant_id").examples.first()
    axis.set_xticks(
        range(len(matrix.columns)),
        [
            f"{p}\n{counts[p]} {'example' if counts[p] == 1 else 'examples'}"
            for p in matrix.columns
        ],
    )
    for i in range(len(matrix)):
        for j in range(len(matrix.columns)):
            color = (
                "white"
                if matrix.iloc[i, j] > 0.65 * np.nanmax(matrix.to_numpy())
                else "black"
            )
            axis.text(
                j, i, f"{matrix.iloc[i,j]:.2f}", ha="center", va="center", color=color
            )
    axis.set_title(title)
    figure.colorbar(artist, ax=axis, label="RIR MAE (reps)")
    figure.tight_layout()
    if path is not None:
        figure.savefig(path, dpi=180, bbox_inches="tight")
    return figure


def plot_diagnostics(table, model, path=None):
    group = table.loc[table.model.eq(model)]
    seed = sorted(group.seed.unique())[0]
    group = group.loc[group.seed.eq(seed)]
    figure, axes = plt.subplots(1, 2, figsize=(10, 3.7))
    axes[0].scatter(
        group.reps_left, group.prediction, s=17, alpha=0.65, color="#52677d"
    )
    limit = max(group.reps_left.max(), group.prediction.max()) + 1
    axes[0].plot([0, limit], [0, limit], "--", color="gray", linewidth=1)
    axes[0].set(
        xlabel="Known RIR",
        ylabel="Predicted RIR",
        title=f"{LABELS.get(model, model)} · seed {seed}",
    )
    axes[1].scatter(
        group.reps_left,
        group.prediction - group.reps_left,
        s=17,
        alpha=0.65,
        color="#52677d",
    )
    axes[1].axhline(0, color="gray", linestyle="--", linewidth=1)
    axes[1].set(
        xlabel="Known RIR",
        ylabel="Prediction − known RIR",
        title="Positive = overprediction",
    )
    figure.tight_layout()
    if path is not None:
        figure.savefig(path, dpi=180, bbox_inches="tight")
    return figure


def plot_warnings(summary, table, model="video_duration_logistic", path=None):
    figure, axes = plt.subplots(
        1, 2, figsize=(12, 4.7), gridspec_kw={"width_ratios": [1.8, 1]}
    )
    labels = [LABELS.get(name, name) for name in summary.model]
    axes[0].barh(labels, summary.balanced_accuracy, color="#52677d")
    axes[0].axvline(0.5, color="#a04b42", linestyle="--", label="Constant baseline")
    axes[0].invert_yaxis()
    axes[0].set(xlim=(0, 1), xlabel="Participant-mean balanced accuracy")
    axes[0].legend(loc="lower right", fontsize=8)
    group = table.loc[table.model.eq(model)]
    seed = sorted(group.seed.unique())[0]
    group = group.loc[group.seed.eq(seed)]
    matrix = confusion_matrix(
        group.reps_left.le(2), group.probability_near.ge(0.5), labels=[False, True]
    )
    axes[1].imshow(matrix, cmap="Blues")
    for i in range(2):
        for j in range(2):
            color = "white" if matrix[i, j] > matrix.max() / 2 else "black"
            axes[1].text(
                j,
                i,
                str(matrix[i, j]),
                ha="center",
                va="center",
                fontsize=15,
                color=color,
            )
    axes[1].set(
        xticks=[0, 1],
        yticks=[0, 1],
        xticklabels=["Farther", "Near"],
        yticklabels=["Farther", "Near"],
        xlabel="Predicted",
        ylabel="Known",
        title=f"Video + durations · seed {seed}\nCounts across all 97 test examples",
    )
    figure.tight_layout()
    if path is not None:
        figure.savefig(path, dpi=180, bbox_inches="tight")
    return figure
