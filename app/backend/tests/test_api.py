import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient

from app.backend.main import app
from app.backend.auth.database import get_engine


class DatabaseEngineConcurrencyTests(unittest.TestCase):
    def test_concurrent_first_requests_create_only_one_engine(self):
        get_engine.cache_clear()
        engine = Mock()

        def create_engine_slowly(*_args, **_kwargs):
            time.sleep(0.03)
            return engine

        try:
            with patch(
                "app.backend.auth.database.get_settings",
                return_value=SimpleNamespace(database_url="postgresql://local/test"),
            ), patch(
                "app.backend.auth.database.create_engine",
                side_effect=create_engine_slowly,
            ) as create:
                with ThreadPoolExecutor(max_workers=40) as workers:
                    engines = list(workers.map(lambda _index: get_engine(), range(100)))
                self.assertTrue(all(candidate is engine for candidate in engines))
                create.assert_called_once()
        finally:
            get_engine.cache_clear()


class AnalysisApiTests(unittest.TestCase):
    def test_rejects_empty_upload(self):
        with TestClient(app) as client:
            response = client.post(
                "/api/analyses", files={"video": ("empty.mp4", b"", "video/mp4")}
            )
        self.assertEqual(response.status_code, 422)
        self.assertIn("empty", response.text.lower())

    def test_rejects_unsupported_extension(self):
        with TestClient(app) as client:
            response = client.post(
                "/api/analyses", files={"video": ("set.txt", b"video", "text/plain")}
            )
        self.assertEqual(response.status_code, 422)
        self.assertIn("MP4", response.text)

    def test_corrupt_video_fails_without_result(self):
        with self.assertLogs("replens", level="ERROR"):
            with TestClient(app) as client:
                response = client.post(
                    "/api/analyses", files={"video": ("bad.mp4", b"not video", "video/mp4")}
                )
                self.assertEqual(response.status_code, 202)
                job_id = response.json()["id"]
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline:
                    job = client.get(f"/api/analyses/{job_id}").json()
                    if job["state"] == "failed":
                        break
                    time.sleep(0.05)

        self.assertEqual(job["state"], "failed")
        self.assertNotIn("result", job)


if __name__ == "__main__":
    unittest.main()
