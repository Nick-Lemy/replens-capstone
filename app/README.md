# RepLens PWA

React + TypeScript + Tailwind frontend, with TanStack Query and a FastAPI video analyzer. The PWA supports light/dark themes, live camera rep counting, completed-video analysis and saved session history.

## First-time setup

For a one-command local run of the frontend, backend and PostgreSQL, use `docker compose up --build` from the repository root. The root README explains local account credentials. Production keeps using Neon.

Install Python 3.12, Node, pnpm 11.25.0 and FFmpeg (including `ffprobe`). On macOS, FFmpeg is available with `brew install ffmpeg`; on Ubuntu, use `sudo apt-get install ffmpeg libgl1`.

Then, from the repository root:

```sh
python3.12 -m venv training/.venv
source training/.venv/bin/activate
python -m pip install -r app/backend/requirements.txt
python app/backend/setup_models.py
```

The speed + shaking and speed-only Ridge models are bundled as `app/backend/assets/rir_model.json` and `app/backend/assets/rir_speed_only.json`. Setup downloads and verifies only the public MediaPipe Heavy pose locator. The analyzer does not require PyTorch, ResNet/R3D weights, raw research videos or a database. Accounts use a separate database when configured.

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
source training/.venv/bin/activate
python -m uvicorn app.backend.main:app --host 127.0.0.1 --port 8000
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

The live camera option uses the browser camera and a MediaPipe Lite pose model to show a provisional count of complete two-arm curls during recording. Both arms must be visible and the movement must extend, curl and return. The count can miss repetitions, so the completed recording goes through the normal server analysis and review. Live RIR or a live fatigue warning is not available: the deployed model requires a separate full-video pixel-motion pass, which took 141.76 seconds for one 19.43-second clip on the current VPS. Camera access requires HTTPS or localhost, browser support for MediaRecorder, and an initial download of the MediaPipe model and WebAssembly runtime.

The default model is speed + persistent transverse shaking, a regularized Ridge model. The backend also offers a speed-only Ridge model. On a selected 33-example/four-person test subset it had participant-mean MAE 2.22 reps versus 2.25 for speed alone. The small 1.32% gain is fragile and does not meet the proposed 15% benefit. Both bundles are refits on all 33 accepted examples using inner-selected regularization; these refits have no independent test scores. The matched evaluation included shaking-quality filtering even for speed alone, while speed-only runtime availability can differ. Candidate shaking is not sensor-validated physiological tremor, and estimates are not safety advice. The UI displays this limited evaluation scope.

Some phone MOV files use HEVC, which not every browser can play. Analysis can still finish; the player shows a compatibility message. H.264 MP4 is the recommended preview format. With FFmpeg installed, create a compatible copy without changing the original:

```sh
ffmpeg -i input.MOV -an -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart output.mp4
```

Displayed estimates are rounded to nonnegative whole numbers. Saved results retain raw predictions, model version and quality information. The analyzer uses the same numerical feature functions as notebook 06; no future reps or a declared final rep count are prediction inputs.

The API accepts multipart `POST /api/analyses` with `video` and an optional `model` of `speed_shaking` (default) or `speed_only`. `GET /api/models` lists the two choices and availability. The job and result include `model_choice`; result model metadata identifies the actual model. A configured model override must match an explicit selection or the request is rejected.

## Privacy and history

The backend strips audio and deletes its temporary upload after analysis. Analysis jobs are held in memory. Guest sessions, including their videos, are saved in IndexedDB on that browser. For signed-in users, the API stores results and reviews in PostgreSQL so history follows the account. Videos remain on the device where they were saved and are not uploaded to PostgreSQL. Signed-in users can view results from another device without the video. Raw research recordings and review images are excluded from Git.

Prediction remains retrospective. Guest history is separate from account history; signing in does not automatically move guest sessions into an account.

## Accounts

