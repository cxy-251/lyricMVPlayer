from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
from dataclasses import asdict, is_dataclass
from pathlib import Path
from datetime import datetime


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
    return str(video_id) if video_id else pipeline_result.get("source", {}).get("source_identity", {}).get("video_id")


def _get_source_url(pipeline_result: dict) -> str | None:
    record = pipeline_result.get("source", {}).get("record", {})
    return record.get("watch_url") or record.get("canonical_url") or pipeline_result.get("source_url")


def _has_lyrics_source_mismatch(pipeline_result: dict) -> bool:
    document = pipeline_result.get("timed_lyrics", {}).get("document", {})
    if document.get("source") != "youtube-music":
        return False

    source_video_id = _get_source_video_id(pipeline_result)
    lyric_video_id = _extract_video_id_from_text(document.get("source_detail"))
    return bool(source_video_id and lyric_video_id and source_video_id != lyric_video_id)


def _get_lyrics_review(entry: dict) -> dict | None:
    song_dir = Path(entry["song_dir"]).name if entry.get("song_dir") else None
    if not song_dir:
        return None

    if not entry.get("ok") and entry.get("stage") == "lyrics":
        return {
            "song_dir": song_dir,
            "reason": "lyrics_resolution_failed",
            "detail": entry.get("error", {}).get("message")
        }

    document = entry.get("timed_lyrics", {}).get("document")
    lines = document.get("lines") if document else []
    if not document or not lines:
        return {
            "song_dir": song_dir,
            "reason": "lyrics_missing",
            "detail": None
        }

    source_video_id = _get_source_video_id(entry)
    lyric_video_id = _extract_video_id_from_text(document.get("source_detail"))
    if document.get("source") == "youtube-music" and source_video_id and lyric_video_id and source_video_id != lyric_video_id:
        return {
            "song_dir": song_dir,
            "reason": "lyrics_source_video_mismatch",
            "expected_video_id": source_video_id,
            "lyric_video_id": lyric_video_id,
            "detail": document.get("source_detail")
        }
    return None


def _classify_render_batch(pipeline_result: dict, default_render_batch: str) -> str:
    if pipeline_result.get("stage") == "lyrics" and not pipeline_result.get("ok"):
        return "2"
    if _has_lyrics_source_mismatch(pipeline_result):
        return "3"
    return default_render_batch


def _ensure_yt_dlp_module() -> None:
    if importlib.util.find_spec("yt_dlp") is None:
        raise RuntimeError("yt-dlp module is not installed in the current Python environment")


