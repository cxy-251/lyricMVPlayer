from __future__ import annotations

import json
import math
import re
import struct
import subprocess
import wave
from dataclasses import asdict, dataclass
from statistics import median
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
class RenderPoetryFrame:
    nickname: str
    topLabel: str
    leftVertical: str
    rightVertical: str
    bottomLine: str


@dataclass(frozen=True)
class RenderJobInput:
    title: str
    artist: str
    audioSrc: str
    lyricOffsetMs: int
    renderTrimStartMs: int
    renderDurationInFrames: int
    durationInFrames: int
    fps: int
    background: RenderBackgroundAsset
    poetryFrame: RenderPoetryFrame
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


def _probe_audio_duration_ms(audio_path: Path) -> int:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=nk=1:nw=1",
                str(audio_path),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return 0

    try:
        return int(float(result.stdout.strip()) * 1000)
    except ValueError:
        return 0


def _extract_line_count_and_end_ms(lyrics_data: dict) -> tuple[int, int]:
    count = 0
    last_end_ms = 0
    for line in lyrics_data.get("lines", []):
        start_ms = line.get("startMs", line.get("start_ms"))
        end_ms = line.get("endMs", line.get("end_ms"))
        text = str(line.get("text", "")).strip()
        if start_ms is None or end_ms is None or not text:
            continue
        count += 1
        last_end_ms = max(last_end_ms, int(end_ms))
    return count, last_end_ms


def _aligned_deviation_too_large(raw_lyrics: dict, aligned_lyrics: dict) -> bool:
    raw_lines = [
        line for line in raw_lyrics.get("lines", [])
        if str(line.get("text", "")).strip() and str(line.get("text", "")).strip() != "♪"
    ]
    aligned_lines = [
        line for line in aligned_lyrics.get("lines", [])
        if str(line.get("text", "")).strip() and str(line.get("text", "")).strip() != "♪"
    ]

    comparable_deltas: list[int] = []
    for raw_line, aligned_line in zip(raw_lines, aligned_lines):
        raw_text = re.sub(r"\s+", " ", str(raw_line.get("text", "")).strip().lower())
        aligned_text = re.sub(r"\s+", " ", str(aligned_line.get("text", "")).strip().lower())
        if raw_text != aligned_text:
            continue
        raw_start = raw_line.get("start_ms", raw_line.get("startMs"))
        aligned_start = aligned_line.get("start_ms", aligned_line.get("startMs"))
        if raw_start is None or aligned_start is None:
            continue
        comparable_deltas.append(abs(int(aligned_start) - int(raw_start)))

    if len(comparable_deltas) < 8:
        return False

    return median(comparable_deltas) > 12000


