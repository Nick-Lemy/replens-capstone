# Browser workflow validation

Date: 2026-11-15 (Africa/Kigali). Worktree branch: `feat/defense-validation-suite`, based on `8a74834184d842ef47df11459f02c1192a0f21c3`.

## Executed checks

| Command | Environment | Expected outcome | Observed outcome |
| --- | --- | --- | --- |
| `cd app/frontend && pnpm build` | Vite production build | TypeScript check and production bundle complete | Passed. Vite reported the existing minified chunk size warning (about 502 kB); build finished. |
| `cd app/frontend && pnpm test:e2e` | Playwright 1.65.1; Chromium desktop, Chromium iPhone 13 emulation, WebKit iPhone 13 emulation | Fixture workflows pass; live-only journeys skip unless explicitly enabled | 18 passed, 6 skipped, 0 failed (24 project/test combinations; 6 stable fixture cases across 3 projects). |
| `PLAYWRIGHT_LIVE_API=1 PLAYWRIGHT_PYTHON=/Users/zkaynl7/Projects/alu/velocity-tremor-ml/training/.venv/bin/python pnpm test:e2e --project=chromium-desktop --grep='live API journey'` | Playwright auto-started a local FastAPI/Uvicorn server on loopback port 8011; auth/database/email environment variables unset | Read real health/models routes, accept a synthetic undecodable upload, surface the failed job and leave the upload retryable | Passed. The real API reported healthy/model available and accepted/polled the job; synthetic invalid bytes correctly failed decoding and the page returned to an actionable state. No database or email service was used. |

Browser versions observed with Playwright: Chromium `159.0.8154.6`, WebKit `27.2`. Desktop Chrome used the desktop project; mobile checks used iPhone 13 viewport/device emulation on Chromium and WebKit. These are simulated viewports on a desktop host, not physical phone tests. WebKit installation initially had a CDN reset and succeeded on retry.

## Fixture-backed workflow cases

Playwright routes provide predictable API responses for these UI journeys; they are not backend integration evidence:

- Reject an unsupported file extension, upload a synthetic MP4, show progress, and render fixture results.
- Keep unavailable RIR unavailable: no zero or safety claim is displayed; save, reopen and delete a guest history item.
- Verify rounded display of a raw `2.6` estimate while retaining its raw value and threshold meaning.
- Exercise sign-in, password recovery request, mismatched signup confirmation, verification redirect and sign-out with mocked auth responses.
- Cancel an in-progress analysis and assert polling stops; abort a subsequent upload and confirm the error is visible while the selected file can be retried.
- Return HTTP 429 from upload and confirm the busy message and retry action.
- Check required fields and browser password minimum-length validation.

The test names and route fixtures are in `app/frontend/tests/browser/`. No mock credentials correspond to a real account. The user-facing workflow is tested through the running Vite application in a real browser engine.

## Reproduced defect and retest

Before the fix, WebKit 27.2 with iPhone 13 emulation rejected IndexedDB writes for both `Blob` and `File` values with `UnknownError: Error preparing Blob/File data to be stored in object store`. The app displayed “Device storage could not be updated,” so guest session saving and account video persistence did not complete in this browser context. The finding and reproduction command are retained in [webkit-blob-storage.md](/Users/zkaynl7/Projects/alu/replens-validation/training/results/validation_browser/webkit-blob-storage.md).

`app/frontend/src/lib/history.ts` now retries failed video Blob writes as an ArrayBuffer wrapper and restores a Blob when reading sessions or account videos. Existing Blob-shaped records remain supported. After the change the same WebKit journey passed through save, reopen and delete. The full three-project suite then passed 18 cases with 6 expected opt-in skips. Playwright removed the failed run's screenshot/trace when it cleared its output directory for the passing run; no before screenshot/trace is available.

## Live research clip journey (one run completed)

On 2026-11-15, Agent 4 ran one opt-in valid-clip journey after the capacity agent released the local API workload. The test used the local read-only `replens-video-1.MOV` source and the public pose model through an ignored worktree symlink. The host was Apple M5 with 16 GiB RAM; Node 26.8.1 and Python 3.12.14. Playwright started Vite and a local Uvicorn API on loopback port 8011, with database, JWT and email-provider variables removed. No account, database or email service was used. Screenshots and traces were disabled.

The test passed: it uploaded the clip through the real API, completed analysis, and displayed the “Your Set Review” and “Explore each rep” headings. Playwright reported 21.1 seconds for the test case (24.7 seconds total process time). This includes browser startup, file selection and polling, so it is not a backend-only processing measurement. The test did not assert a prediction value, output count or model choice, and it provides no accuracy or real-world reliability evidence. The private source clip and ignored model symlink are not included in Git.

Reproduce, if the original read-only clip and pose model remain available:

```sh
mkdir -p training/models
ln -s /Users/zkaynl7/Projects/alu/velocity-tremor-ml/training/models/pose_landmarker_heavy.task training/models/pose_landmarker_heavy.task
cd app/frontend
time PLAYWRIGHT_LIVE_API=1 \
PLAYWRIGHT_PYTHON=/Users/zkaynl7/Projects/alu/velocity-tremor-ml/training/.venv/bin/python \
PLAYWRIGHT_REAL_CLIP=/Users/zkaynl7/Projects/alu/velocity-tremor-ml/training/data/cropped_videos/replens-video-1.MOV \
pnpm test:e2e --project=chromium-desktop --grep='uploads a local clip'
```

## Not covered

- Physical iPhone/Android, public network, deployed service, Azure performance, real email delivery, or production persistence.
- Browser authentication and saved-session persistence against a live database. Existing route-level PostgreSQL evidence is separate in `auth-security-results.md`.
- Positive reset-token and password-change flows, user switching with multiple real accounts, offline/reconnect after a pending request, 500/server error response, and live 429 concurrency. The browser suite covers the 429 UI response with a fixture; it does not create backend load.
- The single real-clip run did not measure backend-only processing time, model accuracy, physical-device behavior or production reliability.

Actual phone acceptance remains for the user’s later test session. No backend production defect was inferred from the synthetic undecodable-clip smoke result.