def _run_yt_dlp(args: list[str]) -> str:
    _ensure_yt_dlp_module()
    completed = subprocess.run(
        [sys.executable, "-m", "yt_dlp", *args],
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout.strip()


def _extract_playlist_entries(playlist_url: str) -> list[dict]:
    payload = _run_yt_dlp(
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


def ensure_playlist(playlists: list[dict], playlist_id: str, playlist_name: str, track_ids_to_add: list[str], replace: bool = False) -> list[dict]:
    playlist_index = next((i for i, p in enumerate(playlists) if p.get("id") == playlist_id), -1)
    existing_track_ids = playlists[playlist_index].get("trackIds", []) if playlist_index >= 0 else []
    
    track_ids_to_add = [t for t in track_ids_to_add if t]
    
    if replace:
        next_track_ids = list(dict.fromkeys(track_ids_to_add))
    else:
        next_track_ids = list(dict.fromkeys(existing_track_ids + track_ids_to_add))

    if playlist_index >= 0:
        playlists[playlist_index] = {
            **playlists[playlist_index],
            "name": playlist_name,
            "trackIds": next_track_ids
        }
        return playlists
    
    playlists.append({
        "id": playlist_id,
        "name": playlist_name,
        "trackIds": next_track_ids
    })
    return playlists


def run_playlist_pipeline(playlist_url: str, project_root: str, default_render_batch: str = "0") -> dict:
    root = Path(project_root)
    backend_root = root / "backend"

    single_song_pipeline = _load_module(
        "single_song_pipeline_playlist_module",
        backend_root / "single-song-pipeline" / "single_song_pipeline.py",
    )
    audio_features = _load_module(
        "audio_features_playlist_module",
        backend_root / "audio-features" / "extract_audio_features.py",
    )
    render_queue = _load_module(
        "render_queue_playlist_module",
        backend_root / "render-queue" / "render_queue.py",
    )
    background_generation = _load_module(
        "background_generation_playlist_module",
        backend_root / "background-generation" / "background_generation.py",
    )

    background_generation.require_local_llm_available()

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
    default_render_batch = argv[3] if len(argv) > 3 else "0"
    root = Path(project_root)

    try:
        result = run_playlist_pipeline(playlist_url, project_root, default_render_batch=default_render_batch)
    except Exception as error:
        result = {
            "ok": False,
            "stage": "playlist-preflight",
            "reason": getattr(error, "reason", "playlist-pipeline-failed"),
            "error": str(error),
        }
        print(json.dumps(_serialize(result), ensure_ascii=False, indent=2))
        return 1

    # Node orchestration ported to Python
    downloaded = []
    for entry in result.get("results", []):
        if entry.get("audio", {}).get("status") == "downloaded":
            lyrics_review = _get_lyrics_review(entry)
            downloaded.append({
                "video_id": _get_source_video_id(entry),
                "source_url": _get_source_url(entry),
                "song_dir": Path(entry["song_dir"]).name if entry.get("song_dir") else None,
                "ok": bool(entry.get("ok")),
                "lyrics_review": lyrics_review
            })
    
    downloaded = [d for d in downloaded if d["video_id"] or d["song_dir"]]
    lyrics_review_items = [d["lyrics_review"] for d in downloaded if d.get("lyrics_review")]

    recent_downloads_path = root / "artifacts" / "common" / "recent-downloads.json"
    try:
        recent_downloads_path.parent.mkdir(parents=True, exist_ok=True)
        recent_downloads_path.write_text(json.dumps({
            "playlist_url": playlist_url,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "count": len(downloaded),
            "lyrics_review_count": len(lyrics_review_items),
            "items": downloaded,
            "lyrics_review_items": lyrics_review_items
        }, indent=2) + "\n", encoding="utf-8")
        
        library_state_path = root / "artifacts" / "common" / "library-state.json"
        if library_state_path.exists():
            library_state = json.loads(library_state_path.read_text(encoding="utf-8"))
        else:
            library_state = {
                "nickname": "CleanKsen",
                "selectedPlaylistId": "new-downloads",
                "likedTrackIds": [],
                "customPlaylists": []
            }
        
        custom_playlists = library_state.get("customPlaylists", [])
        lyrics_review_song_dirs = [item["song_dir"] for item in lyrics_review_items if item.get("song_dir")]
        new_song_dirs = [item["song_dir"] for item in downloaded if item.get("song_dir") and item["song_dir"] not in lyrics_review_song_dirs]

        if downloaded:
            custom_playlists = ensure_playlist(custom_playlists, "new-downloads", "New Downloads", new_song_dirs, replace=True)
            custom_playlists = ensure_playlist(custom_playlists, "lyrics-review", "Lyrics Review", lyrics_review_song_dirs, replace=True)
        custom_playlists = ensure_playlist(custom_playlists, "alignment-error", "Alignment Error", [])

        library_state["selectedPlaylistId"] = library_state.get("selectedPlaylistId") or "new-downloads"
        library_state["customPlaylists"] = custom_playlists
        
        library_state_path.write_text(json.dumps(library_state, indent=2) + "\n", encoding="utf-8")
    except Exception as e:
        print(f"Warning: Failed to update library state: {e}", file=sys.stderr)

    current_song_config_path = root / "src" / "remotion" / "current-song.json"
    if current_song_config_path.exists():
        try:
            config = json.loads(current_song_config_path.read_text(encoding="utf-8"))
            song_dir_name = config.get("songDirName")
            if song_dir_name:
                subprocess.run(["node", "tools/select-song-for-preview.mjs", song_dir_name], cwd=project_root, check=True)
        except Exception as e:
            print(f"Warning: Failed to refresh preview props: {e}", file=sys.stderr)

    try:
        subprocess.run(["node", "tools/build-web-public.mjs"], cwd=project_root, check=True)
    except Exception as e:
        print(f"Warning: Failed to build web public: {e}", file=sys.stderr)

    print(json.dumps(_serialize(result), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv))
