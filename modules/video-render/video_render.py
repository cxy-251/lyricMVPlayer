from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal


@dataclass(frozen=True)
class RenderTimedLyricLine:
    startMs: int
    endMs: int
    text: str


@dataclass(frozen=True)
class RenderBackgroundAsset:
    kind: Literal["image", "color"]
    src: str | None = None
    color: str | None = None


@dataclass(frozen=True)
class RenderJobInput:
    title: str
    artist: str
    audioSrc: str
    lyricOffsetMs: int
    durationInFrames: int
    fps: int
    background: RenderBackgroundAsset
    lyrics: list[RenderTimedLyricLine]
    songDir: str
    outputMp4Name: str


def _sanitize_name_part(value: str | None, fallback: str) -> str:
    if not value:
        return fallback
    sanitized = re.sub(r"[\\/:*?\"<>|]", "-", value)
    sanitized = re.sub(r"\s+", " ", sanitized).strip()
    return sanitized or fallback


def _normalize_song_title(title: str | None, artist: str | None) -> str:
    normalized_title = _sanitize_name_part(title, "unknown-title")
    normalized_artist = _sanitize_name_part(artist, "unknown-artist")
    prefix = f"{normalized_artist} - "
    if normalized_title.lower().startswith(prefix.lower()):
        normalized_title = normalized_title[len(prefix) :].strip()
    return normalized_title


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _load_preferred_lyrics(song_path: Path) -> tuple[dict, int]:
    aligned_path = song_path / "alignedLRC.json"
    if aligned_path.exists():
        return _load_json(aligned_path), 0

    return _load_json(song_path / "lyrics.json"), 0


def _extract_lyric_lines(lyrics_data: dict) -> list[RenderTimedLyricLine]:
    normalized_lines: list[RenderTimedLyricLine] = []
    for line in lyrics_data.get("lines", []):
        start_ms = line.get("startMs", line.get("start_ms"))
        end_ms = line.get("endMs", line.get("end_ms"))
        text = line.get("text", "")

        if start_ms is None or end_ms is None:
            continue

        normalized_lines.append(
            RenderTimedLyricLine(
                startMs=int(start_ms),
                endMs=int(end_ms),
                text=str(text),
            )
        )

    return normalized_lines


def _discover_background_asset(song_dir: Path) -> RenderBackgroundAsset:
    candidates = []
    for pattern in ["background.png", "background.jpg", "background.jpeg", "background.webp", "background-*.png", "background-*.jpg", "background-*.jpeg", "background-*.webp"]:
        candidates.extend(song_dir.glob(pattern))

    if candidates:
        candidates = sorted(candidates, key=lambda item: item.stat().st_mtime, reverse=True)
        return RenderBackgroundAsset(kind="image", src=str(candidates[0]))

    return RenderBackgroundAsset(kind="color", color="#101828")


def build_output_mp4_name(title: str, artist: str) -> str:
    clean_title = _normalize_song_title(title, artist)
    clean_artist = _sanitize_name_part(artist, "unknown-artist")
    return f"{clean_title} - {clean_artist}.mp4"


def build_render_job_input(song_dir: str, fps: int = 30) -> RenderJobInput:
    song_path = Path(song_dir)
    source_data = _load_json(song_path / "source.json")
    lyrics_data, lyric_offset_ms = _load_preferred_lyrics(song_path)
    audio_path = song_path / "audio.mp3"

    title = source_data.get("title") or song_path.name
    artist = source_data.get("channel") or source_data.get("uploader") or "unknown-artist"
    lyric_lines = _extract_lyric_lines(lyrics_data)

    last_end_ms = max((line.endMs for line in lyric_lines), default=0)
    duration_in_frames = max(int((last_end_ms / 1000.0) * fps) + fps * 2, fps * 4)

    return RenderJobInput(
        title=title,
        artist=artist,
        audioSrc=str(audio_path),
        lyricOffsetMs=lyric_offset_ms,
        durationInFrames=duration_in_frames,
        fps=fps,
        background=_discover_background_asset(song_path),
        lyrics=lyric_lines,
        songDir=str(song_path),
        outputMp4Name=build_output_mp4_name(title, artist),
    )


def save_render_job_input(job: RenderJobInput) -> str:
    song_dir = Path(job.songDir)
    output_path = song_dir / "render-input.json"
    output_path.write_text(json.dumps(asdict(job), ensure_ascii=False, indent=2), encoding="utf-8")
    return str(output_path)


def refresh_render_job_input(song_dir: str, fps: int = 30) -> str:
    job = build_render_job_input(song_dir, fps=fps)
    return save_render_job_input(job)
