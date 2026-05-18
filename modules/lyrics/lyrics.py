from __future__ import annotations

import json
import re
import subprocess
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal
from urllib.parse import urlencode
from urllib.request import urlopen


@dataclass(frozen=True)
class TimedLyricLine:
    text: str
    start_ms: int
    end_ms: int


@dataclass(frozen=True)
class TimedLyricDocument:
    source: Literal["youtube-captions", "youtube-music", "lrclib", "alignment"]
    source_detail: str
    has_word_level_timing: bool
    language: str | None
    lines: list[TimedLyricLine]


@dataclass(frozen=True)
class TimedLyricResolutionError:
    reason: Literal[
        "missing-yt-dlp",
        "subtitle-fetch-failed",
        "no-timed-lyrics-found",
        "provider-error",
        "quality-too-low",
    ]
    message: str


@dataclass(frozen=True)
class TimedLyricResolutionInput:
    watch_url: str
    title: str | None
    artist: str | None
    duration_seconds: int | None = None


def _run_command(args: list[str]) -> str:
    try:
        completed = subprocess.run(
            args,
            check=True,
            capture_output=True,
            text=True,
        )
        return completed.stdout.strip()
    except subprocess.CalledProcessError as error:
        stderr = (error.stderr or "").strip()
        stdout = (error.stdout or "").strip()
        message_parts = [f"command exited with code {error.returncode}"]
        if stderr:
            message_parts.append(stderr)
        if stdout:
            message_parts.append(stdout)
        raise RuntimeError("\n".join(message_parts)) from error


def _parse_timestamp_to_ms(value: str) -> int:
    hours, minutes, seconds = value.split(":")
    whole_seconds, milliseconds = seconds.split(".")
    return (
        int(hours) * 3600 * 1000
        + int(minutes) * 60 * 1000
        + int(whole_seconds) * 1000
        + int(milliseconds)
    )


def _parse_vtt_to_lines(vtt_text: str) -> list[TimedLyricLine]:
    lines: list[TimedLyricLine] = []
    blocks = re.split(r"\n\s*\n", vtt_text.strip(), flags=re.MULTILINE)
    for block in blocks:
        raw_lines = [line.strip() for line in block.splitlines() if line.strip()]
        if not raw_lines:
            continue
        if raw_lines[0].upper() == "WEBVTT":
            continue
        if "-->" not in block:
            continue

        timing_line_index = 0
        if "-->" not in raw_lines[0] and len(raw_lines) > 1:
            timing_line_index = 1

        timing_line = raw_lines[timing_line_index]
        text_lines = raw_lines[timing_line_index + 1 :]
        if not text_lines:
            continue

        start_raw, end_raw = [part.strip().split(" ")[0] for part in timing_line.split("-->")]
        text = " ".join(text_lines)
        text = re.sub(r"<[^>]+>", "", text).strip()
        if not text:
            continue

        lines.append(
            TimedLyricLine(
                text=text,
                start_ms=_parse_timestamp_to_ms(start_raw),
                end_ms=_parse_timestamp_to_ms(end_raw),
            )
        )
    return lines


def _parse_lrc_timestamp_to_ms(value: str) -> int:
    minutes, seconds = value.split(":")
    if "." in seconds:
        whole_seconds, fraction = seconds.split(".")
    else:
        whole_seconds, fraction = seconds, "0"
    padded_fraction = (fraction + "00")[:3]
    return int(minutes) * 60 * 1000 + int(whole_seconds) * 1000 + int(padded_fraction)


def _parse_lrc_to_lines(lrc_text: str) -> list[TimedLyricLine]:
    timestamp_pattern = re.compile(r"\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]")
    parsed: list[tuple[int, str]] = []

    for raw_line in lrc_text.splitlines():
        timestamps = timestamp_pattern.findall(raw_line)
        text = timestamp_pattern.sub("", raw_line).strip()
        if not timestamps or not text:
            continue
        for timestamp in timestamps:
            parsed.append((_parse_lrc_timestamp_to_ms(timestamp), text))

    parsed.sort(key=lambda item: item[0])

    lines: list[TimedLyricLine] = []
    for index, (start_ms, text) in enumerate(parsed):
        next_start = parsed[index + 1][0] if index + 1 < len(parsed) else start_ms + 4000
        lines.append(TimedLyricLine(text=text, start_ms=start_ms, end_ms=max(next_start, start_ms + 500)))
    return lines


def score_timed_lyrics(document: TimedLyricDocument) -> float:
    if not document.lines:
        return 0.0

    line_count_score = min(len(document.lines) / 40.0, 1.0)
    timing_score = 1.0 if all(line.end_ms > line.start_ms for line in document.lines) else 0.0
    text_score = min(
        sum(1 for line in document.lines if line.text.strip()) / max(len(document.lines), 1),
        1.0,
    )
    return round((line_count_score * 0.4) + (timing_score * 0.3) + (text_score * 0.3), 3)


