# RepLens

RepLens is a mobile-friendly research app that estimates proximity to muscle fatigue during simultaneous dumbbell curls. It predicts repetitions in reserve (RIR) from an uploaded video and lets users review the completed set. This repository contains the app and its machine learning experiments.

**Live app:** https://replens.lemy.dev

## Submission

- [Walkthrough video](https://youtu.be/-ybq-vpknGs)
- [Technical report (PDF, 5 pages)](https://docs.google.com/document/d/1Rh4gr-WbmZ6Vy0pwLF2HmcjopIbazBuQhyZO31RoJY0/export?format=pdf)

## Technical requirements

| Area | Requirements |
| --- | --- |
| Docker run | Docker Engine and Docker Compose; no host Python, Node or PostgreSQL installation |
| Local development | Python 3.12, Node.js 24, pnpm 11.25.0, FFmpeg and `ffprobe` |
| Backend | FastAPI 0.162, OpenCV 5.0, MediaPipe 1.1, NumPy 2.5 |
| Frontend | React 19, TypeScript 7, Vite 8, Tailwind CSS 4, TanStack Query 5 |
| ML notebooks | JupyterLab and the packages in `training/requirements.txt`, including PyTorch, scikit-learn and Weights & Biases |
| Video | Complete curl set, at most 250 MB and 3 minutes, at least 25 fps; 30 fps or higher recommended |
| Hardware | Phone or camera with a steady view of both arms. The hosted backend runs on an x64 Ubuntu 24.04 VM with 2 vCPUs and 8 GiB RAM. |

The application models are bundled as JSON. The app does not require the notebook dependencies or private training videos. Installing the PWA requires HTTPS or localhost.

## Installation and local run

With Docker running, start the frontend, backend and a local PostgreSQL database from the repository root:

```sh
docker compose up --build
```

Open **http://localhost:5173**. API documentation is at **http://localhost:8000/docs**. The first build downloads the public pose model. PostgreSQL data stays in a Docker volume. Stop the stack with `docker compose down`.

If either host port is taken, set `REPLENS_FRONTEND_PORT` and `REPLENS_API_PORT` in `.env` before starting Compose.

Accounts also need email credentials. To enable them locally, copy `compose.env.example` to `.env`, set `JWT_SECRET`, `RESEND_API_KEY` and `EMAIL_FROM`, then restart the stack. The `.env` file is ignored by Git. Compose uses its own PostgreSQL container; production still uses Neon.

### Run without Docker

Install FFmpeg first: `brew install ffmpeg` on macOS or `sudo apt-get install ffmpeg libgl1` on Ubuntu.

From the repository root:

```sh
python3.12 -m venv training/.venv
source training/.venv/bin/activate
python -m pip install -r app/backend/requirements.txt
python app/backend/setup_models.py
```

Start the backend:

```sh
source training/.venv/bin/activate
python -m uvicorn app.backend.main:app --host 127.0.0.1 --port 8000
```

In another terminal, start the frontend:

```sh
cd app/frontend
pnpm install --frozen-lockfile
pnpm dev
```

Open the app at **http://localhost:5173**. API documentation is at **http://127.0.0.1:8000/docs**. See [app/README.md](app/README.md) for deployment and configuration.

## Repository structure

```text
app/backend/          FastAPI routes, video processing and model assets
app/frontend/         React pages, components, hooks and API client
training/notebooks/   Data preparation, experiments and results
training/results/     Packaged metrics and validation records
scripts/              Submission and benchmark checks
config/               Deployment configuration
.github/workflows/     CI checks and backend deployment
```

See [training/README.md](training/README.md) for the nine notebooks and their setup. Notebooks 03 to 09 can reproduce saved metrics from packaged numeric results without private videos or retraining.

## Results and limitations

On 33 quality-filtered examples from four people, speed plus candidate shaking reached **2.22 reps MAE**, compared with **2.25** for speed alone. This 1.32% difference is fragile and below the proposed 15% target. The app uses a refit on all accepted examples, which has no separate test score. Predictions remain experimental and can be inaccurate, especially near failure. See [notebook 07](training/notebooks/07_results.ipynb) for the full comparisons.

## Checks

```sh
python3 scripts/check_submission.py
python -m unittest discover -s app/backend/tests -v
cd app/frontend
pnpm build
```

The checks run in GitHub Actions. [Validation records](training/results/refactor_validation.json) include real video upload, browser history, error handling and performance checks.
