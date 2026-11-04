# RepLens

A research prototype that estimates repetitions remaining from uploaded simultaneous two-arm dumbbell-curl videos. Includes a mobile-first React PWA, FastAPI inference and Jupyter experiment notebooks.

## Submission links

- [Walkthrough video](https://youtu.be/-ybq-vpknGs)
- [Technical report (PDF, 5 pages)](https://docs.google.com/document/d/1Rh4gr-WbmZ6Vy0pwLF2HmcjopIbazBuQhyZO31RoJY0/export?format=pdf) — scope alignment, functionality, testing, performance and code quality
- [Technical report in Google Docs](https://docs.google.com/document/d/1Rh4gr-WbmZ6Vy0pwLF2HmcjopIbazBuQhyZO31RoJY0/edit?usp=sharing)

## Technical requirements

- **Application:** Python 3.12, Node.js 24, pnpm 11.25.0 and FFmpeg with `ffprobe`. The backend uses FastAPI 0.162, OpenCV 5.0, MediaPipe 1.1 and NumPy; the frontend uses React 19, TypeScript 7, Vite 8, Tailwind CSS 4 and TanStack Query 5. The deployed Ridge models are stored as JSON and do not require scikit-learn at runtime.
- **Research notebooks:** JupyterLab and the packages pinned in `training/requirements.txt`, including PyTorch, scikit-learn and Weights & Biases. The default application does not need these additional training packages.
- **Video:** a complete simultaneous dumbbell-curl set, up to 250 MB and three minutes, at 25 fps or higher; 30 fps or higher is recommended. A steady camera and visible arms improve tracking.
- **Hardware:** a phone or camera that can record the video above, and a computer capable of running FFmpeg and MediaPipe. The current backend deployment uses an x64 Ubuntu 24.04 VM with two vCPUs and 8 GiB RAM; video processing remains CPU intensive.
- **Hosting:** the PWA needs HTTPS for installation on a device. Video analysis needs a reachable backend; local development uses ports 5173 (frontend) and 8000 (API).

## Repository structure

```text
app/backend/          FastAPI routes, video processing, prediction and model assets
app/frontend/         React PWA pages, components, hooks and API client
training/notebooks/   Data preparation, model experiments and result summaries
training/results/     Packaged numerical results and validation records
scripts/              Submission and benchmark checks
config/               Backend deployment configuration
.github/workflows/     Automated checks and backend deployment
```

## Installation and local run

Install FFmpeg first. On macOS: `brew install ffmpeg`. On Ubuntu: `sudo apt-get install ffmpeg libgl1`.

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
9. [Set progression and error analysis](training/notebooks/09_set_progression.ipynb)

Notebooks 03–09 can recompute results from [included numeric artifacts](training/results/README.md), without private videos or retraining. Install `training/requirements.txt` and follow [notebook setup](training/README.md) to execute them. Optional experiment/export flags default to false.

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