Accounts support sign-up, email verification, sign-in, sign-out, current user, password reset by email and password change. Access uses an HTTP-only JWT cookie. Guest analysis remains available when accounts are not configured. To enable accounts locally, set `DATABASE_URL`, a random `JWT_SECRET` of at least 32 characters, `AUTH_FRONTEND_URL`, `RESEND_API_KEY` and `EMAIL_FROM`. The sending address must use a verified Resend domain. Copy `app/backend/.env.example` to a private env file and load it into the backend shell; uvicorn does not read that file automatically. Run `python -m alembic -c app/backend/alembic.ini upgrade head` from the repository root before starting the API. The Docker image runs this migration on startup when `DATABASE_URL` is set.

For VPS deployment, set GitHub secrets `DATABASE_URL`, `JWT_SECRET` and `RESEND_API_KEY`, plus the `REPLENS_EMAIL_FROM` and `REPLENS_FRONTEND_ORIGIN` variables. Deployment requires these settings and runs the database migration before starting the API. The database must be reachable from the VPS, and the sender must use a verified Resend domain.

Signed-in session history uses `GET /api/sessions`, `GET /api/sessions/{id}`, `PUT /api/sessions/{id}` and `DELETE /api/sessions/{id}`. Every route requires the account cookie and returns only that account's records.

## Build / host

```sh
cd app/frontend
pnpm build
pnpm preview
```

Set `VITE_API_URL` at frontend build time to the HTTPS backend origin (without `/api`) for separate hosting. Set `FRONTEND_ORIGINS` on the backend to the exact frontend origin. Local environment examples describe both; uvicorn does not automatically load `.env`. Mobile PWA installation requires HTTPS or localhost. The app shell and guest history can work offline after caching; account history and new analysis need the backend. Mobile installation after hosting still requires a real-device check.

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

Configuration: `config/deploy.yml`, `Dockerfile` and `.github/workflows/deploy.yml`. Builds use a runner matching the VM architecture. Deployment requires account secrets and applies pending migrations before starting the API. It finishes by checking the public API and selected model.

The frontend is live at `https://replens.lemy.dev` and uses the Azure backend at `https://api.replens.lemy.dev`. GitHub Actions deployment, HTTPS, CORS and a complete 19.4-second upload were verified: nine reps and six available predictions. This is a deployment check, not an accuracy evaluation; processing still takes several minutes on the current CPU. The temporary Render service is no longer used by the frontend.

### Frontend structure

The React app composes its screens in `frontend/src/pages` and keeps focused hooks for analysis jobs, history, reviews, browser status, health, and video URLs in `frontend/src/hooks`. Account and session API clients live in `frontend/src/features`; shared transport, types, and device storage live in `frontend/src/lib`.

```text
frontend/src/
  pages/                    Analyze, history, and results screens
  components/analyze/       Video input, live camera, progress, tips, model selector
  components/results/       Video, chart, rep selector, model metadata
  components/results/review/ Completed-set review controls
  components/history/       Saved-session card
  components/layout/         Navigation and status
  components/shared/         Shared UI controls
  features/auth/             Account page and API
  features/history/          Saved-session API
  features/live/             Browser camera, pose tracking, rep counter
  hooks/                    State and workflow hooks
  lib/                      API and local storage
```

## Processing optimization and validation

Speed and persistent-shaking tracking now share video decoding and background-motion estimation, retaining separate wrist-tracking state and the existing feature definitions. On one 19.43-second H.264 clip on the current Azure VM, accepted-upload-to-completed-poll time fell from 195.94 to 141.76 seconds (27.65%). Both runs detected nine reps and returned six estimates, with zero observed raw-prediction difference. This is a single paired measurement, not a latency percentile or accuracy improvement.

The next motion-stage optimization groups background and wrist points into one forward/backward optical-flow call per frame. On a 19.43-second local clip, this cut the motion stage from 12.75 to 9.25 seconds compared with the deployed implementation. Both motion tables and all six available predictions matched exactly. This local result does not establish VPS or live-camera latency.

See `training/results/processing_optimization.json` for local numerical-parity benchmarks and `training/results/refactor_validation.json` for integration evidence. To reproduce motion-only comparisons with local approved data, use `training/.venv/bin/python scripts/benchmark_processing.py --video VIDEO_PATH --pose MATCHING_POSE_CSV`; the default baseline is the `motion-baseline` tag. The API still uses one background worker and in-memory jobs.
