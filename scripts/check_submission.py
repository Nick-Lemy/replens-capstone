"""Check packaged code and research artifacts without private recordings."""

import ast
import csv
import json
import math
from collections import defaultdict
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[1]


def check():
    for folder in ["app/backend", "training", "scripts"]:
        for path in (ROOT / folder).rglob("*.py"):
            if any(
                part in {".venv", "data", "artifacts", "models", "__pycache__"}
                for part in path.relative_to(ROOT).parts
            ):
                continue
            ast.parse(path.read_text(), filename=str(path))
    for path in (ROOT / "training/notebooks").glob("*.ipynb"):
        notebook = json.loads(path.read_text())
        if path.name.startswith(("01", "02")) and notebook.get("metadata", {}).get(
            "widgets"
        ):
            raise AssertionError("Private widget state must not be packaged.")
        for cell in notebook["cells"]:
            if cell["cell_type"] == "code":
                ast.parse("".join(cell["source"]), filename=str(path))
                if path.name.startswith(("01", "02")) and cell.get("outputs"):
                    raise AssertionError("Private review outputs must not be packaged.")
    compared = []
    for filename, family, count, model in [
        (
            "rir_model.json",
            "ridge_speed_transverse",
            7,
            "speed_plus_persistent_transverse",
        ),
        ("rir_speed_only.json", "ridge_speed_only", 4, "speed_only"),
    ]:
        bundle = json.loads((ROOT / "app/backend/assets" / filename).read_text())
        metadata = bundle["metadata"]
        assert metadata["family"] == family
        assert math.isfinite(bundle["intercept"])
        for name in ["mean", "scale", "coefficients"]:
            assert len(bundle[name]) == len(metadata["feature_names"]) == count
            assert all(math.isfinite(value) for value in bundle[name])
        assert all(value > 0 for value in bundle["scale"])
        source = ROOT / "training/results" / metadata["version"] / "predictions.csv"
        errors = defaultdict(list)
        seen = set()
        with source.open() as stream:
            for row in csv.DictReader(stream):
                if row["model"] != model or row["task"] != "rir":
                    continue
                key = (row["participant_id"], row["video_id"], row["rep"])
                assert key not in seen
                seen.add(key)
                errors[row["participant_id"]].append(
                    abs(float(row["prediction"]) - float(row["reps_left"]))
                )
        assert len(seen) == metadata["evaluation_examples"] == 33
        assert len(errors) == metadata["evaluation_participants"] == 4
        assert math.isclose(
            mean(mean(values) for values in errors.values()),
            metadata["participant_mae_reps"],
            abs_tol=1e-10,
        )
        assert metadata["evaluated_refit"] is False
        assert metadata["experimental"] is True
        compared.append(seen)
    assert compared[0] == compared[1]
    print(
        "Submission checks passed: code syntax, private-output exclusion, model coefficients and held-out metric provenance."
    )


if __name__ == "__main__":
    check()
