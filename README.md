# RepLens

A research prototype that estimates repetitions remaining from uploaded simultaneous two-arm dumbbell-curl videos. Includes a mobile-first React PWA, FastAPI inference and Jupyter experiment notebooks.

## Try the app

Prerequisites: Python 3.12, Node, pnpm 11.25.0 and FFmpeg/ffprobe. On macOS: `brew install ffmpeg`. Ubuntu: `sudo apt-get install ffmpeg libgl1`.

From the repository root:

```sh
python3.12 -m venv training/.venv
training/.venv/bin/python -m pip install -r app/backend/requirements.txt
training/.venv/bin/python app/backend/setup_models.py
```

Start the backend in one terminal:

```sh
cd app/backend
pnpm start:dev
```

Start the frontend in another:

```sh
cd app/frontend
pnpm install --frozen-lockfile
pnpm dev
```

App: **http://localhost:5173**. API docs: **http://127.0.0.1:8000/docs**. See [app setup and scope](app/README.md) for hosting and privacy details.

The selected signal model is bundled as portable JSON. Its pose locator downloads during setup; PyTorch and private research videos are not needed for the default app. Use a clear, steady video of a full simultaneous curl set, ideally 30+ fps. The first three completed reps build history. Poor tracking produces an unavailable estimate.

## Research notebooks

1. [Review videos](training/notebooks/01_data_review.ipynb)
2. [Prepare data](training/notebooks/02_dataset_preparation.ipynb)
3. [Video baselines](training/notebooks/03_video_baselines.ipynb)
4. [Motion adaptation and calibration](training/notebooks/04_video_adaptation.ipynb)
5. [Near-failure classification](training/notebooks/05_near_failure.ipynb)
6. [Speed and candidate shaking](training/notebooks/06_speed_and_shaking.ipynb)
7. [Results and conclusions](training/notebooks/07_results.ipynb)
8. [Relative-speed follow-up](training/notebooks/08_relative_speed.ipynb)

Notebooks 03–08 can recompute results from [included numeric artifacts](training/results/README.md), without private videos or retraining. Install `training/requirements.txt` and follow [notebook setup](training/README.md) to execute them. Optional experiment/export flags default to false.

## Findings and limits

The selected speed + transverse-shaking model scored about **2.22 reps MAE on 33 quality-filtered examples from four people**. Its 1.32% improvement over speed alone is small, depends heavily on one person with one example, and does not meet the proposed 15% target. Population video-model results use a different 124-rep/six-person cohort and are reported separately. The app uses an all-accepted-data refit, not an independently evaluated deployment model.

A matched relative-speed/regularization follow-up did not improve held-out MAE. The existing model has about **4.59 reps error on final reps**; its overall average conceals poor near-failure predictions. See notebook 08 for per-set curves.

This is experimental RIR estimation, not a validated physiological fatigue measurement or injury-prevention tool. Predictions can be wrong and do not establish that another rep is safe. Raw recordings, private review outputs, caches and older backups are excluded from Git. Video training/review needs the approved private recordings; packaged results support metric reproduction and the signal-model refit.

## Checks

```sh
python3 scripts/check_submission.py
cd app/frontend
pnpm build
```

The submission check verifies code syntax, private-output exclusion and model/metric provenance without private data. GitHub Actions runs it and the frontend build. Local end-to-end checks use real video uploads and browser session history; see the validation record in `training/results/submission_validation.json`.
