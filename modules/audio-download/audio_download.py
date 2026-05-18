import json
import re
import shutil
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal


@dataclass(frozen=True)
class AudioDownloadConfig:
    yt_dlp_binary: str
    songs_output_dir: Path
    download_archive_path: Path


@dataclass(frozen=True)
class DownloadedAudioMetadata:
    video_id: str
    title: str | None = None
    channel: str | None = None
    uploader: str | None = None
    duration: int | None = None
    webpage_url: str | None = None
    original_url: str | None = None


@dataclass(frozen=True)
class DownloadedAudioRecord:
    source_identity_key: str
    status: Literal["downloaded", "skipped"]
    audio_path: str | None
    metadata_path: str | None
    metadata: DownloadedAudioMetadata


@dataclass(frozen=True)
class DownloadAudioError:
    reason: Literal["missing-yt-dlp", "metadata-fetch-failed", "audio-download-failed"]
    message: str


def get_default_audio_download_config(project_root: str) -> AudioDownloadConfig:
    root = Path(project_root)
    return AudioDownloadConfig(
        yt_dlp_binary="yt-dlp",
        songs_output_dir=root / "artifacts" / "songs",
        download_archive_path=root / "artifacts" / "common" / "yt-dlp-archive.txt",
    )


def _get_source_identity(record) -> str:
    return f"{record.source_identity.platform}:{record.source_identity.video_id}"


def _archive_line(record) -> str:
    return f"youtube {record.source_identity.video_id}"


def _ensure_dirs(config: AudioDownloadConfig) -> None:
    config.songs_output_dir.mkdir(parents=True, exist_ok=True)
    config.download_archive_path.parent.mkdir(parents=True, exist_ok=True)


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


def build_song_base_name(metadata: DownloadedAudioMetadata) -> str:
    artist = _sanitize_name_part(metadata.channel or metadata.uploader, "unknown-artist")
    title = _normalize_song_title(metadata.title, artist)
    video_id = _sanitize_name_part(metadata.video_id, "unknown-id")
    return f"{title} - {artist} - {video_id}"


def build_song_directory(config: AudioDownloadConfig, metadata: DownloadedAudioMetadata) -> Path:
    return config.songs_output_dir / build_song_base_name(metadata)


def has_downloaded_audio(record, archive_path: Path) -> bool:
    if not archive_path.exists():
        return False
    lines = archive_path.read_text(encoding="utf-8").splitlines()
    return _archive_line(record) in lines


def _run_yt_dlp(binary: str, args: list[str]) -> str:
    try:
        completed = subprocess.run(
            [binary, *args],
            check=True,
            capture_output=True,
            text=True,
        )
        return completed.stdout.strip()
    except subprocess.CalledProcessError as error:
        stderr = (error.stderr or "").strip()
        stdout = (error.stdout or "").strip()
        message_parts = [f"yt-dlp exited with code {error.returncode}"]
        if stderr:
            message_parts.append(stderr)
        if stdout:
            message_parts.append(stdout)
        raise RuntimeError("\n".join(message_parts)) from error


def _parse_metadata(raw_json: str) -> DownloadedAudioMetadata:
    data = json.loads(raw_json)
    return DownloadedAudioMetadata(
        video_id=str(data.get("id", "")),
        title=data.get("title"),
        channel=data.get("channel"),
        uploader=data.get("uploader"),
        duration=data.get("duration"),
        webpage_url=data.get("webpage_url"),
        original_url=data.get("original_url"),
    )


def record_downloaded_audio(config: AudioDownloadConfig, metadata: DownloadedAudioMetadata) -> Path:
    song_dir = build_song_directory(config, metadata)
    song_dir.mkdir(parents=True, exist_ok=True)
    metadata_path = song_dir / "source.json"
    metadata_path.write_text(
        json.dumps(asdict(metadata), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return metadata_path


def download_audio(record, config: AudioDownloadConfig) -> tuple[DownloadedAudioRecord | None, DownloadAudioError | None]:
    binary_path = shutil.which(config.yt_dlp_binary)
    if not binary_path:
        return None, DownloadAudioError(
            reason="missing-yt-dlp",
            message=f"yt-dlp binary not found: {config.yt_dlp_binary}",
        )

    _ensure_dirs(config)
    source_identity_key = _get_source_identity(record)

    try:
        raw_metadata = _run_yt_dlp(
            binary_path,
            ["--dump-single-json", "--no-playlist", record.watch_url],
        )
        metadata = _parse_metadata(raw_metadata)
    except Exception as error:
        return None, DownloadAudioError(
            reason="metadata-fetch-failed",
            message=str(error),
        )

    if has_downloaded_audio(record, config.download_archive_path):
        metadata_path = record_downloaded_audio(config, metadata)
        song_dir = build_song_directory(config, metadata)
        audio_candidates = sorted(song_dir.glob("*.mp3"))
        audio_path = str(audio_candidates[0]) if audio_candidates else None
        return (
            DownloadedAudioRecord(
                source_identity_key=source_identity_key,
                status="skipped",
                audio_path=audio_path,
                metadata_path=str(metadata_path),
                metadata=metadata,
            ),
            None,
        )

    try:
        output = _run_yt_dlp(
            binary_path,
            [
                "--no-playlist",
                "--extract-audio",
                "--audio-format",
                "mp3",
                "--audio-quality",
                "0",
                "--download-archive",
                str(config.download_archive_path),
                "--output",
                str(build_song_directory(config, metadata) / "audio.%(ext)s"),
                "--print",
                "after_move:filepath",
                record.watch_url,
            ],
        )
        audio_path = [line.strip() for line in output.splitlines() if line.strip()][-1]
        metadata_path = record_downloaded_audio(config, metadata)
        return (
            DownloadedAudioRecord(
                source_identity_key=source_identity_key,
                status="downloaded",
                audio_path=audio_path,
                metadata_path=str(metadata_path),
                metadata=metadata,
            ),
            None,
        )
    except Exception as error:
        return None, DownloadAudioError(
            reason="audio-download-failed",
            message=str(error),
        )
