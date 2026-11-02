# RepLens PWA

React + TypeScript + Tailwind frontend, with TanStack Query and a FastAPI video analyzer. The PWA supports light/dark themes, uploaded-video analysis and device-local session history.

## First-time setup

Install Python 3.12, Node, pnpm 11.25.0 and FFmpeg (including `ffprobe`). On macOS, FFmpeg is available with `brew install ffmpeg`; on Ubuntu, use `sudo apt-get install ffmpeg libgl1`.

Then, from the repository root:

```sh
python3.12 -m venv training/.venv
training/.venv/bin/python -m pip install -r app/backend/requirements.txt
training/.venv/bin/python app/backend/setup_models.py
```

The speed + shaking and speed-only Ridge models are bundled as `app/backend/assets/rir_model.json` and `app/backend/assets/rir_speed_only.json`. Setup downloads and verifies only the public MediaPipe Heavy pose locator. The default app does not require PyTorch, ResNet/R3D weights, raw research videos or a database.

## Start separately

Backend layout:

```text
backend/
├── main.py
├── config/settings.py
├── services/
├── assets/
├── requirements.txt
└── setup_models.py
```

`main.py` exposes the API, `config` contains paths and environment settings, and `services` contains analysis and prediction logic.

Backend:

```sh
cd app/backend
pnpm start:dev
```

Frontend, in another terminal:

```sh
cd app/frontend
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://localhost:5173**. API documentation: **http://127.0.0.1:8000/docs**. The backend uses `training/.venv`; the frontend proxies local `/api` requests to port 8000.

## Analyze a set

Upload a complete simultaneous two-arm dumbbell-curl set, at least 25 fps (30+ recommended), up to three minutes and 250 MB. Keep the camera steady, both arms visible and the wrists large enough to measure. MediaPipe proposes rep boundaries and locates image regions. Actual pixel movement supplies speed and candidate shaking features. Estimates can start at rep 4, using that rep and the previous three. Interrupted or poor tracking produces **Unavailable**, not invented estimates. Check the automatic count against the video.

The default model is speed + persistent transverse shaking, a regularized Ridge model. The backend also offers a speed-only Ridge model. On a selected 33-example/four-person test subset it had participant-mean MAE 2.22 reps versus 2.25 for speed alone. The small 1.32% gain is fragile and does not meet the proposed 15% benefit. Both bundles are refits on all 33 accepted examples using inner-selected regularization; these refits have no independent test scores. The matched evaluation included shaking-quality filtering even for speed alone, while speed-only runtime availability can differ. Candidate shaking is not sensor-validated physiological tremor, and estimates are not safety advice. The UI displays this limited evaluation scope.

Some phone MOV files use HEVC, which not every browser can play. Analysis can still finish; the player shows a compatibility message. H.264 MP4 is the recommended preview format. With FFmpeg installed, create a compatible copy without changing the original:

```sh
ffmpeg -i input.MOV -an -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart output.mp4
```

Displayed estimates are rounded to nonnegative whole numbers. Saved results retain raw predictions, model version and quality information. The analyzer uses the same numerical feature functions as notebook 06; no future reps or a declared final rep count are prediction inputs.

The API accepts multipart `POST /api/analyses` with `video` and an optional `model` of `speed_shaking` (default) or `speed_only`. `GET /api/models` lists the two choices and availability. The job and result include `model_choice`; result model metadata identifies the actual model. A configured model override must match an explicit selection or the request is rejected.

## Privacy and history

The backend strips audio and deletes its temporary upload after analysis. Jobs/results are held in memory. Saving a session stores the video and result in IndexedDB on that browser; reload, reopen and deletion are supported. History is not synced between devices. Raw research recordings and review images are excluded from Git.

This scope has upload-based retrospective prediction, not live streaming. Authentication and shared database history are not implemented.

## Build / host

```sh
cd app/frontend
pnpm build
pnpm preview
```

Set `VITE_API_URL` at frontend build time to the HTTPS backend origin (without `/api`) for separate hosting. Set `FRONTEND_ORIGINS` on the backend to the exact frontend origin. Local environment examples describe both; uvicorn does not automatically load `.env`. Mobile PWA installation requires HTTPS or localhost. The app shell/history can work offline after caching, but new analysis needs the backend. Mobile installation after hosting still requires a real-device check.

## Model reproduction

Install `training/requirements.txt` for notebook/model development. Run `python -m training.model_export` for the shaking bundle or `python -m training.model_export --speed-only` for the speed-only bundle, using packaged derived features; notebook 06 exposes the same optional export. No private video is needed for that refit. The original held-out results are preserved separately.

`REPLENS_MODEL_PATH` can point to a compatible Ridge JSON bundle. Explicit model selections must match the configured bundle; unsupported or incompatible overrides do not silently fall back. Historical training notebooks and results are retained for research.

## Azure VM deployment

Use an Ubuntu 24.04 LTS VM with SSH-key authentication, an x64 CPU, at least 2 vCPUs and 4 GB RAM, and a static public IP. These are initial sizing recommendations; video processing still needs a real upload benchmark. Select a VM size available under your Azure subscription and check its estimated cost against your remaining credits.

Allow inbound TCP ports 22 (SSH), 80 and 443 (HTTPS). Use an admin user with passwordless sudo. Do not expose container port 8000. Point the DNS A record for `api.replens.lemy.dev` to the new public IP before enabling deployment.

GitHub Actions settings:

| Setting | Value |
| --- | --- |
| Secret `DEPLOY_SSH_PRIVATE_KEY` | Private key matching the VM's authorized public key |
| Variable `REPLENS_VPS_IP` | New Azure VM public IP |
| Variable `REPLENS_SSH_USER` | VM admin username, for example `azureuser` |
| Variable `REPLENS_VPS_ARCH` | `amd64` for an x64 VM; `arm64` only for an ARM VM |
| Variable `REPLENS_API_HOST` | `api.replens.lemy.dev` |
| Variable `REPLENS_FRONTEND_ORIGIN` | `https://replens.lemy.dev` |
| Variable `DEPLOY_ENABLED` | Keep `false` until the VM and DNS are ready; then `true` |

