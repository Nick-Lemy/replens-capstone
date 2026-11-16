"""Bounded local API capacity scenarios for the RepLens validation database."""

import json
import os
import subprocess
import sys
import time
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from locust import HttpUser, LoadTestShape, between, events, task
import httpx
import gevent
from sqlalchemy import create_engine, delete
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.backend.auth.config import AuthSettings
from app.backend.auth.models import User
from app.backend.auth.service import access_token
from app.backend.sessions.models import SavedSession


DATABASE_URL = os.environ.get("DATABASE_URL", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "")
_engine = None
_user_id = None
_token = None
_started_at = None
_api_host = None
_status_counts = defaultdict(Counter)
_latencies_by_stage = defaultdict(list)
_recovery_probes = []


def _percentile(values, percentile):
    if not values:
        return None
    values = sorted(values)
    return round(values[round((len(values) - 1) * percentile)], 2)


def _validate_environment():
    parsed = urlparse(DATABASE_URL)
    database_name = (parsed.path or "").rsplit("/", 1)[-1].lower()
    if parsed.hostname not in {"127.0.0.1", "localhost", "::1"} or "test" not in database_name:
        raise RuntimeError("Locust capacity runs require a loopback PostgreSQL database with 'test' in its name.")
    if len(JWT_SECRET) < 32:
        raise RuntimeError("Set a disposable JWT_SECRET of at least 32 characters for the local test API.")
    if os.environ.get("REPLENS_COLD_BURST", "0") not in {"0", "1"}:
        raise RuntimeError("REPLENS_COLD_BURST must be 0 or 1.")


def _stage_name(elapsed, active_users):
    stage = int(elapsed // 11)
    if stage >= 9:
        return "finished"
    target = (10, 50, 100)[stage % 3]
    if active_users != target:
        return f"transition_repeat{stage // 3 + 1}_target{target}"
    return f"repeat{stage // 3 + 1}_users{target}"


@events.test_start.add_listener
def prepare_fixture(environment, **_kwargs):
    global _engine, _user_id, _token, _started_at, _api_host
    _validate_environment()
    api_host = urlparse(environment.host or "")
    if api_host.scheme != "http" or api_host.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise RuntimeError("Locust API target must be an HTTP loopback URL; use -H http://127.0.0.1:8101.")
    _api_host = environment.host.rstrip("/")
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "app/backend/alembic.ini", "upgrade", "head"],
        cwd=ROOT,
        check=True,
    )
    _engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    with Session(_engine) as db:
        user = User(
            email=f"locust-{uuid.uuid4().hex}@localhost.invalid",
            name="Locust capacity test",
            password_hash="unused",
            verified_at=datetime.now(timezone.utc),
            token_version=0,
        )
        db.add(user)
        db.flush()
        _user_id = user.id
        for index in range(10):
            db.add(
                SavedSession(
                    id=str(uuid.uuid4()),
                    user_id=_user_id,
                    title=f"Load fixture {index + 1}",
                    result={"fixture": True, "index": index},
                    review=None,
                )
            )
        db.commit()
        settings = AuthSettings(
            DATABASE_URL,
            JWT_SECRET,
            os.environ.get("AUTH_FRONTEND_URL", "http://127.0.0.1:5173"),
            "local-capacity-only",
            "capacity@localhost.invalid",
            False,
        )
        _token = access_token(user, settings)
    _started_at = time.monotonic()
    SessionsUser.session_cookie = _token
    ColdBurstUser.session_cookie = _token
    print("Created one verified synthetic user and ten load fixtures in the dedicated test database.", flush=True)


