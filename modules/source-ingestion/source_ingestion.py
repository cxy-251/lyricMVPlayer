from dataclasses import dataclass
from typing import Literal
from urllib.parse import parse_qs, urlparse


SupportedSourcePlatform = Literal["youtube"]
SupportedSourceKind = Literal["single-video"]


@dataclass(frozen=True)
class SourceIdentity:
    platform: SupportedSourcePlatform
    video_id: str


@dataclass(frozen=True)
class NormalizedSourceRecord:
    platform: SupportedSourcePlatform
    kind: SupportedSourceKind
    source_identity: SourceIdentity
    raw_input: str
    canonical_url: str
    watch_url: str
    music_url: str


@dataclass(frozen=True)
class NormalizeSourceInputError:
    reason: Literal[
        "empty-input",
        "invalid-url",
        "unsupported-host",
        "missing-video-id",
        "unsupported-input",
    ]
    message: str


YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
}


def _extract_youtube_video_id(parsed_url) -> str | None:
    hostname = parsed_url.netloc.lower()
    path = parsed_url.path

    if hostname in {"youtu.be", "www.youtu.be"}:
        short_id = path.lstrip("/").split("/")[0]
        return short_id or None

    if path == "/watch":
        return parse_qs(parsed_url.query).get("v", [None])[0]

    if path.startswith("/shorts/") or path.startswith("/embed/"):
        parts = path.split("/")
        return parts[2] if len(parts) > 2 and parts[2] else None

    return None


def normalize_source_input(input_value: str) -> tuple[NormalizedSourceRecord | None, NormalizeSourceInputError | None]:
    trimmed = input_value.strip()

    if not trimmed:
        return None, NormalizeSourceInputError(
            reason="empty-input",
            message="Source input cannot be empty.",
        )

    parsed = urlparse(trimmed)
    if not parsed.scheme or not parsed.netloc:
        return None, NormalizeSourceInputError(
            reason="invalid-url",
            message="Source input must be a valid URL.",
        )

    if parsed.scheme not in {"http", "https"}:
        return None, NormalizeSourceInputError(
            reason="unsupported-input",
            message="Only http and https source URLs are supported.",
        )

    hostname = parsed.netloc.lower()
    if hostname not in YOUTUBE_HOSTS:
        return None, NormalizeSourceInputError(
            reason="unsupported-host",
            message=f"Unsupported source host: {hostname}",
        )

    video_id = _extract_youtube_video_id(parsed)
    if not video_id:
        return None, NormalizeSourceInputError(
            reason="missing-video-id",
            message="Could not extract a YouTube video ID from the input URL.",
        )

    return (
        NormalizedSourceRecord(
            platform="youtube",
            kind="single-video",
            source_identity=SourceIdentity(platform="youtube", video_id=video_id),
            raw_input=trimmed,
            canonical_url=f"https://www.youtube.com/watch?v={video_id}",
            watch_url=f"https://www.youtube.com/watch?v={video_id}",
            music_url=f"https://music.youtube.com/watch?v={video_id}",
        ),
        None,
    )


def get_source_identity(record: NormalizedSourceRecord) -> str:
    return f"{record.source_identity.platform}:{record.source_identity.video_id}"
