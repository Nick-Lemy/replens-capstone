import os
from dataclasses import dataclass


@dataclass(frozen=True)
class AuthSettings:
    database_url: str
    jwt_secret: str
    frontend_url: str
    resend_api_key: str
    email_from: str
    cookie_secure: bool

    @property
    def enabled(self) -> bool:
        return all(
            (
                self.database_url,
                len(self.jwt_secret) >= 32,
                self.frontend_url,
                self.resend_api_key,
                self.email_from,
            )
        )


def get_settings() -> AuthSettings:
    frontend_url = os.getenv("AUTH_FRONTEND_URL", "").rstrip("/")
    return AuthSettings(
        database_url=os.getenv("DATABASE_URL", ""),
        jwt_secret=os.getenv("JWT_SECRET", ""),
        frontend_url=frontend_url,
        resend_api_key=os.getenv("RESEND_API_KEY", ""),
        email_from=os.getenv("EMAIL_FROM", ""),
        cookie_secure=frontend_url.startswith("https://"),
    )
