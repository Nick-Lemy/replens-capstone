#!/usr/bin/env python3
"""Bounded, local-only authenticated GET /api/sessions capacity probe."""

import argparse
import json
import os
import secrets
import subprocess
import sys
import threading
import time
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import httpx
try:
    import psutil
except ImportError:
    psutil = None
from sqlalchemy import create_engine, delete, text
from sqlalchemy.orm import Session

from app.backend.auth.models import User
from app.backend.auth.service import access_token
from app.backend.auth.config import AuthSettings
from app.backend.sessions.models import SavedSession


def safe_test_url(url):
    from urllib.parse import urlparse

    parsed = urlparse(url)
    if parsed.hostname not in {"127.0.0.1", "localhost", "::1"} or "test" not in (parsed.path or "").lower():
        raise SystemExit("DATABASE_URL must target loopback and a database name containing 'test'.")


def percentile(values, percentile_value):
    if not values:
        return None
    values = sorted(values)
    index = round((len(values) - 1) * percentile_value)
    return round(values[index] * 1000, 2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8101")
    parser.add_argument("--users", type=int, nargs="+", default=[10, 50, 100])
    parser.add_argument("--seconds", type=int, default=10)
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--timeout", type=float, default=3.0)
    parser.add_argument("--output", default="training/results/validation_capacity/sessions-load.json")
    args = parser.parse_args()
    if args.users != sorted(set(args.users)) or any(count < 1 or count > 250 for count in args.users):
        raise SystemExit("--users must be increasing unique values between 1 and 250.")
    if not (1 <= args.seconds <= 60 and 1 <= args.repeats <= 3 and 0.1 <= args.timeout <= 10):
        raise SystemExit("Bounded limits: seconds 1..60, repeats 1..3, timeout 0.1..10.")

    url = os.environ.get("DATABASE_URL", "")
    safe_test_url(url)
    secret = os.environ.setdefault("JWT_SECRET", secrets.token_urlsafe(48))
    os.environ.setdefault("AUTH_FRONTEND_URL", "http://127.0.0.1:5173")
    os.environ.setdefault("RESEND_API_KEY", "capacity-test-only")
    os.environ.setdefault("EMAIL_FROM", "capacity-test@localhost.invalid")
    settings = AuthSettings(url, secret, os.environ["AUTH_FRONTEND_URL"], os.environ["RESEND_API_KEY"], os.environ["EMAIL_FROM"], False)

    subprocess.run([sys.executable, "-m", "alembic", "-c", "app/backend/alembic.ini", "upgrade", "head"], cwd=ROOT, check=True)
    engine = create_engine(url, pool_pre_ping=True)
    user_id = None
    token = None
    try:
        with Session(engine) as db:
            user = User(email=f"capacity-{uuid.uuid4().hex}@localhost.invalid", name="Capacity test", password_hash="unused", verified_at=datetime.now(timezone.utc), token_version=0)
            db.add(user)
            db.flush()
            user_id = user.id
            for index in range(10):
                db.add(SavedSession(id=str(uuid.uuid4()), user_id=user_id, title=f"Capacity fixture {index + 1}", result={"fixture": True, "index": index}, review=None))
            db.commit()
            token = access_token(user, settings)

        server_env = os.environ.copy()
        server = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.backend.main:app", "--host", "127.0.0.1", "--port", "8101", "--log-level", "warning"], cwd=ROOT, env=server_env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        server_logs = []
        def collect_server_logs():
            for line in server.stderr:
                if len(server_logs) < 5000:
                    server_logs.append(line.rstrip()[:500])
        log_reader = threading.Thread(target=collect_server_logs, daemon=True)
        log_reader.start()
        database_samples = []
        database_monitor_stop = threading.Event()
        def monitor_database():
            try:
                with engine.connect() as connection:
                    while not database_monitor_stop.is_set():
                        rows = connection.execute(text("""SELECT datname, usename, state, wait_event_type, wait_event, count(*) AS count FROM pg_stat_activity WHERE pid <> pg_backend_pid() GROUP BY datname, usename, state, wait_event_type, wait_event""")).mappings().all()
                        database_samples.append({"elapsed_s": round(time.monotonic() - server_start, 2), "activity": [dict(row) for row in rows]})
                        connection.commit()
                        database_monitor_stop.wait(0.5)
            except Exception as exc:
                database_samples.append({"monitor_error": type(exc).__name__})
        server_start = time.monotonic()
        db_monitor = threading.Thread(target=monitor_database, daemon=True)
        db_monitor.start()
        try:
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                if server.poll() is not None:
                    raise RuntimeError(f"uvicorn exited: {server.stderr.read()[-1000:]}")
                try:
                    response = httpx.get(args.base_url + "/api/health", timeout=0.5)
                    if response.status_code == 200:
                        break
                except httpx.HTTPError:
                    time.sleep(0.1)
            else:
                raise RuntimeError("local API did not become healthy within 15 seconds")

            all_results = []
            for repeat in range(1, args.repeats + 1):
                for user_count in args.users:
                    observations = []
                    lock = threading.Lock()
                    barrier = threading.Barrier(user_count + 1)

                    def client_loop(virtual_user):
                        with httpx.Client(timeout=args.timeout, cookies={"replens_session": token}) as client:
                            barrier.wait()
                            start = time.monotonic()
                            next_request = start
                            finish = start + args.seconds
                            while next_request < finish:
                                delay = next_request - time.monotonic()
                                if delay > 0:
                                    time.sleep(delay)
                                sent = time.monotonic()
                                try:
                                    response = client.get(args.base_url + "/api/sessions")
                                    observation = {"latency_s": time.monotonic() - sent, "status": str(response.status_code), "endpoint": "/api/sessions", "error": None}
                                except httpx.TimeoutException as exc:
                                    observation = {"latency_s": time.monotonic() - sent, "status": "timeout", "endpoint": "/api/sessions", "error": type(exc).__name__}
                                except httpx.HTTPError as exc:
                                    observation = {"latency_s": time.monotonic() - sent, "status": "client_error", "endpoint": "/api/sessions", "error": type(exc).__name__}
                                observation["virtual_user"] = virtual_user
                                with lock:
                                    observations.append(observation)
                                next_request = max(next_request + 1, time.monotonic() + 1)

                    threads = [threading.Thread(target=client_loop, args=(index,)) for index in range(user_count)]
                    for thread in threads:
                        thread.start()
                    barrier.wait()
                    stage_start = time.monotonic()
                    stop_sampling = threading.Event()
                    resource_samples = []
                    def sample_resources():
                        if psutil is None:
                            return
                        try:
                            proc = psutil.Process(server.pid)
                            while not stop_sampling.is_set():
                                resource_samples.append({"rss_mb": proc.memory_info().rss / (1024 * 1024), "cpu_percent": proc.cpu_percent(interval=None)})
                                stop_sampling.wait(0.25)
                        except (psutil.NoSuchProcess, psutil.AccessDenied):
                            pass
                    sampler = threading.Thread(target=sample_resources, daemon=True)
                    sampler.start()
                    for thread in threads:
                        thread.join(args.seconds + args.timeout + 2)
                    stop_sampling.set()
                    sampler.join(1)
                    stuck = sum(thread.is_alive() for thread in threads)
                    counts = Counter(item["status"] for item in observations)
                    successful = [item["latency_s"] for item in observations if item["status"] == "200"]
                    all_latency = [item["latency_s"] for item in observations]
                    elapsed = time.monotonic() - stage_start
                    stage = {"repeat": repeat, "users": user_count, "configured_seconds": args.seconds, "actual_seconds": round(elapsed, 3), "attempts": len(observations), "achieved_rps": round(len(observations) / args.seconds, 2), "status_counts": dict(counts), "success_latency_ms": {"p50": percentile(successful, .50), "p95": percentile(successful, .95), "p99": percentile(successful, .99)}, "all_request_latency_ms": {"p50": percentile(all_latency, .50), "p95": percentile(all_latency, .95), "p99": percentile(all_latency, .99)}, "process_resource_peak_rss_mb": round(max((sample["rss_mb"] for sample in resource_samples), default=0), 1) if resource_samples else None, "process_resource_avg_cpu_percent": round(sum(sample["cpu_percent"] for sample in resource_samples) / len(resource_samples), 1) if resource_samples else None, "resource_sample_count": len(resource_samples), "client_timeouts": counts.get("timeout", 0), "client_errors": counts.get("client_error", 0), "stuck_threads": stuck}
                    all_results.append(stage)
                    print(json.dumps(stage), flush=True)
                    if stuck:
                        raise RuntimeError("load threads exceeded bounded join; stopping run")
                    if counts.get("500", 0) or counts.get("503", 0) or counts.get("timeout", 0) or counts.get("client_error", 0):
                        recovery = []
                        recovery_deadline = time.monotonic() + 35
                        while time.monotonic() < recovery_deadline:
                            probe_started = time.monotonic()
                            try:
                                probe = httpx.get(args.base_url + "/api/sessions", cookies={"replens_session": token}, timeout=1.0)
                                recovery.append({"elapsed_after_overload_s": round(probe_started - stage_start, 2), "latency_ms": round((time.monotonic() - probe_started) * 1000, 2), "status": probe.status_code})
                                if probe.status_code == 200:
                                    break
                            except httpx.HTTPError as exc:
                                recovery.append({"elapsed_after_overload_s": round(probe_started - stage_start, 2), "latency_ms": round((time.monotonic() - probe_started) * 1000, 2), "status": "timeout", "error": type(exc).__name__})
                            time.sleep(1)
                        stage["recovery_probes"] = recovery
                        stage["slow_request_logs"] = list(server_logs)
                        break
                if any(stage["client_timeouts"] or stage["client_errors"] or stage["status_counts"].get("500", 0) for stage in all_results if stage["repeat"] == repeat):
                    break
            document = {"metadata": {"base_url": args.base_url, "endpoint": "GET /api/sessions", "database": "loopback _test database", "configured_users_per_stage": args.users, "seconds_per_stage": args.seconds, "repeats": args.repeats, "request_interval_seconds_per_user": 1, "timeout_seconds": args.timeout, "python": sys.version, "commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()}, "stages": all_results}
            document["database_activity_samples"] = database_samples
            document["server_logs"] = list(server_logs)
            output = ROOT / args.output
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps(document, indent=2) + "\n")
        finally:
            database_monitor_stop.set()
            db_monitor.join(2)
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=3)
            log_reader.join(2)
    finally:
        if user_id is not None:
            with Session(engine) as db:
                db.execute(delete(SavedSession).where(SavedSession.user_id == user_id))
                db.execute(delete(User).where(User.id == user_id))
                db.commit()
        engine.dispose()


if __name__ == "__main__":
    main()
