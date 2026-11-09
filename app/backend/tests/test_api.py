import time
import unittest

from fastapi.testclient import TestClient

from app.backend.main import app


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
