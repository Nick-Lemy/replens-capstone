"""Route level auth and saved session checks against disposable PostgreSQL."""

import hashlib
import os
import unittest
from urllib.parse import urlparse
from uuid import uuid4
from unittest.mock import AsyncMock, patch


TEST_DATABASE_URL = os.environ.get("REPLENS_TEST_DATABASE_URL", "")


def safe_test_database_url(value: str) -> bool:
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    return (
        parsed.scheme in {"postgres", "postgresql", "postgresql+psycopg", "postgresql+psycopg2"}
        and host in {"localhost", "127.0.0.1", "::1"}
        and "test" in (parsed.path or "").rsplit("/", 1)[-1].lower()
    )


@unittest.skipUnless(safe_test_database_url(TEST_DATABASE_URL), "set REPLENS_TEST_DATABASE_URL to a loopback PostgreSQL database whose name contains 'test'")
class AuthSessionRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.update(
            DATABASE_URL=TEST_DATABASE_URL,
            JWT_SECRET="unit-test-secret-that-is-long-enough-for-hs256",
            AUTH_FRONTEND_URL="http://localhost:5173",
            RESEND_API_KEY="test-resend-key",
            EMAIL_FROM="RepLens Test <test@example.invalid>",
        )
        from alembic import command
        from alembic.config import Config
        from sqlalchemy import create_engine, text

        config = Config("app/backend/alembic.ini")
        command.upgrade(config, "head")
        cls.engine = create_engine(TEST_DATABASE_URL)
        with cls.engine.connect() as connection:
            connection.execute(text("TRUNCATE TABLE saved_sessions, auth_email_tokens, auth_users RESTART IDENTITY CASCADE"))
            connection.commit()

        from app.backend.auth.database import get_engine
        get_engine.cache_clear()
        from app.backend.main import app
        from fastapi.testclient import TestClient
        cls.app = app
        cls.client_type = TestClient

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def setUp(self):
        with self.engine.connect() as connection:
            connection.execute(self._text("TRUNCATE TABLE saved_sessions, auth_email_tokens, auth_users RESTART IDENTITY CASCADE"))
            connection.commit()
        from app.backend.auth import limits
        with limits._lock:
            limits._attempts.clear()
        self.client = self.client_type(self.app)
        self.addCleanup(self.client.close)

    @staticmethod
    def _text(sql):
        from sqlalchemy import text
        return text(sql)

    def register(self, email="lifter@example.test", name=" Lifter ", password="StrongPass123!"):
        with patch("app.backend.auth.routes.send_email_link", new_callable=AsyncMock) as sender:
            response = self.client.post("/api/auth/register", json={"email": email, "name": name, "password": password})
        return response, sender

    def token_from_mail(self, sender):
        return sender.await_args.args[3]

    def verified_account(self, email="lifter@example.test", password="StrongPass123!"):
        response, sender = self.register(email=email, password=password)
        self.assertEqual(response.status_code, 200, response.text)
        verify = self.client.post("/api/auth/verify", json={"token": self.token_from_mail(sender)})
        self.assertEqual(verify.status_code, 200, verify.text)
        self.client.cookies.clear()
        return verify.json()["user"]

    def login(self, email="lifter@example.test", password="StrongPass123!"):
        response = self.client.post("/api/auth/login", json={"email": email, "password": password})
        self.assertEqual(response.status_code, 200, response.text)
        return response

    def test_registration_validation_normalization_duplicate_and_verification_login(self):
        for body in (
            {"email": "x@example.test", "name": "  ", "password": "StrongPass123!"},
            {"email": "not-an-email", "name": "Name", "password": "StrongPass123!"},
            {"email": "x@example.test", "name": "Name", "password": "weak"},
        ):
            self.assertEqual(self.client.post("/api/auth/register", json=body).status_code, 422)
        response, sender = self.register("  LIFTER@Example.Test ")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(sender.await_count, 1)
        duplicate, _ = self.register("lifter@example.test")
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "lifter@example.test", "password": "StrongPass123!"}).status_code, 403)
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "lifter@example.test", "password": "wrong-password"}).status_code, 401)
        verified = self.client.post("/api/auth/verify", json={"token": self.token_from_mail(sender)})
        self.assertEqual(verified.status_code, 200)
        cookie = self.client.cookies.get("replens_session")
        self.assertTrue(cookie)
        self.client.cookies.clear()
        login = self.client.post("/api/auth/login", json={"email": " LIFTER@example.test ", "password": "StrongPass123!"})
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()["user"]["email"], "lifter@example.test")
        self.assertIn("httponly", login.headers["set-cookie"].lower())
        self.assertIn("samesite=lax", login.headers["set-cookie"].lower())
        self.assertIn("path=/api", login.headers["set-cookie"].lower())

    def test_email_tokens_reject_wrong_kind_expired_reused_and_bad_tokens(self):
        _, verification_mail = self.register()
        verify_token = self.token_from_mail(verification_mail)
        self.assertEqual(self.client.post("/api/auth/reset-password", json={"token": verify_token, "password": "AnotherStrong123!"}).status_code, 400)
        self.assertEqual(self.client.post("/api/auth/verify", json={"token": "x" * 32}).status_code, 400)
        self.assertEqual(self.client.post("/api/auth/verify", json={"token": verify_token}).status_code, 200)
        self.assertEqual(self.client.post("/api/auth/verify", json={"token": verify_token}).status_code, 400)
        self.client.cookies.clear()
        self.client.post("/api/auth/login", json={"email": "lifter@example.test", "password": "StrongPass123!"})
        with patch("app.backend.auth.routes.send_email_link", new_callable=AsyncMock) as sender:
            self.client.post("/api/auth/forgot-password", json={"email": "lifter@example.test"})
        expired_token = self.token_from_mail(sender)
        with self.engine.connect() as connection:
            connection.execute(self._text("UPDATE auth_email_tokens SET expires_at = NOW() - INTERVAL '1 minute' WHERE token_hash = :digest"), {"digest": hashlib.sha256(expired_token.encode()).hexdigest()})
            connection.commit()
        self.client.cookies.clear()
        self.assertEqual(self.client.post("/api/auth/reset-password", json={"token": expired_token, "password": "AnotherStrong123!"}).status_code, 400)

    def test_forgot_password_is_generic_and_email_failure_rolls_back_registration(self):
        missing = self.client.post("/api/auth/forgot-password", json={"email": "nobody@example.test"})
        self.assertEqual(missing.status_code, 200)
        with patch("app.backend.auth.routes.send_email_link", new_callable=AsyncMock, side_effect=__import__("httpx").HTTPError("mail unavailable")):
            failed = self.client.post("/api/auth/register", json={"email": "rollback@example.test", "name": "Rollback", "password": "StrongPass123!"})
        self.assertEqual(failed.status_code, 503)
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "rollback@example.test", "password": "StrongPass123!"}).status_code, 401)
        self.verified_account()
        with patch("app.backend.auth.routes.send_email_link", new_callable=AsyncMock, side_effect=__import__("httpx").HTTPError("mail unavailable")):
            failed_reset = self.client.post("/api/auth/forgot-password", json={"email": "lifter@example.test"})
        self.assertEqual(failed_reset.status_code, 200)
        with self.engine.connect() as connection:
            token_count = connection.execute(self._text("SELECT COUNT(*) FROM auth_email_tokens WHERE kind = 'reset'")).scalar_one()
        self.assertEqual(token_count, 0)

    def test_jwt_tamper_logout_password_change_reset_revoke_old_tokens(self):
        self.verified_account()
        self.login()
        token = self.client.cookies.get("replens_session")
        self.client.cookies.clear()
        tampered = token[:-1] + ("a" if token[-1] != "a" else "b")
        self.client.cookies.set("replens_session", tampered)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)
        self.client.cookies.clear()
        self.client.post("/api/auth/login", json={"email": "lifter@example.test", "password": "StrongPass123!"})
        before_change = self.client.cookies.get("replens_session")
        wrong = self.client.post("/api/auth/change-password", json={"current_password": "bad-current", "new_password": "AnotherStrong123!"})
        self.assertEqual(wrong.status_code, 401)
        changed = self.client.post("/api/auth/change-password", json={"current_password": "StrongPass123!", "new_password": "AnotherStrong123!"})
        self.assertEqual(changed.status_code, 200)
        self.client.cookies.clear()
        self.client.cookies.set("replens_session", before_change)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)
        self.client.cookies.clear()
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "lifter@example.test", "password": "AnotherStrong123!"}).status_code, 200)
        before_reset = self.client.cookies.get("replens_session")
        with patch("app.backend.auth.routes.send_email_link", new_callable=AsyncMock) as reset_mail:
            self.assertEqual(self.client.post("/api/auth/forgot-password", json={"email": "lifter@example.test"}).status_code, 200)
        reset = self.client.post("/api/auth/reset-password", json={"token": self.token_from_mail(reset_mail), "password": "ResetPass12345!"})
        self.assertEqual(reset.status_code, 200)
        self.client.cookies.clear()
        self.client.cookies.set("replens_session", before_reset)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)
        self.client.cookies.clear()
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "lifter@example.test", "password": "ResetPass12345!"}).status_code, 200)
        logout_token = self.client.cookies.get("replens_session")
        self.assertEqual(self.client.post("/api/auth/logout").status_code, 200)
        self.client.cookies.clear()
        self.client.cookies.set("replens_session", logout_token)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

    def test_origin_cookie_security_and_expired_jwt(self):
        denied = self.client.post("/api/auth/register", headers={"Origin": "https://attacker.invalid"}, json={"email": "a@b.test", "name": "A", "password": "StrongPass123!"})
        self.assertEqual(denied.status_code, 403)
        self.verified_account()
        self.client.cookies.clear()
        self.client.post("/api/auth/login", json={"email": "lifter@example.test", "password": "StrongPass123!"})
        from app.backend.auth.config import get_settings
        from app.backend.auth.models import User
        from app.backend.auth.database import get_engine
        from sqlalchemy.orm import Session
        from datetime import timedelta
        import jwt
        with Session(get_engine()) as db:
            user = db.query(User).filter_by(email="lifter@example.test").one()
            expired = jwt.encode({"sub": str(user.id), "ver": user.token_version, "iss": "replens-api", "aud": "replens-app", "iat": user.created_at, "exp": user.created_at - timedelta(seconds=1)}, get_settings().jwt_secret, algorithm="HS256")
        self.client.cookies.clear()
        self.client.cookies.set("replens_session", expired)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

    def test_private_saved_session_json_roundtrip_and_cross_user_crud_protection(self):
        self.verified_account("a@example.test")
        self.login("a@example.test")
        session_id = str(uuid4())
        body = {"title": "  Set review  ", "result": {"rep_count": 1, "reps": [{"rep": 1, "rir": 2}], "duration_s": 8.5}, "review": {"rir": 2, "label": "reviewed"}}
        saved = self.client.put(f"/api/sessions/{session_id}", json=body)
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(saved.json()["title"], "Set review")
        self.assertEqual(saved.json()["result"], body["result"])
        self.assertEqual(saved.json()["review"], body["review"])
        self.assertEqual(self.client.get("/api/sessions").json()[0]["id"], session_id)
        self.client.post("/api/auth/logout")
        self.client.cookies.clear()
        self.verified_account("b@example.test")
        self.login("b@example.test")
        self.assertEqual(self.client.get("/api/sessions").json(), [])
        self.assertEqual(self.client.get(f"/api/sessions/{session_id}").status_code, 404)
        self.assertEqual(self.client.put(f"/api/sessions/{session_id}", json=body).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/sessions/{session_id}").status_code, 404)
        self.client.post("/api/auth/logout")
        self.client.cookies.clear()
        self.client.post("/api/auth/login", json={"email": "a@example.test", "password": "StrongPass123!"})
        stored = self.client.get(f"/api/sessions/{session_id}")
        self.assertEqual(stored.status_code, 200)
        self.assertEqual(stored.json()["review"]["label"], "reviewed")
        self.assertEqual(self.client.delete(f"/api/sessions/{session_id}").status_code, 204)

    def test_saved_session_rejects_arbitrary_or_invalid_content(self):
        self.verified_account()
        self.login()
        invalid = {"title": "x", "result": {"rep_count": 2, "reps": [], "duration_s": 1}}
        self.assertEqual(self.client.put(f"/api/sessions/{uuid4()}", json=invalid).status_code, 422)
        arbitrary = {"title": "x", "result": {"rep_count": 0, "reps": [], "duration_s": 0, "user_id": 999, "owner": "other"}, "unexpected": True}
        self.assertEqual(self.client.put(f"/api/sessions/{uuid4()}", json=arbitrary).status_code, 422)


if __name__ == "__main__":
    unittest.main()
