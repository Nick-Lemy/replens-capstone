import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import httpx
import jwt
from fastapi import HTTPException
from pwdlib import PasswordHash
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .config import AuthSettings
from .models import EmailToken, User


passwords = PasswordHash.recommended()
TOKEN_TTL = timedelta(minutes=30)
SESSION_TTL = timedelta(days=7)


def now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    value = email.strip().lower()
    if len(value) > 320 or "@" not in value or "." not in value.rsplit("@", 1)[-1]:
        raise HTTPException(422, "Enter a valid email address")
    return value


def public_user(user: User) -> dict:
    return {"id": user.id, "email": user.email, "name": user.name}


def access_token(user: User, settings: AuthSettings) -> str:
    timestamp = now()
    return jwt.encode(
        {
            "sub": str(user.id),
            "ver": user.token_version,
            "iss": "replens-api",
            "aud": "replens-app",
            "iat": timestamp,
            "exp": timestamp + SESSION_TTL,
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


def authenticated_user(token: str | None, session: Session, settings: AuthSettings) -> User:
    if not token:
        raise HTTPException(401, "Sign in to continue")
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            issuer="replens-api",
            audience="replens-app",
        )
        user = session.get(User, int(payload["sub"]))
        if user is None or not user.verified_at or user.token_version != payload["ver"]:
            raise ValueError("Invalid account")
        return user
    except (jwt.PyJWTError, ValueError, KeyError, TypeError):
        raise HTTPException(401, "Your session has expired. Sign in again") from None


def new_email_token(user: User, kind: str, session: Session) -> str:
    raw = secrets.token_urlsafe(32)
    session.execute(delete(EmailToken).where(EmailToken.user_id == user.id, EmailToken.kind == kind))
    session.add(
        EmailToken(
            user_id=user.id,
            kind=kind,
            token_hash=hashlib.sha256(raw.encode()).hexdigest(),
            expires_at=now() + TOKEN_TTL,
        )
    )
    return raw


def consume_email_token(raw: str, kind: str, session: Session) -> User:
    digest = hashlib.sha256(raw.encode()).hexdigest()
    token = session.scalar(select(EmailToken).where(EmailToken.token_hash == digest, EmailToken.kind == kind))
    if token is None:
        raise HTTPException(400, "This link is invalid or expired")
    expires_at = token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now():
        raise HTTPException(400, "This link is invalid or expired")
    user = session.get(User, token.user_id)
    if user is None:
        raise HTTPException(400, "This link is invalid or expired")
    session.delete(token)
    return user


async def send_email_link(email: str, name: str, kind: str, token: str, settings: AuthSettings):
    action = "Verify email" if kind == "verify" else "Reset password"
    path = "verify" if kind == "verify" else "reset-password"
    link = f"{settings.frontend_url}/?auth={path}&token={quote(token)}"
    message = f"Hello {name},\n\n{action} for your RepLens account:\n{link}\n\nThis link expires in 30 minutes."
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.email_from,
                "to": [email],
                "subject": f"RepLens: {action}",
                "text": message,
            },
        )
        response.raise_for_status()
