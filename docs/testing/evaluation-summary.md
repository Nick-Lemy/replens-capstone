# RepLens testing and evaluation summary

**Worktree:** `feat/defense-validation-suite`, based on `8a74834184d842ef47df11459f02c1192a0f21c3`  
**Evidence date:** 2026-11-15 (Africa/Kigali)

This is a local validation record, not a claim of production readiness, scientific validation, or independent external review. The validation branch is separate from the root checkout's uncommitted streaming experiment. No files were pushed, merged or deployed.

## Current evidence

| Area | Observed result | Limits |
|---|---|---|
| Authentication and saved sessions | Seven API route tests passed against disposable PostgreSQL 16 with migrations; mocked email. See `auth-security-results.md`. | No concurrent ownership race test, live deliverability, production cookie verification or deployment test. |
| Browser workflows | Fixture suite: 18 passed, 6 skipped across desktop Chromium, simulated iPhone Chromium and simulated iPhone WebKit. Live local API invalid-video smoke passed. The valid local clip test later passed (one Chromium desktop journey reached results). WebKit Blob/File IndexedDB failure was reproduced and the ArrayBuffer fallback retested. See `browser-results.md` and `training/results/validation_browser/webkit-blob-storage.md`. | No physical phone; valid-clip Playwright test took 21.1s total, including browser setup and analysis polling, so it is not a backend-only processing latency; six opt-in project/test cases were skipped. |
| Jobs and capacity | After the lock/scope/admission-gate fix, post-fix paced Locust runs completed 5,334 requests with 0 failures (10/50/100 users × 3 short stages); the 100-user synchronized cold burst returned 15 HTTP 200 + 85 HTTP 503, with no timeouts; a recovery probe returned 200 after 4.73s. Two private video jobs completed: the 19.4-second clip completed in 18.829s with 9 reps and 6 available estimates; the 36.5-second clip completed in 34.071s with 18 reps, 7 available estimates, and 8 quality-gated unavailable estimates. The five-upload burst admitted 3, rejected 2 with 429, and completed admitted jobs serially; each admitted short clip had 6 available estimates of 9 reps. The initial all-zero availability figure was a benchmark parser key mismatch (`rir` was not counted), corrected and rerun; the original record is retained. See `capacity-results.md`, `locust-live-dashboard-100users.png`, `locust-warm-final-report.png`, `video-jobs.json` and `prediction-availability-diagnostic.json` for workload, status counts and quality-gate detail. | This is one local process/database and a bounded workload, not a service-level claim. Cold-burst 503s are explicit overload handling, not success; the paced run is not comparable to the historical synchronized custom harness. |
| ML contract and signal quality | 15 predictor/signal-focused tests passed, including bundle contract, scale/order, invalid inputs, fourth-rep availability, sampling/gap gates and confirmed-failure label validation. Full combined backend unittest discovery then passed 34 tests (0 skipped, 0 failures) against disposable PostgreSQL 16, including auth routes and the concurrent engine test; scoped coverage with branch tracking enabled was 57% combined (auth/routes/services/sessions). The later counter regression test also passed separately (1 test); the full suite was not redundantly rerun after that test-only addition. | Synthetic correctness tests do not measure prediction accuracy or physiological validity. |
| Frozen matched comparison | `python3 scripts/validate_research_artifacts.py` recomputed from the frozen persistent-transverse prediction artifact without retraining; results saved to `training/results/validation_ml/persistent-tremor-recomputed.json`. 33 matched accepted rows from 97 candidates, four people. | Exploratory reused folds and selected quality-passing rows. Exact membership JSON is absent from this checkout. Not untouched confirmation. |
| CI configuration and local combined checks | `.github/workflows/check.yml` configures disposable PostgreSQL route tests, scoped branch coverage, the artifact metric check, frontend build and Playwright suite. YAML parsed locally. `pnpm build` passed (existing >500 kB chunk warning); `pnpm test:e2e` passed 18, skipped 6, failed 0. | No GitHub Actions run has occurred; workflow setup is not CI execution evidence. |
| User acceptance | Protocol and SUS scoring guidance prepared in `user-acceptance-protocol.md`. | No actual participants, physical devices, SUS responses or user acceptance results have been collected. |

