# Capacity validation

## Scope and expected outcomes

These are bounded local measurements, not a production capacity claim or SLA. The sessions workload should complete at the requested 10, 50, and 100-user stages without timeouts; any overload response, client timeout, and server error must remain separately visible. The analysis manager should admit no more than three in-flight uploads, return 429 for excess uploads, process admitted work serially, and remove temporary inputs on completion or failure.

The API workload uses only `127.0.0.1`, a dedicated disposable PostgreSQL database with `test` in its name, a synthetic verified user, and ten synthetic saved-session rows. It calls `GET /api/sessions` with a real JWT cookie and 0.75–1.25 seconds of per-user think time. The separate video workload uses two private read-only clips and the `speed_only` model; it is not mixed into the sessions load test.

## Sessions API overload diagnosis

An earlier local run (historical evidence) had 10- and 50-user stages succeeding, but a 100-user stage produced read timeouts and slow recovery. In the reproduced synchronized burst, pool diagnostics showed repeated engine creation during concurrent first requests (40 `db_pool_config` initializations), and PostgreSQL showed many idle-in-transaction connections. SQLAlchemy then logged QueuePool timeouts. The root cause was concurrent cache misses in `functools.lru_cache`: its cache is thread-safe, but it does not guarantee a single execution for simultaneous misses. Each engine owned its own pool, so the configured per-engine pool bound did not bound process connections.

Engine initialization now uses a lock-protected singleton. Session dependencies close before response transmission, and a nonblocking process-local database admission gate bounds checked-out database work to the configured pool plus overflow (defaults: 5 + 10 connections per process). Requests beyond that budget receive HTTP 503 with `Retry-After: 2`; SQLAlchemy pool timeout is also bounded to two seconds and mapped to 503. This limits database concurrency and returns overload explicitly; it does not increase service capacity. Each API process has its own gate and pool, so deployments with multiple processes need a corresponding total connection budget.

## Locust paced sessions run

Locust 2.47.0 ran three repeats of 10, 50, and 100 simulated users, with 11 seconds per stage (ramp plus a short plateau). The three-repeat plateau counts were 10 users: 112, 105, 110 requests; 50 users: 516, 516, 528; 100 users: 1,045, 1,050, 1,053. All plateau responses were HTTP 200. Across the full run, Locust recorded 5,334 requests, 0 failures, about 53.7 requests/second, median 9 ms, p95 62 ms, p99 100 ms, and max 127 ms. These are aggregate and plateau observations for one local API process, a local database, one synthetic account, and this endpoint only. The paced Locust workload is not directly comparable to the historical synchronized custom-harness run.

Artifacts: [`locust-warm-final.html`](../../training/results/validation_capacity/locust-warm-final.html), [`locust-warm-final_stats.csv`](../../training/results/validation_capacity/locust-warm-final_stats.csv), [`locust-warm-final_stats_history.csv`](../../training/results/validation_capacity/locust-warm-final_stats_history.csv), [`locust-warm-final-status.json`](../../training/results/validation_capacity/locust-warm-final-status.json). The actual dashboard screenshot [`locust-live-dashboard-100users.png`](../../training/results/validation_capacity/locust-live-dashboard-100users.png) is a point-in-time plateau in this post-gate run (100 users, 987 requests at capture, 0 failures, 53.6 current RPS, p95 90 ms, p99 120 ms), not the full-run summary or an SLA. The matching full report and UI screenshot are [`locust-warm-final.html`](../../training/results/validation_capacity/locust-warm-final.html) and [`locust-warm-final-report.png`](../../training/results/validation_capacity/locust-warm-final-report.png). Older [`locust-report-full.png`](../../training/results/validation_capacity/locust-report-full.png) is retained from the earlier pre-final run and is not used for post-gate claims.

## Cold burst and recovery

A synchronized 100-user cold burst against the single-process API completed with 15 HTTP 200 and 85 HTTP 503 responses, zero client timeouts, and no 429s (the sessions endpoint has no job-admission limit). Response latency p50 was 90.7 ms and p95 141.5 ms. A follow-up request succeeded with HTTP 200 at 4.73 seconds after the burst began (26.7 ms response time). Locust exits nonzero for this run because its configured failure accounting correctly records HTTP 503 as failures; those are expected overload responses, not hidden or converted to successes. The gate bounds concurrent DB checkouts and fails fast; it does not promise that 100 requests all succeed.

Artifacts: [`locust-cold-burst-gated.html`](../../training/results/validation_capacity/locust-cold-burst-gated.html), [`locust-cold-burst-gated_stats.csv`](../../training/results/validation_capacity/locust-cold-burst-gated_stats.csv), and [`locust-cold-burst-gated-status.json`](../../training/results/validation_capacity/locust-cold-burst-gated-status.json). Earlier pre-gate experiments are retained separately and are not reported as post-fix results.

## Real analysis job measurements

