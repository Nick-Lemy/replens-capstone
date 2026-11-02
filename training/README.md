# ML experiments

The [results notebook](notebooks/07_results.ipynb) summarizes the saved experiment comparisons. Results can be recomputed from packaged predictions without retraining or processing private videos.

## Notebooks

| Notebook | Question |
|---|---|
| [01_data_review](notebooks/01_data_review.ipynb) | Are repetitions, identities and endpoints correctly reviewed? |
| [02_dataset_preparation](notebooks/02_dataset_preparation.ipynb) | Which examples and participant splits can be used? |
| [03_video_baselines](notebooks/03_video_baselines.ipynb) | Do ResNet + TCN/LSTM and whole-lifter crops help? |
| [04_video_adaptation](notebooks/04_video_adaptation.ipynb) | Do video pretraining, longer history or personal calibration help? |
| [05_near_failure](notebooks/05_near_failure.ipynb) | Can a classifier distinguish 0–2 RIR from more than 2? |
| [06_speed_and_shaking](notebooks/06_speed_and_shaking.ipynb) | Does candidate shaking help beyond speed? |
| [07_results](notebooks/07_results.ipynb) | What do the matched comparisons show? |
| [08_relative_speed](notebooks/08_relative_speed.ipynb) | Do relative speed or different regularization fix flat predictions? |
| [09_set_progression](notebooks/09_set_progression.ipynb) | Do rep context, timing, geometry or a different target help? |

Each experiment documents its rationale, method, results and conclusions. Notebooks 03–06 show saved results first, followed by optional training/extraction code. Their run/export flags default to false. Open each independently; do not rerun review or preparation just to view results.

## Open locally

From the repository root:

```sh
training/.venv/bin/python -m jupyterlab training/notebooks
```

Select the **Python 3 (RepLens)** kernel.

To reproduce a new experiment, review data in 01, prepare it in 02, then enable only the relevant run flag in 03–06. Configuration/support cells are collapsed, not removed. Existing source predictions and checkpoints are preserved.

## Metrics and conclusions

RIR regression uses participant-mean **MAE**, plus RMSE, within-one/two-rep fractions, signed bias and R². Classification uses balanced accuracy, precision, recall, specificity, F1, average precision, ROC AUC, Brier and balanced log loss; ordinary accuracy is secondary. Definitions are inside the notebooks. Seed variation is not a confidence interval. R² is undefined for a person with one example.

- Population video tests: 124 reps, nine clips, six people. Adapted R3D MAE is about 4.81, close to the 4.84 median reference.
- Personal calibration uses a different protocol and is reported separately.
- Near-failure tests: 97 reps from six people. High recall came with many false warnings.
- Shaking tests: 33 quality-passing examples from four people. Revised shaking reached about 2.22 MAE versus 2.25 for speed alone, a fragile 1.32% change. Excluding the single-example person reverses that gain.

The proposed 15% benefit from adding tremor has **not** been demonstrated. Video shaking is not sensor-validated physiological tremor. Exploratory additions use user-reported endpoints; some public-video reuse permissions remain unverified. Do not rank MAE across different cohorts as if they were the same test.

## Saved files

- `data/`: videos, reviewed labels, prepared windows and reusable caches; ignored by Git.
- `artifacts/`: local source predictions/checkpoints and `submission_report/` figures; ignored by Git.
- `results/`: packaged numeric predictions and supporting metrics for fresh-clone reproduction.
- `models/`: downloaded encoders and the current app bundle; ignored by Git.
- `reporting.py`: shared metric and plotting helpers; no training or application logic.

W&B logs are offline unless explicitly configured otherwise. The app uses a refit of the selected speed + transverse-shaking Ridge model. Shared feature code is in `app/backend/services/motion_features.py`; the optional export in notebook 06 writes portable JSON.

## New environment

```sh
python3.12 -m venv training/.venv
training/.venv/bin/python -m pip install -r training/requirements.txt
training/.venv/bin/python -m ipykernel install --user --name replens-training --display-name "Python 3 (RepLens)"
```
