import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.backend.config.settings import FRONTEND_ORIGINS

from .config import AuthSettings, get_settings
from .database import get_session
from .limits import limit
from .models import User
from .service import (
    SESSION_TTL,
    access_token,
    authenticated_user,
    consume_email_token,
    new_email_token,
    normalize_email,
    now,
    passwords,
    public_user,
    send_email_link,
)


router = APIRouter(prefix="/api/auth", tags=["Authentication"])
COOKIE_NAME = "replens_session"


class Credentials(BaseModel):
    email: str
    password: str = Field(min_length=10, max_length=128)


class Registration(Credentials):
    name: str = Field(min_length=1, max_length=120)


class EmailRequest(BaseModel):
    email: str


class TokenRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class PasswordReset(TokenRequest):
    password: str = Field(min_length=10, max_length=128)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10, max_length=128)


def require_enabled() -> AuthSettings:
    settings = get_settings()
    if not settings.enabled:
        raise HTTPException(503, "Accounts are not configured yet")
    return settings


def check_origin(request: Request, settings: AuthSettings = Depends(require_enabled)):
    origin = request.headers.get("origin")
    if origin and origin not in FRONTEND_ORIGINS and origin != settings.frontend_url:
        raise HTTPException(403, "Origin is not allowed")


def current_user(
    session_token: str | None = Cookie(None, alias=COOKIE_NAME),
    session: Session = Depends(get_session),
    settings: AuthSettings = Depends(require_enabled),
) -> User:
    return authenticated_user(session_token, session, settings)


def set_cookie(response: Response, user: User, settings: AuthSettings):
    response.set_cookie(
        COOKIE_NAME,
        access_token(user, settings),
        max_age=int(SESSION_TTL.total_seconds()),
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/api/auth",
    )


@router.get("/status")
def status():
    return {"enabled": get_settings().enabled}


@router.post("/register", dependencies=[Depends(check_origin)])
async def register(data: Registration, request: Request, session: Session = Depends(get_session), settings: AuthSettings = Depends(require_enabled)):
    email = normalize_email(data.email)
    limit(request, "register", email, 3, 3600)
    name = data.name.strip()
    if not name:
        raise HTTPException(422, "Enter your name")
    existing = session.scalar(select(User).where(User.email == email))
    if existing:
        raise HTTPException(409, "An account with this email already exists")
    user = User(email=email, name=name, password_hash=passwords.hash(data.password), token_version=0)
    session.add(user)
    try:
        session.flush()
        token = new_email_token(user, "verify", session)
        await send_email_link(email, name, "verify", token, settings)
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "An account with this email already exists") from None
    except httpx.HTTPError:
        session.rollback()
        raise HTTPException(503, "Verification email could not be sent. Try again") from None
    return {"message": "Check your email to verify your account"}


@router.post("/verify", dependencies=[Depends(check_origin)])
def verify(data: TokenRequest, response: Response, session: Session = Depends(get_session), settings: AuthSettings = Depends(require_enabled)):
    user = consume_email_token(data.token, "verify", session)
    user.verified_at = now()
    session.commit()
    set_cookie(response, user, settings)
    return {"user": public_user(user)}


@router.post("/login", dependencies=[Depends(check_origin)])
def login(data: Credentials, request: Request, response: Response, session: Session = Depends(get_session), settings: AuthSettings = Depends(require_enabled)):
    email = normalize_email(data.email)
    limit(request, "login", email, 10, 600)
    user = session.scalar(select(User).where(User.email == email))
    if user is None or not passwords.verify(data.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    if user.verified_at is None:
        raise HTTPException(403, "Verify your email before signing in")
    set_cookie(response, user, settings)
    return {"user": public_user(user)}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return {"user": public_user(user)}


@router.post("/logout", dependencies=[Depends(check_origin)])
def logout(response: Response, user: User = Depends(current_user), session: Session = Depends(get_session)):
    user.token_version += 1
    session.commit()
    response.delete_cookie(COOKIE_NAME, path="/api/auth")
    return {"message": "Signed out"}


@router.post("/forgot-password", dependencies=[Depends(check_origin)])
async def forgot_password(data: EmailRequest, request: Request, session: Session = Depends(get_session), settings: AuthSettings = Depends(require_enabled)):
    email = normalize_email(data.email)
    limit(request, "forgot", email, 2, 300)
    user = session.scalar(select(User).where(User.email == email))
    if user and user.verified_at:
        token = new_email_token(user, "reset", session)
        try:
            await send_email_link(user.email, user.name, "reset", token, settings)
            session.commit()
        except httpx.HTTPError:
            session.rollback()
    return {"message": "If an account exists, a reset link has been sent"}


@router.post("/resend-verification", dependencies=[Depends(check_origin)])
async def resend_verification(data: EmailRequest, request: Request, session: Session = Depends(get_session), settings: AuthSettings = Depends(require_enabled)):
    email = normalize_email(data.email)
    limit(request, "resend", email, 2, 300)
    user = session.scalar(select(User).where(User.email == email))
    if user and user.verified_at is None:
        token = new_email_token(user, "verify", session)
        try:
            await send_email_link(user.email, user.name, "verify", token, settings)
            session.commit()
        except httpx.HTTPError:
            session.rollback()
    return {"message": "If the account needs verification, a new link has been sent"}


@router.post("/reset-password", dependencies=[Depends(check_origin)])
def reset_password(data: PasswordReset, response: Response, session: Session = Depends(get_session), settings: AuthSettings = Depends(require_enabled)):
    user = consume_email_token(data.token, "reset", session)
    user.password_hash = passwords.hash(data.password)
    user.token_version += 1
    session.commit()
    response.delete_cookie(COOKIE_NAME, path="/api/auth")
    return {"message": "Password changed. Sign in with your new password"}


@router.post("/change-password", dependencies=[Depends(check_origin)])
def change_password(data: PasswordChange, response: Response, user: User = Depends(current_user), session: Session = Depends(get_session), settings: AuthSettings = Depends(require_enabled)):
    if not passwords.verify(data.current_password, user.password_hash):
        raise HTTPException(401, "Current password is incorrect")
    user.password_hash = passwords.hash(data.new_password)
    user.token_version += 1
    session.commit()
    set_cookie(response, user, settings)
    return {"message": "Password changed"}
