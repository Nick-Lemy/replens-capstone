#!/usr/bin/env python3
"""Recompute the frozen persistent-shaking comparison without fitting a model."""
import csv
import json
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "training/results/persistent_tremor_20261101T105947439502Z"
OUTPUT = ROOT / "training/results/validation_ml/persistent-tremor-recomputed.json"
EXPECTED_MODELS = (
    "speed_only", "speed_plus_persistent_transverse", "training_median",
)


def load_rows(path):
    with path.open(newline="") as stream:
        return list(csv.DictReader(stream))


def mae(rows):
    return sum(abs(float(row["prediction"]) - float(row["reps_left"])) for row in rows) / len(rows)


def main():
    rows = load_rows(RUN / "predictions.csv")
    comparison = load_rows(RUN / "comparison.csv")
    candidate_quality = load_rows(ROOT / "training/results/candidate_tremor_20261101T103627645167Z/quality.csv")
    grouped = defaultdict(list)
    by_sample_model = {}
    for row in rows:
        grouped[row["model"]].append(row)
        by_sample_model[(row["sample_id"], row["model"])] = row

    selected = {model: grouped[model] for model in EXPECTED_MODELS}
    baseline_ids = {row["sample_id"] for row in selected["speed_only"]}
    assert all({row["sample_id"] for row in model_rows} == baseline_ids for model_rows in selected.values())
    assert len(baseline_ids) == 33
    accepted_candidate_ids = {row["sample_id"] for row in candidate_quality if row["accepted"] == "True"}
    assert accepted_candidate_ids == baseline_ids
    rejected_reasons = defaultdict(int)
    for row in candidate_quality:
        if row["accepted"] != "True":
            rejected_reasons[row.get("reason", "unspecified")] += 1
    assert len({row["participant_id"] for row in selected["speed_only"]}) == 4
    per_person_counts = defaultdict(int)
    for row in selected["speed_only"]:
        per_person_counts[row["participant_id"]] += 1
    expected = {"speed_only": 2.2511656107863036,
                "speed_plus_persistent_transverse": 2.221453838366069,
                "training_median": 2.452838827838828}
    stored_mae = {row["model"]: float(row["mae"]) for row in comparison if row["model"] in expected}
    assert stored_mae.keys() == expected.keys()
    assert all(math.isclose(stored_mae[model], value, abs_tol=1e-10) for model, value in expected.items())
    result = {}
    for model, model_rows in selected.items():
        per_person = defaultdict(list)
        for row in model_rows:
            per_person[row["participant_id"]].append(row)
        result[model] = {
            "n_examples": len(model_rows),
            "pooled_mae_reps": mae(model_rows),
            "participant_macro_mae_reps": sum(mae(person_rows) for person_rows in per_person.values()) / len(per_person),
            "participant_mae_reps": {person: mae(person_rows) for person, person_rows in sorted(per_person.items())},
        }


    speed_mae = result["speed_only"]["participant_macro_mae_reps"]
    shaking_mae = result["speed_plus_persistent_transverse"]["participant_macro_mae_reps"]
    relative_reduction = (speed_mae - shaking_mae) / speed_mae
    paired = []
    for sample_id in sorted(baseline_ids):
        speed = by_sample_model[sample_id, "speed_only"]
        shaking = by_sample_model[sample_id, "speed_plus_persistent_transverse"]
        paired.append((speed, shaking))
    near = [(a, b) for a, b in paired if int(a["reps_left"]) <= 2]
    final = [(a, b) for a, b in paired if int(a["reps_left"]) <= 1]
    result["quality_filter"] = {
        "candidate_examples": len(candidate_quality), "accepted_examples": len(accepted_candidate_ids),
        "rejected_examples": len(candidate_quality) - len(accepted_candidate_ids),
        "rejected_reasons": dict(sorted(rejected_reasons.items())),
        "candidate_quality_evidence": "training/results/candidate_tremor_20261101T103627645167Z/quality.csv",
        "persistent_run_quality_evidence": "training/results/persistent_tremor_20261101T105947439502Z/quality.csv (accepted rows only)",
    }
    result["comparison"] = {
        "same_sample_ids": True,
        "n_examples": len(paired),
        "n_participants": 4,
        "frozen_bundle": "app/backend/assets/rir_model.json (ridge_speed_transverse, version persistent_tremor_20261101T105947439502Z) vs app/backend/assets/rir_speed_only.json (ridge_speed_only)",
        "prediction_artifact": "training/results/persistent_tremor_20261101T105947439502Z/predictions.csv",
        "examples_per_participant": dict(sorted(per_person_counts.items())),
        "metric_definition": "relative reduction in participant-macro MAE; each participant contributes equal weight",
        "relative_mae_reduction_vs_speed_only": relative_reduction,
        "relative_reduction_percent": relative_reduction * 100,
        "15_percent_target_met": relative_reduction >= 0.15,
        "near_final_reps_left_le_2": {
            "n": len(near), "pooled_speed_only_mae_reps": mae([x[0] for x in near]),
            "pooled_speed_plus_transverse_mae_reps": mae([x[1] for x in near]),
            "participant_macro_speed_only_mae_reps": sum(mae([x[0] for x in near if x[0]["participant_id"] == person]) for person in {x[0]["participant_id"] for x in near}) / len({x[0]["participant_id"] for x in near}),
            "participant_macro_speed_plus_transverse_mae_reps": sum(mae([x[1] for x in near if x[1]["participant_id"] == person]) for person in {x[1]["participant_id"] for x in near}) / len({x[1]["participant_id"] for x in near}),
        },
        "final_reps_left_le_1": {
            "n": len(final), "pooled_speed_only_mae_reps": mae([x[0] for x in final]),
            "pooled_speed_plus_transverse_mae_reps": mae([x[1] for x in final]),
            "participants": sorted({x[0]["participant_id"] for x in final}),
            "participant_macro_speed_only_mae_reps": sum(mae([x[0] for x in final if x[0]["participant_id"] == person]) for person in {x[0]["participant_id"] for x in final}) / len({x[0]["participant_id"] for x in final}),
            "participant_macro_speed_plus_transverse_mae_reps": sum(mae([x[1] for x in final if x[1]["participant_id"] == person]) for person in {x[1]["participant_id"] for x in final}) / len({x[1]["participant_id"] for x in final}),
        },
    }
    result["limitations"] = [
        "Frozen exploratory predictions; this script does not retrain or alter model bundles.",
        "The nested leave-person-out run reused exploratory test folds after prior result inspection; it is not untouched confirmation evidence.",
        "The cohort has four participants with uneven representation; pooled and participant-macro errors are both reported.",
        "The 15% reduction is a historical proposal target and is not met by this matched comparison.",
        "Ground truth is retrospective RIR labels; the estimates are not direct physiological fatigue measurements.",
    ]
    result["stored_comparison_rows"] = comparison
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