@events.test_stop.add_listener
def clean_fixture(environment, **_kwargs):
    global _engine
    if os.environ.get("REPLENS_COLD_BURST") == "1" and _token and _api_host:
        deadline = time.monotonic() + 35
        while time.monotonic() < deadline:
            probe_started = time.monotonic()
            try:
                response = httpx.get(
                    _api_host + "/api/sessions",
                    cookies={"replens_session": _token},
                    timeout=1,
                )
                _recovery_probes.append(
                    {
                        "elapsed_after_burst_s": round(probe_started - (_started_at or probe_started), 2),
                        "latency_ms": round((time.monotonic() - probe_started) * 1000, 2),
                        "status": response.status_code,
                    }
                )
                if response.status_code == 200:
                    break
            except httpx.HTTPError as exc:
                _recovery_probes.append(
                    {
                        "elapsed_after_burst_s": round(probe_started - (_started_at or probe_started), 2),
                        "latency_ms": round((time.monotonic() - probe_started) * 1000, 2),
                        "status": "timeout",
                        "error": type(exc).__name__,
                    }
                )
            gevent.sleep(1)
    if _engine is not None and _user_id is not None:
        with Session(_engine) as db:
            db.execute(delete(SavedSession).where(SavedSession.user_id == _user_id))
            db.execute(delete(User).where(User.id == _user_id))
            db.commit()
        _engine.dispose()
        _engine = None
    report_path = os.environ.get("REPLENS_CAPACITY_STATUS_JSON")
    if report_path:
        path = Path(report_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(
                {
                    "endpoint": "GET /api/sessions",
                    "fixture": "one verified synthetic user, ten synthetic sessions",
                    "counts_by_stage": {name: dict(counts) for name, counts in _status_counts.items()},
                    "latency_ms_by_stage": {
                        name: {
                            "all": {
                                "p50": _percentile([latency for _, latency in values], 0.50),
                                "p95": _percentile([latency for _, latency in values], 0.95),
                                "p99": _percentile([latency for _, latency in values], 0.99),
                            },
                            "success_200": {
                                "p50": _percentile([latency for status, latency in values if status == "200"], 0.50),
                                "p95": _percentile([latency for status, latency in values if status == "200"], 0.95),
                                "p99": _percentile([latency for status, latency in values if status == "200"], 0.99),
                            },
                        }
                        for name, values in _latencies_by_stage.items()
                    },
                    "recovery_probes": _recovery_probes,
                    "total": dict(sum((_status_counts[name] for name in _status_counts), Counter())),
                },
                indent=2,
            )
            + "\n"
        )
    print(f"HTTP status counts by stage: {json.dumps({name: dict(counts) for name, counts in _status_counts.items()}, sort_keys=True)}", flush=True)


class SessionsUser(HttpUser):
    wait_time = between(0.75, 1.25)
    session_cookie = None

    def on_start(self):
        if not self.session_cookie:
            raise RuntimeError("Synthetic test session cookie is unavailable.")
        self.client.cookies.set("replens_session", self.session_cookie)

    @task
    def list_sessions(self):
        started = time.monotonic()
        stage = _stage_name(started - (_started_at or started), self.environment.runner.user_count)
        try:
            with self.client.get("/api/sessions", name="GET /api/sessions", timeout=3, catch_response=True) as response:
                if response.status_code == 0:
                    _status_counts[stage]["client_timeout"] += 1
                    _latencies_by_stage[stage].append(("client_timeout", (time.monotonic() - started) * 1000))
                    response.failure("client_timeout")
                else:
                    _status_counts[stage][str(response.status_code)] += 1
                    _latencies_by_stage[stage].append((str(response.status_code), response.elapsed.total_seconds() * 1000))
                if response.status_code in {429, 503}:
                    response.failure(f"expected-overload-{response.status_code}")
                elif response.status_code not in {0, 200}:
                    response.failure(f"unexpected-status-{response.status_code}")
                elif response.status_code == 200:
                    response.success()
        except Exception as exc:
            _status_counts[stage]["client_error"] += 1
            _latencies_by_stage[stage].append(("client_error", (time.monotonic() - started) * 1000))
            raise exc


class ColdBurstUser(HttpUser):
    wait_time = between(10, 10)
    session_cookie = None

    def on_start(self):
        if not self.session_cookie:
            raise RuntimeError("Synthetic test session cookie is unavailable.")
        self.client.cookies.set("replens_session", self.session_cookie)

    @task
    def single_request(self):
        started = time.monotonic()
        try:
            with self.client.get("/api/sessions", name="GET /api/sessions [cold burst]", timeout=3, catch_response=True) as response:
                if response.status_code == 0:
                    _status_counts["cold_burst"]["client_timeout"] += 1
                    _latencies_by_stage["cold_burst"].append(("client_timeout", (time.monotonic() - started) * 1000))
                    response.failure("client_timeout")
                else:
                    _status_counts["cold_burst"][str(response.status_code)] += 1
                    _latencies_by_stage["cold_burst"].append((str(response.status_code), response.elapsed.total_seconds() * 1000))
                if response.status_code in {429, 503}:
                    response.failure(f"expected-overload-{response.status_code}")
                elif response.status_code not in {0, 200}:
                    response.failure(f"unexpected-status-{response.status_code}")
                elif response.status_code == 200:
                    response.success()
        except Exception as exc:
            _status_counts["cold_burst"]["client_error"] += 1
            _latencies_by_stage["cold_burst"].append(("client_error", (time.monotonic() - started) * 1000))
            raise exc


class CapacityShape(LoadTestShape):
    def tick(self):
        elapsed = self.get_run_time()
        if os.environ.get("REPLENS_COLD_BURST") == "1":
            if elapsed < 5:
                return 100, 100
            return None
        stage = int(elapsed // 11)
        if stage >= 9:
            return None
        user_counts = (10, 50, 100)
        target = user_counts[stage % 3]
        spawn_rate = 10 if stage == 0 else (100 if target in {10, 100} else 50)
        return target, spawn_rate
