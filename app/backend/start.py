import os
import time

from alembic import command
from alembic.config import Config
from sqlalchemy.exc import InterfaceError, OperationalError


def migrate():
    if not os.getenv("DATABASE_URL"):
        return

    config = Config("app/backend/alembic.ini")
    for attempt in range(1, 5):
        try:
            command.upgrade(config, "head")
            return
        except (InterfaceError, OperationalError):
            if attempt == 4:
                raise
            delay = 5 * attempt
            print(f"Database connection failed; retrying migration in {delay}s ({attempt}/4)", flush=True)
            time.sleep(delay)


if __name__ == "__main__":
    migrate()
    os.execvp(
        "python",
        [
            "python",
            "-m",
            "uvicorn",
            "app.backend.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            os.getenv("PORT", "8000"),
        ],
    )
