"""Install the public pose locator required for video analysis."""

import hashlib
import json
import shutil
from pathlib import Path
from urllib.request import urlretrieve


def setup():
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise RuntimeError(
            "Install FFmpeg (including ffprobe) before setting up the analyzer."
        )
    directory = Path(__file__).resolve().parent
    specification = json.loads((directory / "assets/pose_model.json").read_text())
    path = directory.parents[1] / "training/models" / specification["filename"]
    if (
        path.exists()
        and hashlib.sha256(path.read_bytes()).hexdigest() == specification["sha256"]
    ):
        print("Pose model already installed and verified.")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".download")
    try:
        print("Downloading pose locator…")
        urlretrieve(specification["url"], temporary)
        if (
            hashlib.sha256(temporary.read_bytes()).hexdigest()
            != specification["sha256"]
        ):
            raise RuntimeError("Downloaded pose model failed the integrity check.")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    print("Pose model installed and verified.")


if __name__ == "__main__":
    setup()