def should_accept_timed_lyrics(document: TimedLyricDocument) -> bool:
    return score_timed_lyrics(document) >= 0.45


def _try_youtube_captions(input_data: TimedLyricResolutionInput) -> TimedLyricDocument | None:
    with tempfile.TemporaryDirectory(prefix="lyricmvplayer-captions-") as temp_dir:
        subtitle_base = Path(temp_dir) / "captions"
        try:
            _run_command(
                [
                    "yt-dlp",
                    "--skip-download",
                    "--write-subs",
                    "--write-auto-subs",
                    "--sub-langs",
                    "en.*,en,-live_chat",
                    "--sub-format",
                    "vtt",
                    "--output",
                    str(subtitle_base),
                    input_data.watch_url,
                ]
            )
        except Exception:
            return None

        candidates = sorted(Path(temp_dir).glob("captions*.vtt"))
        for candidate in candidates:
            vtt_text = candidate.read_text(encoding="utf-8", errors="ignore")
            lines = _parse_vtt_to_lines(vtt_text)
            if not lines:
                continue
            return TimedLyricDocument(
                source="youtube-captions",
                source_detail=candidate.name,
                has_word_level_timing=False,
                language="en",
                lines=lines,
            )
    return None


def _try_lrclib(input_data: TimedLyricResolutionInput) -> TimedLyricDocument | None:
    if not input_data.title or not input_data.artist:
        return None

    query = urlencode(
        {
            "track_name": input_data.title,
            "artist_name": input_data.artist,
        }
    )
    url = f"https://lrclib.net/api/search?{query}"

    try:
        with urlopen(url, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return None

    if not isinstance(payload, list):
        return None

    for item in payload:
        synced_lyrics = item.get("syncedLyrics") or item.get("synced_lyrics")
        if not synced_lyrics:
            continue
        lines = _parse_lrc_to_lines(synced_lyrics)
        if not lines:
            continue
        return TimedLyricDocument(
            source="lrclib",
            source_detail="lrclib search",
            has_word_level_timing=False,
            language=item.get("lang"),
            lines=lines,
        )
    return None


def _normalize_search_title(title: str | None) -> str | None:
    if not title:
        return None
    cleaned = re.sub(r"\([^)]*\)", "", title)
    cleaned = re.sub(r"\[[^\]]*\]", "", cleaned)
    cleaned = re.sub(r"\s*-\s*official.*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return cleaned.strip() or None


def _try_youtube_music(input_data: TimedLyricResolutionInput) -> TimedLyricDocument | None:
    normalized_title = _normalize_search_title(input_data.title)
    if not normalized_title or not input_data.artist:
        return None

    try:
        from ytmusicapi import YTMusic
    except Exception:
        return None

    query = f"{normalized_title} {input_data.artist}"

    try:
        ytm = YTMusic()
        search_results = ytm.search(query, filter="songs", limit=5)
    except Exception:
        return None

    if not search_results:
        return None

    for song in search_results:
        video_id = song.get("videoId")
        if not video_id:
            continue
        try:
            watch_data = ytm.get_watch_playlist(videoId=video_id)
            lyrics_browse_id = watch_data.get("lyrics")
            if not lyrics_browse_id:
                continue
            lyrics_data = ytm.get_lyrics(lyrics_browse_id, timestamps=True)
        except Exception:
            continue

        if not lyrics_data or not lyrics_data.get("hasTimestamps"):
            continue

        parsed_lines: list[TimedLyricLine] = []
        for item in lyrics_data.get("lyrics", []):
            text = getattr(item, "text", None)
            start_time = getattr(item, "start_time", None)
            end_time = getattr(item, "end_time", None)
            if not text or start_time is None or end_time is None:
                continue
            parsed_lines.append(
                TimedLyricLine(
                    text=str(text).strip(),
                    start_ms=int(start_time),
                    end_ms=int(end_time),
                )
            )

        if not parsed_lines:
            continue

        return TimedLyricDocument(
            source="youtube-music",
            source_detail=f"ytmusic search -> {video_id}",
            has_word_level_timing=False,
            language=None,
            lines=parsed_lines,
        )

    return None


def resolve_timed_lyrics(
    input_data: TimedLyricResolutionInput,
) -> tuple[TimedLyricDocument | None, TimedLyricResolutionError | None]:
    attempts = [
        _try_youtube_captions,
        _try_youtube_music,
        _try_lrclib,
    ]

    for attempt in attempts:
        document = attempt(input_data)
        if document is None:
            continue
        if should_accept_timed_lyrics(document):
            return document, None
        return None, TimedLyricResolutionError(
            reason="quality-too-low",
            message=f"Timed lyrics were found from {document.source} but did not pass the quality threshold.",
        )

    return None, TimedLyricResolutionError(
        reason="no-timed-lyrics-found",
        message="No acceptable timed lyric source was found.",
    )


def timed_lyrics_to_json(document: TimedLyricDocument) -> str:
    return json.dumps(asdict(document), ensure_ascii=False, indent=2)
