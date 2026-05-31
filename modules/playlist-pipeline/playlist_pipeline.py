from __future__ import annotations

import importlib.util
import json
import re
import shutil
import subprocess
import sys
from dataclasses import asdict, is_dataclass
from pathlib import Path


def _load_module(module_name: str, file_path: Path):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module from {file_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def _serialize(value):
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, dict):
        return {key: _serialize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialize(item) for item in value]
    return value


def _recover_failed_existing_download(song_dir: str | None) -> dict | None:
    if not song_dir:
        return None

    pipeline_path = Path(song_dir) / "pipeline.json"
    if not pipeline_path.exists():
        return None

    try:
        previous_result = json.loads(pipeline_path.read_text(encoding="utf-8"))
    except Exception:
        return None

    if previous_result.get("stage") != "lyrics":
        return None
    if previous_result.get("audio", {}).get("status") != "downloaded":
        return None

    recovered = dict(previous_result)
    recovered["recovered_existing_failed_download"] = True
    recovered["result_path"] = str(pipeline_path)
    return recovered


def _extract_video_id_from_text(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None

    matches = re.findall(r"(?:v=|youtu\.be/|->\s*)([A-Za-z0-9_-]{8,})", value)
    return matches[-1] if matches else None


def _get_source_video_id(pipeline_result: dict) -> str | None:
    source_identity = pipeline_result.get("source", {}).get("record", {}).get("source_identity", {})
    video_id = source_identity.get("video_id")
    return str(video_id) if video_id else None


def _has_lyrics_source_mismatch(pipeline_result: dict) -> bool:
    document = pipeline_result.get("timed_lyrics", {}).get("document", {})
    if document.get("source") != "youtube-music":
        return False

    source_video_id = _get_source_video_id(pipeline_result)
    lyric_video_id = _extract_video_id_from_text(document.get("source_detail"))
    return bool(source_video_id and lyric_video_id and source_video_id != lyric_video_id)


def _classify_render_batch(pipeline_result: dict, default_render_batch: str) -> str:
    if pipeline_result.get("stage") == "lyrics" and not pipeline_result.get("ok"):
        return "2"
    if _has_lyrics_source_mismatch(pipeline_result):
        return "3"
    return default_render_batch


def _run_yt_dlp(binary: str, args: list[str]) -> str:
    completed = subprocess.run(
        [binary, *args],
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout.strip()


def _extract_playlist_entries(playlist_url: str) -> list[dict]:
    yt_dlp_binary = shutil.which("yt-dlp")
    if not yt_dlp_binary:
        raise RuntimeError("yt-dlp is not available in PATH")

    payload = _run_yt_dlp(
        yt_dlp_binary,
        ["--flat-playlist", "--dump-single-json", "--no-warnings", playlist_url],
    )
    data = json.loads(payload)
    entries = data.get("entries") or []
    normalized: list[dict] = []
    for entry in entries:
        video_id = entry.get("id")
        if not video_id:
            continue
        normalized.append(
            {
                "video_id": str(video_id),
                "title": entry.get("title") or "",
                "watch_url": f"https://www.youtube.com/watch?v={video_id}",
            }
        )
    return normalized


def run_playlist_pipeline(playlist_url: str, project_root: str, default_render_batch: str = "0") -> dict:
    root = Path(project_root)
    modules_root = root / "modules"

    single_song_pipeline = _load_module(
        "single_song_pipeline_playlist_module",
        modules_root / "single-song-pipeline" / "single_song_pipeline.py",
    )
    audio_features = _load_module(
        "audio_features_playlist_module",
        modules_root / "audio-features" / "extract_audio_features.py",
    )
    render_queue = _load_module(
        "render_queue_playlist_module",
        modules_root / "render-queue" / "render_queue.py",
    )

    playlist_entries = _extract_playlist_entries(playlist_url)
    queue_csv_path = render_queue.ensure_render_queue_csv(project_root)
    results: list[dict] = []

    for entry in playlist_entries:
        pipeline_result = single_song_pipeline.run_single_song_pipeline(entry["watch_url"], project_root)
        song_dir = pipeline_result.get("song_dir")
        audio_status = pipeline_result.get("audio", {}).get("status")

        if pipeline_result.get("stage") == "skipped-existing" and audio_status == "skipped":
            recovered_result = _recover_failed_existing_download(song_dir)
            if recovered_result:
                pipeline_result = recovered_result
                song_dir = pipeline_result.get("song_dir")
                audio_status = pipeline_result.get("audio", {}).get("status")

        if song_dir and audio_status == "downloaded":
            row_render_batch = _classify_render_batch(pipeline_result, default_render_batch)
            audio_features_path = audio_features.extract_audio_features_for_song(song_dir, frame_rate=60)
            render_queue.upsert_render_queue_row(
                project_root,
                render_queue.RenderQueueRow(
                    video_status="pending",
                    render_batch=row_render_batch,
                    background_ready="false",
                    source_url=entry["watch_url"],
                    song_dir=Path(song_dir).name,
                ),
            )
            pipeline_result["audio_features"] = {"path": audio_features_path}

        results.append(_serialize(pipeline_result))

    output = {
        "ok": True,
        "playlist_url": playlist_url,
        "entry_count": len(playlist_entries),
        "production_queue_csv": str(queue_csv_path),
        "results": results,
    }

    output_path = root / "artifacts" / "common" / "playlist-pipeline.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    output["result_path"] = str(output_path)
    return output


def _main(argv: list[str]) -> int:
    if len(argv) < 3:
        raise SystemExit("Usage: playlist_pipeline.py <playlist_url> <project_root> [default_render_batch]")

    playlist_url = argv[1]
    project_root = argv[2]
    default_render_batch = argv[3] if len(argv) > 3 else ""
    result = run_playlist_pipeline(playlist_url, project_root, default_render_batch=default_render_batch)
    print(json.dumps(_serialize(result), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv))