The valid-clip journey used `replens-video-1.MOV`, a local read-only source, and the public pose model through an ignored symlink. The runner started Uvicorn on loopback with auth/database/email configuration unset. No account, database, or real email was used; screenshots/traces were disabled. Hardware was Apple M5 with 16 GiB RAM, Node 26.8.1 and Python 3.12.14. The test asserted the results and rep exploration headings, but did not separately instrument API accepted-to-completed timing, clip metadata, result count, or selected model; do not claim those values.

## Scoped backend coverage

Coverage was collected from the same 34-test PostgreSQL-backed full discovery run with `coverage run --branch`. It is descriptive; no arbitrary total-coverage target was set. The selected sources were `app.backend.auth`, `app.backend.routes`, `app.backend.services` and `app.backend.sessions`.

| Module | Coverage |
|---|---:|
| `auth.routes` | 88% |
| `sessions.routes` | 98% |
| `services.jobs` | 94% |
| `services.analysis` | 11% |
| `services.linear_predictor` | 49% |
| `services.motion_features` | 38% |
| `services.pose_landmarks` | 9% |
| `services.pose_tracking` | 9% |
| Scoped total | 57% |

Low analysis/pose coverage reflects mocked job lifecycle and the absence of broad real-video assertions in unittest coverage. The one successful private clip journey is functional integration evidence; it does not make that code broadly covered.

## Research interpretation

On this matched subset, the participant-macro MAE is 2.2512 repetitions for speed-only and 2.2215 for speed plus transverse shaking, a 1.32% relative reduction. The historical proposal target was 15%; it was not reached. With examples weighted equally, pooled MAE is 3.0173 and 3.0656 respectively, so it increases slightly. Among reviewed `reps_left <= 2`, the participant-macro MAE is 2.80 vs 3.18 (10 examples, four participants); at `reps_left <= 1`, it is 3.19 vs 3.59 (7 examples, three participants). These small subgroups do not support a proximity-to-failure claim.

Of 97 candidates, 33 passed the frozen tracking quality filter. The 64 exclusions were 42 cases with less than 85% valid wrist/camera tracking and 22 with a tracking gap over two frames or at an edge. The result therefore applies only to a filtered cohort. Do not combine metrics from other cohorts or call MAE “accuracy.” The output is retrospective RIR comparison; RIR is not direct physiological fatigue. Candidate transverse shaking is not validated physiological tremor; image-coordinate wrist movement is not calibrated metres-per-second speed.

## Reproduction and outstanding work

- `python3 scripts/validate_research_artifacts.py` — frozen artifact metric recomputation; no fitting.
- `python3 scripts/check_submission.py` — local submission/syntax/provenance gate (observed passed).
- Reproduced combined backend run: `REPLENS_TEST_DATABASE_URL=... python -m coverage run --branch --source=app.backend.auth,app.backend.routes,app.backend.services,app.backend.sessions -m unittest discover -s app/backend/tests -v`; then `python -m coverage report -m`. The run executed 34 tests with zero skipped; afterward, the new capacity-counter regression test passed alone. Coverage is descriptive with low coverage in full video/pose paths.
- Frontend checks: `cd app/frontend && pnpm build && pnpm test:e2e` (build passed; browser suite 18 passed, 6 opt-in skips). A separate one-clip live journey also passed as described in `browser-results.md`.
- Conduct the physical-device and participant acceptance study before reporting any user acceptance finding. See `user-acceptance-protocol.md`.
- See `traceability.md` for each meeting expectation, the named evidence and its remaining limitation.