Use `gh variable set NAME --body VALUE` to update variables. Set the private key from its local file without copying it into chat:

```sh
gh secret set DEPLOY_SSH_PRIVATE_KEY < /path/to/private-key
```

For the first deployment, run **Deploy VPS backend** manually with `first_setup` checked. Kamal installs Docker and starts the HTTPS proxy and backend. If deploying through a push instead, temporarily set `REPLENS_FIRST_SETUP=true`, then remove that variable after successful setup. Subsequent pushes to `main` use `kamal deploy`. An optional `REPLENS_APPROVED_DEPLOY_SHA` permits a specific approved `dev` commit to deploy before its PR is merged.

Configuration: `config/deploy.yml`, `Dockerfile` and `.github/workflows/deploy.yml`. Builds use a runner matching the VM architecture. No database migrations or authentication secrets are needed by this version. Deployment finishes by checking the public API and selected model.

The frontend is live at `https://replens.lemy.dev` and uses the Azure backend at `https://api.replens.lemy.dev`. GitHub Actions deployment, HTTPS, CORS and a complete 19.4-second upload were verified: nine reps and six available predictions. This is a deployment check, not an accuracy evaluation; processing still takes several minutes on the current CPU. The temporary Render service is no longer used by the frontend.

### Frontend structure

The React app composes its screens in `frontend/src/pages` and keeps focused hooks for analysis jobs, history, reviews, browser status, health, and video URLs in `frontend/src/hooks`. API transport, types, and IndexedDB storage remain in `frontend/src/lib`.

```text
frontend/src/
  pages/                    Analyze, history, and results screens
  components/analyze/       Video input, progress, tips, model selector
  components/results/       Video, chart, rep selector, model metadata
  components/results/review/ Completed-set review controls
  components/history/       Saved-session card
  components/layout/         Navigation and status
  components/shared/         Shared UI controls
  hooks/                    State and workflow hooks
  lib/                      API and local storage
```

## Processing optimization and validation

Speed and persistent-shaking tracking now share video decoding and background-motion estimation, retaining separate wrist-tracking state and the existing feature definitions. On one 19.43-second H.264 clip on the current Azure VM, accepted-upload-to-completed-poll time fell from 195.94 to 141.76 seconds (27.65%). Both runs detected nine reps and returned six estimates, with zero observed raw-prediction difference. This is a single paired measurement, not a latency percentile or accuracy improvement.

See `training/results/processing_optimization.json` for local numerical-parity benchmarks and `training/results/refactor_validation.json` for integration evidence. To reproduce motion-only comparisons with local approved data, use `training/.venv/bin/python scripts/benchmark_processing.py --video VIDEO_PATH --pose MATCHING_POSE_CSV`; the default baseline is the `motion-baseline` tag. The API still uses one background worker and in-memory jobs.
