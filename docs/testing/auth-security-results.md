# Authentication and saved session route validation

## Scope and setup

This evidence covers the real FastAPI auth and saved-session routes against PostgreSQL with the repository's Alembic migrations. The suite is `app/backend/tests/test_auth_sessions.py`. It uses the Python 3.12 environment at `training/.venv/bin/python`, a disposable PostgreSQL 16 container bound to loopback, and test-only JWT/email settings established before importing the app. Email delivery is mocked; PostgreSQL is real. No production database, real email provider, phone, or GitHub Actions run was used.

Before running the suite, create a disposable PostgreSQL database whose name includes `test`, bind it only to loopback, and set:

```sh
REPLENS_TEST_DATABASE_URL='postgresql+psycopg://USER:PASSWORD@127.0.0.1:5432/replens_auth_test'
```

The test module rejects non-PostgreSQL URLs, hosts other than `localhost`, `127.0.0.1`, or `::1`, and database names without `test`. It sets `DATABASE_URL`, `JWT_SECRET`, `AUTH_FRONTEND_URL`, `RESEND_API_KEY`, and `EMAIL_FROM` before app import. It migrates to Alembic `head`, truncates only `auth_users`, `auth_email_tokens`, and `saved_sessions` with identity reset before each case, and clears the process-local rate limiter. Do not point this variable at a shared, staging, or production database.

Executed command in the assigned worktree:

```sh
REPLENS_TEST_DATABASE_URL='postgresql+psycopg://replens:localtest@127.0.0.1:55432/replens_auth_test' \
  /Users/zkaynl7/Projects/alu/velocity-tremor-ml/training/.venv/bin/python \
  -m unittest app.backend.tests.test_auth_sessions -v
```

## Cases and observed outcomes

All 7 route tests passed against PostgreSQL 16. They cover:

- Registration with whitespace-only names, malformed email, weak password, normalized email, duplicate registration, unverified login, wrong credentials, verified login, and session cookie attributes.
- Verification token wrong-kind, unknown, expired, and reused behavior; forgot-password generic response for a missing account.
- Mocked email-provider failures on registration and password-reset request. Failed registration rolls back the new account; failed reset-email delivery retains the generic response and rolls back the reset token.
- Tampered and expired JWTs, token-version revocation after logout, password change, and password reset; wrong current password is rejected and the new password works.
- Rejection of an untrusted `Origin`.
- Saved-session JSON/review round trip, normalized title, owner list/read/delete, and a second user's inability to list, read, replace, or delete the first user's UUID. The UUID collision case is covered through cross-owner PUT against an existing ID.
- Rejection of invalid rep data and extra arbitrary request fields.

The seven test methods contain 53 direct assertion call sites; helper calls and the registration validation loop execute additional assertions. There were no reproduced production defects in this scope, so no auth/session production changes were made. A `StarletteDeprecationWarning` about the installed `httpx` test client appeared during runs; it did not affect results and was not resolved here.

## Limits

This suite does not exercise concurrent session writes or a race between an owner check and mutation. It checks the practical UUID collision case with two users sequentially. Cookie assertions use the local HTTP frontend configuration, so `Secure` behavior for an HTTPS deployment is not established here. Email is mocked, and no deliverability or end-to-end link handling claim is made. This is local route evidence only, not evidence of GitHub CI or production behavior.