On Apple M5 (10 logical/physical cores, 16 GiB RAM), macOS 26.6.2, Python 3.12.14, one local API process and one analysis worker, two H.264 source clips completed with the `speed_only` bundle. The 19.432-second 1076×1706 clip (28.4 MB) was accepted 62 ms after upload and completed 18.829 seconds after acceptance with 9 detected repetitions; six estimates were available on reps 4–9 and three early reps were in the history-building state. The 36.463-second 1080×1746 clip (54.0 MB) was accepted in 92 ms and completed 34.071 seconds after acceptance with 18 detected repetitions; seven estimates were available, three reps were history-building, and eight were unavailable. A separate direct analysis diagnostic on that same source hash and bundle found 98.08% overall pose tracking and the eight unavailable windows each rejected by the two-frame tracking-gap gate. These are local measurements on these inputs and this hardware, not a generalized per-second throughput claim. The API process peak sampled RSS was 611.2 MB and average sampled CPU was 211.9% (about 2.1 cores) during the combined run.

The first version of the benchmark wrote zero available predictions for every rep because its counter looked for `prediction` or `rir_prediction` keys; the API schema actually uses `rir`. The incorrect raw record is preserved as [`video-jobs-before-counter-fix.json`](../../training/results/validation_capacity/video-jobs-before-counter-fix.json). The parser now counts non-null `rir` values (including numeric zero), records `prediction_status` counts, and is covered by `test_counts_rir_field_and_distinguishes_history_from_unavailable`. The corrected benchmark was rerun. No model or inference code was changed for this reporting fix.

Five synchronized uploads of the shorter clip produced exactly three HTTP 202 admissions and two HTTP 429 rejections. All admitted jobs completed serially with 9 reps and six available predictions each: accepted-to-terminal times were 19.111, 37.549, and 55.874 seconds. The first job entered processing about 7 ms after acceptance; queued jobs entered after approximately 19.1 and 37.5 seconds. A separate Playwright browser smoke journey also reached the completed-set review and rep exploration views with the valid private clip, but its 21.1-second whole-test duration includes browser interaction and is not used as backend processing time.

Raw corrected result with source hashes, model hashes, clip metadata, job timings and prediction-status counts: [`video-jobs.json`](../../training/results/validation_capacity/video-jobs.json). Direct availability diagnostics: [`prediction-availability-diagnostic.json`](../../training/results/validation_capacity/prediction-availability-diagnostic.json). Private source videos are not included in this repository. The source videos and pose asset are local-only test inputs.

## Reproduction

Install the optional load-test dependency into a development environment, then start the API with a test-only database URL. Never use a production database URL for these commands.

```sh
python -m pip install -r scripts/requirements-capacity.txt
export DATABASE_URL='postgresql+psycopg://USER:PASSWORD@127.0.0.1:5432/replens_capacity_test'
export JWT_SECRET='use-a-disposable-local-secret-of-at-least-32-characters'
export AUTH_FRONTEND_URL='http://127.0.0.1:5173'
uvicorn app.backend.main:app --host 127.0.0.1 --port 8000
```

In a second terminal, start Locust's web UI (bind it to loopback):

```sh
locust -f scripts/locust_capacity.py --host http://127.0.0.1:8000 --web-host 127.0.0.1
```

Open `http://127.0.0.1:8089`, set 100 users and spawn rate 10, then start. For a headless three-repeat stage sequence with CSV and HTML output, use:

```sh
export REPLENS_CAPACITY_STATUS_JSON=training/results/validation_capacity/locust-warm-status.json
locust -f scripts/locust_capacity.py --host http://127.0.0.1:8000 --headless --csv training/results/validation_capacity/locust-warm --html training/results/validation_capacity/locust-warm.html
```

The custom shape runs for about 99 seconds and ramps through 10, 50, and 100 users three times. For an isolated cold burst, set `REPLENS_COLD_BURST=1` for Locust and use a separate output prefix; keep the API and test database isolated and retain Locust failures as failures. The helper creates and removes its synthetic user and ten rows. See the [Locust configuration guide](https://docs.locust.io/en/stable/configuration.html), [custom load shapes](https://docs.locust.io/en/stable/custom-load-shape.html), and [configuration options](https://docs.locust.io/en/stable/config-options.html).

The real-video measurement is intentionally local-only and requires the private source files and pose asset available to the original developer checkout. It can be rerun with:

```sh
python scripts/benchmark_video_capacity.py
```

The script binds only to `127.0.0.1`, starts and stops its own API process, selects `speed_only`, writes metadata/results under `training/results/validation_capacity/`, and never copies source videos into the worktree.

## Limits

The sessions test covers one API process, one route, one synthetic account, and a local database. The video test covers two clips and a burst of five uploads. No 250-user session stage, physical mobile-device run, network impairment test, multi-replica test, or production service was exercised. The API's analysis queue is in-process and jobs do not survive process restart or distribute across replicas.
