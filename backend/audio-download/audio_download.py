import importlib.util
import json
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal


@dataclass(frozen=True)
class AudioDownloadConfig:
    yt_dlp_binary: str
    songs_output_dir: Path
    download_archive_path: Path
    cookies_file_path: Path
    cookies_from_browsers: tuple[str, ...]
    remote_components: tuple[str, ...]


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
        cookies_file_path=root / "artifacts" / "common" / "youtube-cookies.txt",
        cookies_from_browsers=("safari",),
        remote_components=("ejs:github",),
    )


def _get_source_identity(record) -> str:
    return f"{record.source_identity.platform}:{record.source_identity.video_id}"


def _archive_line(record) -> str:
    return f"youtube {record.source_identity.video_id}"


def _ensure_dirs(config: AudioDownloadConfig) -> None:
    config.songs_output_dir.mkdir(parents=True, exist_ok=True)
    config.download_archive_path.parent.mkdir(parents=True, exist_ok=True)
    config.cookies_file_path.parent.mkdir(parents=True, exist_ok=True)


def _sanitize_name_part(value: str | None, fallback: str) -> str:
    if not value:
        return fallback
    sanitized = re.sub(r"[\\/:*?\"<>|,]", "-", value)
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


def _yt_dlp_module(binary_or_module: str) -> str:
    return binary_or_module.replace("-", "_")


def _has_yt_dlp_module(binary_or_module: str) -> bool:
    return importlib.util.find_spec(_yt_dlp_module(binary_or_module)) is not None


