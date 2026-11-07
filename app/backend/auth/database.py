from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from fastapi import HTTPException

from .config import get_settings


@lru_cache(maxsize=1)
def get_engine():
    url = get_settings().database_url
    if not url:
        return None
    return create_engine(url, pool_pre_ping=True)


def get_session():
    engine = get_engine()
    if engine is None:
        raise HTTPException(503, "Accounts are not configured yet")
    with Session(engine) as session:
        yield session
