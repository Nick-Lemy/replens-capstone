import logging
import os
from threading import BoundedSemaphore, Lock
from time import monotonic

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from fastapi import HTTPException

from .config import get_settings

logger = logging.getLogger("replens.capacity")
_engine_lock = Lock()
_engine = None
_engine_initialized = False
_db_session_gate = BoundedSemaphore(
    int(os.getenv("REPLENS_DB_POOL_SIZE", "5"))
    + int(os.getenv("REPLENS_DB_MAX_OVERFLOW", "10"))
)


def get_engine():
    global _engine, _engine_initialized
    if not _engine_initialized:
        with _engine_lock:
            if not _engine_initialized:
                url = get_settings().database_url
                if url:
                    _engine = create_engine(
                        url,
                        pool_pre_ping=True,
                        pool_size=int(os.getenv("REPLENS_DB_POOL_SIZE", "5")),
                        max_overflow=int(os.getenv("REPLENS_DB_MAX_OVERFLOW", "10")),
                        pool_timeout=float(os.getenv("REPLENS_DB_POOL_TIMEOUT", "2")),
                    )
                    if os.getenv("REPLENS_DB_DIAGNOSTICS") == "1":
                        logger.warning(
                            "db_pool_config size=%d max_overflow=%d timeout_s=%.1f",
                            int(os.getenv("REPLENS_DB_POOL_SIZE", "5")),
                            int(os.getenv("REPLENS_DB_MAX_OVERFLOW", "10")),
                            float(os.getenv("REPLENS_DB_POOL_TIMEOUT", "2")),
                        )
                        @event.listens_for(_engine, "checkout")
                        def record_checkout(_dbapi_connection, connection_record, _connection_proxy):
                            connection_record.info["checkout_started"] = monotonic()

                        @event.listens_for(_engine, "checkin")
                        def record_checkin(_dbapi_connection, connection_record):
                            started = connection_record.info.pop("checkout_started", None)
                            if started is not None:
                                elapsed_ms = (monotonic() - started) * 1000
                                if elapsed_ms >= 250:
                                    logger.warning("db_connection_lease_ms=%.1f pool_checked_out=%d", elapsed_ms, _engine.pool.checkedout())
                _engine_initialized = True
    return _engine


def _clear_engine_cache():
    global _engine, _engine_initialized
    with _engine_lock:
        if _engine is not None:
            _engine.dispose()
        _engine = None
        _engine_initialized = False


get_engine.cache_clear = _clear_engine_cache


async def get_session():
    engine = get_engine()
    if engine is None:
        raise HTTPException(503, "Accounts are not configured yet")
    if not _db_session_gate.acquire(blocking=False):
        raise HTTPException(
            503,
            "The service is busy. Please try again shortly.",
            headers={"Retry-After": "2"},
        )
    session = Session(engine)
    started = monotonic() if os.getenv("REPLENS_DB_DIAGNOSTICS") == "1" else None
    if started is not None:
        logger.warning("db_session_open session=%s", id(session))
    try:
        yield session
    finally:
        try:
            session.close()
        finally:
            _db_session_gate.release()
        if started is not None:
            logger.warning(
                "db_session_closed session=%s lifetime_ms=%.1f pool_checked_out=%d",
                id(session),
                (monotonic() - started) * 1000,
                engine.pool.checkedout(),
            )