def _run_yt_dlp(binary: str, args: list[str]) -> str:
    module_name = _yt_dlp_module(binary)
    try:
        completed = subprocess.run(
            [sys.executable, "-m", module_name, *args],
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


def _with_remote_components(args: list[str], remote_components: tuple[str, ...]) -> list[str]:
    if not remote_components:
        return args
    return ["--remote-components", ",".join(remote_components), *args]


def _should_retry_with_cookies(message: str) -> bool:
    lowered = message.lower()
    return "sign in to confirm you’re not a bot" in lowered or "sign in to confirm you're not a bot" in lowered


def _export_browser_cookies(binary: str, browser_name: str, cookies_file_path: Path) -> None:
    _run_yt_dlp(
        binary,
        _with_remote_components([
            "--cookies-from-browser",
            browser_name,
            "--cookies",
            str(cookies_file_path),
            "--skip-download",
            "--simulate",
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        ], ("ejs:github",)),
    )


def refresh_youtube_cookies_file(config: AudioDownloadConfig) -> tuple[Path | None, str | None, str | None]:
    if not _has_yt_dlp_module(config.yt_dlp_binary):
        return None, f"yt-dlp module not found in current Python environment: {_yt_dlp_module(config.yt_dlp_binary)}", None
    binary_path = config.yt_dlp_binary

    _ensure_dirs(config)
    temp_cookies_path = config.cookies_file_path.with_name(f"{config.cookies_file_path.name}.tmp")
    failures: list[str] = []

    for browser_name in config.cookies_from_browsers:
        try:
            if temp_cookies_path.exists():
                temp_cookies_path.unlink()

            # Export to a temporary file first, then replace the project cookie file
            # only after yt-dlp has proved the cookies work against YouTube.
            _export_browser_cookies(binary_path, browser_name, temp_cookies_path)
            if not temp_cookies_path.exists() or temp_cookies_path.stat().st_size == 0:
                raise RuntimeError("yt-dlp did not write a cookies file.")

            temp_cookies_path.replace(config.cookies_file_path)
            return config.cookies_file_path, None, browser_name
        except Exception as error:
            failures.append(f"[cookies-from-browser {browser_name}]\n{error}")

    if temp_cookies_path.exists():
        temp_cookies_path.unlink()

    return None, "\n\n".join(failures) if failures else "No cookies could be exported.", None


def ensure_youtube_cookies(config: AudioDownloadConfig) -> tuple[Path | None, str | None]:
    if not _has_yt_dlp_module(config.yt_dlp_binary):
        return None, f"yt-dlp module not found in current Python environment: {_yt_dlp_module(config.yt_dlp_binary)}"
    binary_path = config.yt_dlp_binary

    _ensure_dirs(config)
    if config.cookies_file_path.exists() and config.cookies_file_path.stat().st_size > 0:
        return config.cookies_file_path, None

    failures: list[str] = []
    for browser_name in config.cookies_from_browsers:
        try:
            _export_browser_cookies(binary_path, browser_name, config.cookies_file_path)
            if config.cookies_file_path.exists() and config.cookies_file_path.stat().st_size > 0:
                return config.cookies_file_path, None
        except Exception as error:
            failures.append(f"[cookies-from-browser {browser_name}]\n{error}")

    return None, "\n\n".join(failures) if failures else "No cookies could be exported."


def _run_yt_dlp_with_fallback_cookies(
    binary: str,
    args: list[str],
    browsers: tuple[str, ...],
    cookies_file_path: Path,
) -> str:
    try:
        return _run_yt_dlp(binary, args)
    except Exception as error:
        first_message = str(error)
        if not _should_retry_with_cookies(first_message):
            raise

        failures = [first_message]
        if cookies_file_path.exists() and cookies_file_path.stat().st_size > 0:
            try:
                return _run_yt_dlp(
                    binary,
                    _with_remote_components(["--cookies", str(cookies_file_path), *args], ("ejs:github",)),
                )
            except Exception as cookie_file_error:
                failures.append(f"[cookies file {cookies_file_path}]\n{cookie_file_error}")

        for browser_name in browsers:
            try:
                _export_browser_cookies(binary, browser_name, cookies_file_path)
                return _run_yt_dlp(binary, _with_remote_components(["--cookies", str(cookies_file_path), *args], ("ejs:github",)))
            except Exception as cookie_error:
                failures.append(f"[cookies-from-browser {browser_name}]\n{cookie_error}")

        raise RuntimeError("\n\n".join(failures)) from error


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
    if not _has_yt_dlp_module(config.yt_dlp_binary):
        return None, DownloadAudioError(
            reason="missing-yt-dlp",
            message=f"yt-dlp module not found in current Python environment: {_yt_dlp_module(config.yt_dlp_binary)}",
        )
    binary_path = config.yt_dlp_binary

    _ensure_dirs(config)
    source_identity_key = _get_source_identity(record)

    try:
        raw_metadata = _run_yt_dlp(
            binary_path,
            _with_remote_components(
                ["--dump-single-json", "--no-playlist", record.watch_url],
                config.remote_components,
            ),
        )
        metadata = _parse_metadata(raw_metadata)
    except Exception as error:
        try:
            raw_metadata = _run_yt_dlp_with_fallback_cookies(
                binary_path,
                _with_remote_components(
                    ["--dump-single-json", "--no-playlist", record.watch_url],
                    config.remote_components,
                ),
                config.cookies_from_browsers,
                config.cookies_file_path,
            )
            metadata = _parse_metadata(raw_metadata)
        except Exception as fallback_error:
            return None, DownloadAudioError(
                reason="metadata-fetch-failed",
                message=str(fallback_error or error),
            )

    if has_downloaded_audio(record, config.download_archive_path):
        song_dir = build_song_directory(config, metadata)
        metadata_path = song_dir / "source.json"
        audio_candidates = sorted(song_dir.glob("*.mp3")) if song_dir.exists() else []
        audio_path = str(audio_candidates[0]) if audio_candidates else None
        return (
            DownloadedAudioRecord(
                source_identity_key=source_identity_key,
                status="skipped",
                audio_path=audio_path,
                metadata_path=str(metadata_path) if metadata_path.exists() else None,
                metadata=metadata,
            ),
            None,
        )

    try:
        output = _run_yt_dlp(
            binary_path,
            _with_remote_components(
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
                config.remote_components,
            ),
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
        try:
            output = _run_yt_dlp_with_fallback_cookies(
                binary_path,
                _with_remote_components(
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
                    config.remote_components,
                ),
                config.cookies_from_browsers,
                config.cookies_file_path,
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
        except Exception as fallback_error:
            return None, DownloadAudioError(
                reason="audio-download-failed",
                message=str(fallback_error or error),
            )