def _load_preferred_lyrics(song_path: Path) -> tuple[dict, int]:
    raw_lyrics = _load_json(song_path / "lyrics.json")
    raw_count, raw_end_ms = _extract_line_count_and_end_ms(raw_lyrics)

    aligned_path = song_path / "alignedLRC.json"
    if not aligned_path.exists():
        return raw_lyrics, 0

    aligned_lyrics = _load_json(aligned_path)
    aligned_count, aligned_end_ms = _extract_line_count_and_end_ms(aligned_lyrics)

    aligned_is_suspicious = (
        aligned_count == 0
        or (raw_count >= 8 and aligned_count < max(3, raw_count // 3))
        or (raw_end_ms >= 60_000 and aligned_end_ms < raw_end_ms * 0.5)
        or _aligned_deviation_too_large(raw_lyrics, aligned_lyrics)
    )

    if aligned_is_suspicious:
        return raw_lyrics, 0

    return aligned_lyrics, 0


def _estimate_vocal_start_ms_from_wav(vocals_path: Path) -> int:
    if not vocals_path.exists():
        return 0

    try:
        with wave.open(str(vocals_path), "rb") as wav_file:
            channels = wav_file.getnchannels()
            sample_width = wav_file.getsampwidth()
            frame_rate = wav_file.getframerate()
            frame_count = wav_file.getnframes()
            raw = wav_file.readframes(frame_count)
    except Exception:
        return 0

    if sample_width not in (1, 2, 4):
        return 0

    fmt = {1: "b", 2: "h", 4: "i"}[sample_width]
    try:
        values = struct.unpack("<" + fmt * (len(raw) // sample_width), raw)
    except Exception:
        return 0

    if channels > 1:
        mono = [
            sum(values[index : index + channels]) / channels
            for index in range(0, len(values), channels)
        ]
    else:
        mono = values

    max_value = float(2 ** (8 * sample_width - 1))
    window_samples = max(1, int(frame_rate * 0.02))
    smoothed_values: list[float] = []
    smoothed_rms = 0.0

    for start in range(0, len(mono), window_samples):
        chunk = mono[start : start + window_samples]
        if not chunk:
            break
        rms = math.sqrt(sum((sample / max_value) ** 2 for sample in chunk) / len(chunk))
        smoothed_rms = smoothed_rms * 0.85 + rms * 0.15
        smoothed_values.append(smoothed_rms)

    if not smoothed_values:
        return 0

    sorted_values = sorted(smoothed_values)
    noise_floor = sorted_values[int((len(sorted_values) - 1) * 0.2)]
    high_band = sorted_values[int((len(sorted_values) - 1) * 0.9)]
    threshold = max(0.018, noise_floor + (high_band - noise_floor) * 0.22)
    min_windows = max(1, math.ceil(0.24 / 0.02))

    active_count = 0
    for index, value in enumerate(smoothed_values):
        if value >= threshold:
            active_count += 1
            if active_count >= min_windows:
                return int((index - active_count + 1) * 20)
        else:
            active_count = 0

    return 0


def _estimate_manual_lyric_offset_ms(song_path: Path, lyrics_data: dict) -> int:
    if str(lyrics_data.get("source", "")) != "manual-lyrics-alignment":
        return 0

    lyric_lines = _extract_lyric_lines(lyrics_data)
    if not lyric_lines:
        return 0

    detected_vocal_start_ms = _estimate_vocal_start_ms_from_wav(song_path / "separated" / "vocals.wav")
    if detected_vocal_start_ms <= 0:
        return 0

    offset_ms = lyric_lines[0].startMs - detected_vocal_start_ms
    if abs(offset_ms) > 15_000:
        return 0
    return offset_ms


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


def _find_first_vocal_start_ms(lyric_lines: list[RenderTimedLyricLine]) -> int:
    for line in lyric_lines:
        text = line.text.strip()
        if not text or text == "♪":
            continue
        return line.startMs
    return 0


def _discover_background_asset(song_dir: Path) -> RenderBackgroundAsset:
    candidates = []
    for pattern in ["background.png", "background.jpg", "background.jpeg", "background.webp", "background-*.png", "background-*.jpg", "background-*.jpeg", "background-*.webp"]:
        candidates.extend(song_dir.glob(pattern))

    if candidates:
        candidates = sorted(candidates, key=lambda item: item.stat().st_mtime, reverse=True)
        return RenderBackgroundAsset(kind="image", src=str(candidates[0]))

    return RenderBackgroundAsset(kind="color", color="#101828")


def _load_poetry_frame(song_dir: Path) -> RenderPoetryFrame:
    poetry_path = song_dir / "poetry-frame.json"
    if poetry_path.exists():
        poetry_data = _load_json(poetry_path)
        return RenderPoetryFrame(
            nickname=str(poetry_data.get("nickname") or "@xcai43323"),
            topLabel=str(poetry_data.get("top_label") or "@xcai43323 · AUDIO DIARY"),
            leftVertical=str(poetry_data.get("left_vertical") or ""),
            rightVertical=str(poetry_data.get("right_vertical") or ""),
            bottomLine=str(poetry_data.get("bottom_line") or ""),
        )

    return RenderPoetryFrame(
        nickname="@xcai43323",
        topLabel="@xcai43323 · AUDIO DIARY",
        leftVertical="THE RAIN WRITES SOFTLY ON THE GLASS WHILE THE MUSIC REMEMBERS",
        rightVertical="STREETLIGHTS RETURN AS QUIET STARS BENEATH THE MIDNIGHT SKY",
        bottomLine="LET THE NIGHT HUM SOFTLY",
    )


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
    lyric_offset_ms = lyric_offset_ms or _estimate_manual_lyric_offset_ms(song_path, lyrics_data)
    audio_duration_ms = _probe_audio_duration_ms(audio_path)

    last_end_ms = max((line.endMs for line in lyric_lines), default=0)
    if audio_duration_ms > 0:
        effective_end_ms = min(max(last_end_ms, 0), audio_duration_ms)
        preview_duration_ms = max(audio_duration_ms, fps * 1000)
    else:
        effective_end_ms = max(last_end_ms, 0)
        preview_duration_ms = max(effective_end_ms + 2000, fps * 4000)

    first_vocal_start_ms = _find_first_vocal_start_ms(lyric_lines)
    render_trim_start_ms = max(0, first_vocal_start_ms - 3000)
    render_tail_end_ms = min(
        audio_duration_ms if audio_duration_ms > 0 else effective_end_ms + 2000,
        max(effective_end_ms + 2000, first_vocal_start_ms + 4000),
    )
    render_duration_ms = max(render_tail_end_ms - render_trim_start_ms, fps * 4000)

    duration_in_frames = max(int((preview_duration_ms / 1000.0) * fps), fps * 4)
    render_duration_in_frames = max(int((render_duration_ms / 1000.0) * fps), fps * 4)

    return RenderJobInput(
        title=title,
        artist=artist,
        audioSrc=str(audio_path),
        lyricOffsetMs=lyric_offset_ms,
        renderTrimStartMs=render_trim_start_ms,
        renderDurationInFrames=render_duration_in_frames,
        durationInFrames=duration_in_frames,
        fps=fps,
        background=_discover_background_asset(song_path),
        poetryFrame=_load_poetry_frame(song_path),
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
