import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException, UploadFile

from app.backend.services.jobs import AnalysisJobManager


class ChunkStream:
    """Synthetic input stream for testing size limits without allocating 250 MB."""

    def __init__(self, chunks):
        self.chunks = iter(chunks)
        self.closed = False

    def read(self, _size=-1):
        return next(self.chunks, b"")

    def close(self):
        self.closed = True


class DiscardWriter:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def write(self, chunk):
        return len(chunk)


def upload(filename="set.mp4", chunks=(b"video",)):
    return UploadFile(filename=filename, file=ChunkStream(chunks))


class AnalysisJobManagerTests(unittest.TestCase):
    def setUp(self):
        self.manager = AnalysisJobManager()

    def tearDown(self):
        self.manager.close()

    def block_worker(self):
        started = threading.Event()
        release = threading.Event()

        def analyze(_path, _progress, _cancelled, model_choice=None):
            started.set()
            release.wait(3)
            return {"model_choice": model_choice}

        return started, release, analyze

    def test_invalid_uploads_are_rejected_and_closed(self):
        oversized = ChunkStream(b"x" * (1024 * 1024) for _ in range(251))
        cases = (
            (upload(chunks=()), 422),
            (upload("set.txt"), 422),
            (UploadFile(filename="set.mp4", file=oversized), 413),
        )
        for item, status in cases:
            with self.subTest(status=status), self.assertRaises(HTTPException) as caught:
                if status == 413:
                    with patch.object(Path, "open", return_value=DiscardWriter()):
                        self.manager.create(item)
                else:
                    self.manager.create(item)
            self.assertEqual(caught.exception.status_code, status)
            self.assertTrue(item.file.closed)
            self.assertEqual(self.manager.inflight, set())
            self.assertEqual(self.manager.jobs, {})

    def test_admission_is_capped_at_three_including_queued_jobs(self):
        started, release, analyze = self.block_worker()
        with patch("app.backend.services.jobs.discard_audio"), patch(
            "app.backend.services.jobs.analyze", side_effect=analyze
        ):
            first = self.manager.create(upload())
            self.assertTrue(started.wait(1))
            second = self.manager.create(upload())
            third = self.manager.create(upload())
            with self.assertRaises(HTTPException) as caught:
                self.manager.create(upload())
            self.assertEqual(caught.exception.status_code, 429)
            self.assertEqual(len(self.manager.inflight), 3)
            release.set()
            self.wait_for_terminal(first["id"])
            self.wait_for_terminal(second["id"])
            self.wait_for_terminal(third["id"])

    def test_cancelled_job_cannot_be_revived_by_late_progress_or_result(self):
        started, release, analyze = self.block_worker()
        with patch("app.backend.services.jobs.discard_audio"), patch(
            "app.backend.services.jobs.analyze", side_effect=analyze
        ):
            created = self.manager.create(upload())
            job_id = created["id"]
            self.assertTrue(started.wait(1))
            self.manager.cancel(job_id)
            release.set()
            self.wait_for_terminal(job_id)
            deadline = time.monotonic() + 3
            while job_id in self.manager.inflight and time.monotonic() < deadline:
                time.sleep(0.01)
        status = self.manager.get(job_id)
        self.assertEqual(status["state"], "cancelled")
        self.assertNotIn("result", status)
        path = Path(self.manager.storage.name) / (job_id + ".mp4")
        self.assertFalse(path.exists())
        self.manager.cancel(job_id)
        self.assertEqual(self.manager.get(job_id)["state"], "cancelled")

    def test_queued_cancel_never_starts_analysis(self):
        started, release, analyze = self.block_worker()
        with patch("app.backend.services.jobs.discard_audio"), patch(
            "app.backend.services.jobs.analyze", side_effect=analyze
        ):
            first = self.manager.create(upload())["id"]
            self.assertTrue(started.wait(1))
            queued = self.manager.create(upload())["id"]
            self.manager.cancel(queued)
            release.set()
            deadline = time.monotonic() + 3
            while (first in self.manager.inflight or queued in self.manager.inflight) and time.monotonic() < deadline:
                time.sleep(0.01)
        self.assertEqual(self.manager.get(queued)["state"], "cancelled")
        self.assertFalse((Path(self.manager.storage.name) / (queued + ".mp4")).exists())

    def test_worker_failure_releases_slot_and_removes_file(self):
        with self.assertLogs("replens", level="ERROR"), patch(
            "app.backend.services.jobs.discard_audio"
        ), patch(
            "app.backend.services.jobs.analyze", side_effect=RuntimeError("boom")
        ):
            job_id = self.manager.create(upload())["id"]
            self.wait_for_terminal(job_id)
        status = self.manager.get(job_id)
        self.assertEqual(status["state"], "failed")
        self.assertNotIn("result", status)
        self.assertNotIn(job_id, self.manager.inflight)
        self.assertFalse((Path(self.manager.storage.name) / (job_id + ".mp4")).exists())

    def test_jobs_are_processed_serially(self):
        started, release, analyze = self.block_worker()
        with patch("app.backend.services.jobs.discard_audio"), patch(
            "app.backend.services.jobs.analyze", side_effect=analyze
        ):
            first = self.manager.create(upload())["id"]
            self.assertTrue(started.wait(1))
            second = self.manager.create(upload())["id"]
            self.assertEqual(self.manager.get(second)["state"], "queued")
            release.set()
            self.wait_for_terminal(first)
            self.wait_for_terminal(second)
        self.assertEqual(self.manager.get(first)["state"], "completed")
        self.assertEqual(self.manager.get(second)["state"], "completed")

    def test_missing_job_and_repeated_shutdown_are_stable(self):
        with self.assertRaises(HTTPException) as caught:
            self.manager.get("missing")
        self.assertEqual(caught.exception.status_code, 404)
        with self.assertRaises(HTTPException) as caught:
            self.manager.cancel("missing")
        self.assertEqual(caught.exception.status_code, 404)
        self.manager.close()
        self.manager.close()

    def test_shutdown_cancels_active_job_and_waits_for_cleanup(self):
        started, release, analyze = self.block_worker()
        with patch("app.backend.services.jobs.discard_audio"), patch(
            "app.backend.services.jobs.analyze", side_effect=analyze
        ):
            job_id = self.manager.create(upload())["id"]
            self.assertTrue(started.wait(1))
            closer = threading.Thread(target=self.manager.close)
            closer.start()
            deadline = time.monotonic() + 3
            while self.manager.get(job_id)["state"] != "cancelled" and time.monotonic() < deadline:
                time.sleep(0.01)
            release.set()
            closer.join(3)
        self.assertFalse(closer.is_alive())
        self.assertEqual(self.manager.get(job_id)["state"], "cancelled")
        self.assertNotIn(job_id, self.manager.inflight)
        self.assertFalse((Path(self.manager.storage.name) / (job_id + ".mp4")).exists())

    def wait_for_terminal(self, job_id, timeout=3):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            state = self.manager.get(job_id)["state"]
            if state in {"completed", "failed", "cancelled"}:
                return
            time.sleep(0.01)
        self.fail(f"job {job_id} did not reach a terminal state")


if __name__ == "__main__":
    unittest.main()
