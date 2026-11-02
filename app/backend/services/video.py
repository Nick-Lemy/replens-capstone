from pathlib import Path
import json
import shutil
import subprocess


def discard_audio(path: Path) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise ValueError("FFmpeg is required to prepare this video.")
    probe = subprocess.run(
        [
            shutil.which("ffprobe") or "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a",
            "-show_entries",
            "stream=index",
            "-of",
            "json",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    if not json.loads(probe.stdout).get("streams"):
        return
    silent = path.with_name(path.stem + ".silent" + path.suffix)
    try:
        subprocess.run(
            [
                ffmpeg,
                "-nostdin",
                "-v",
                "error",
                "-copyts",
                "-i",
                str(path),
                "-map",
                "0:v:0",
                "-c:v",
                "copy",
                "-an",
                "-map_metadata",
                "0",
                "-avoid_negative_ts",
                "disabled",
                str(silent),
            ],
            check=True,
            capture_output=True,
            timeout=120,
        )
        silent.replace(path)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        raise ValueError(
            "The video could not be prepared. Try a standard MP4 export."
        ) from exc
    finally:
        silent.unlink(missing_ok=True)
