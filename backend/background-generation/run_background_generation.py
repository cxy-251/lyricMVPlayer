from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


def _load_background_generation_module(project_root: Path):
    module_path = project_root / "backend" / "background-generation" / "background_generation.py"
    spec = importlib.util.spec_from_file_location("background_generation_runtime_module", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module from {module_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["background_generation_runtime_module"] = module
    spec.loader.exec_module(module)
    return module


def _load_render_queue_module(project_root: Path):
    module_path = project_root / "backend" / "render-queue" / "render_queue.py"
    spec = importlib.util.spec_from_file_location("render_queue_runtime_module", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module from {module_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["render_queue_runtime_module"] = module
    spec.loader.exec_module(module)
    return module


def _list_song_dirs(project_root: Path) -> list[Path]:
    songs_root = project_root / "artifacts" / "songs"
    if not songs_root.exists():
        return []
    return sorted([path for path in songs_root.iterdir() if path.is_dir()], key=lambda item: item.name.lower())


def _resolve_current_song_dir(project_root: Path) -> Path:
    current_song_path = project_root / "src" / "remotion" / "current-song.json"
    data = json.loads(current_song_path.read_text(encoding="utf-8"))
    song_dir_name = data.get("songDirName")
    if not song_dir_name:
        raise RuntimeError("Missing songDirName in current-song.json")
    song_dir = project_root / "artifacts" / "songs" / song_dir_name
    if not song_dir.exists():
        raise RuntimeError(f"Song directory not found: {song_dir}")
    return song_dir


def _needs_background(song_dir: Path) -> bool:
    for candidate in ["background.png", "background.jpg", "background.jpeg", "background.webp"]:
        if (song_dir / candidate).exists():
            return False
    return True


def _load_playlist_song_dirs(project_root: Path, playlist_id: str) -> list[str]:
    library_state_path = project_root / "artifacts" / "common" / "library-state.json"
    if not library_state_path.exists():
        return []
    data = json.loads(library_state_path.read_text(encoding="utf-8"))
    for playlist in data.get("customPlaylists", []):
        if playlist.get("id") == playlist_id:
            return [
                str(track_id).strip()
                for track_id in playlist.get("trackIds", [])
                if str(track_id).strip()
            ]
    return []


def _should_include_finished_for_batch(batch_value: str) -> bool:
    return batch_value != "0"


def _should_include_ready_for_batch(batch_value: str) -> bool:
    return batch_value != "0"


def _background_blocked_result(song_dir: Path, batch_value: str = "0") -> dict:
    return {
        "ok": False,
        "song_dir": str(song_dir),
        "error": "background-generation-skipped-by-render-queue",
        "message": (
            f"Only production-queue rows with render_batch={batch_value} can generate backgrounds"
            + ("." if _should_include_finished_for_batch(batch_value) else " when they are not rendered or published.")
        ),
    }


def _refresh_visual_plan_for_row(bg, render_queue, project_root: Path, song_dir_name: str) -> dict:
    song_dir = project_root / "artifacts" / "songs" / song_dir_name
    try:
        asset_paths = bg.refresh_song_background_assets(str(song_dir), require_llm=True)
        render_input_path = bg.refresh_render_input_for_song(str(song_dir), str(project_root))
        render_queue.mark_background_generated(str(project_root), song_dir_name, False)
        return {
            "ok": True,
            "song_dir": str(song_dir),
            "background_json_path": asset_paths["background_json_path"],
            "poetry_json_path": asset_paths["poetry_json_path"],
            "workflow_path": asset_paths["workflow_path"],
            "render_input_path": render_input_path,
            "background_ready": False,
        }
    except Exception as error:
        return {
            "ok": False,
            "song_dir": str(song_dir),
            "reason": getattr(error, "reason", "lyrics-llm-workflow-text-refresh-failed"),
            "error": str(error),
        }


def _main(argv: list[str]) -> int:
    if len(argv) < 3:
        raise SystemExit(
            "Usage:\n"
            "  run_background_generation.py current <project_root>\n"
            "  run_background_generation.py queue <project_root> [batch]\n"
            "  run_background_generation.py missing <project_root> [batch]\n"
            "  run_background_generation.py lyrics-llm-workflow-text <project_root> [batch]\n"
            "  run_background_generation.py new-downloads <project_root>\n"
            "  run_background_generation.py playlist <project_root> <playlist_id>\n"
            "  run_background_generation.py song <project_root> <song_dir_name>\n"
        )

    command = argv[1]
    project_root = Path(argv[2])
    selected_batch_value = argv[3] if len(argv) >= 4 and not argv[3].startswith("--") else "0"
    selected_batch_includes_finished = _should_include_finished_for_batch(selected_batch_value)
    selected_batch_includes_ready = _should_include_ready_for_batch(selected_batch_value)
    bg = _load_background_generation_module(project_root)
    render_queue = _load_render_queue_module(project_root)
    llm_required_commands = {"lyrics-llm-workflow-text"}
    if command in llm_required_commands:
        try:
            bg.require_local_llm_available()
        except Exception as error:
            print(
                json.dumps(
                    {
                        "ok": False,
                        "reason": getattr(error, "reason", "local-llm-unavailable"),
                        "error": str(error),
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 1

    comfyui_required_commands = {"current", "missing", "queue", "new-downloads", "playlist", "song"}
    if command in comfyui_required_commands:
        if not bg.is_comfyui_api_available():
            print(
                json.dumps(
                    {
                        "ok": False,
                        "reason": "comfyui-api-unavailable",
                        "error": f"ComfyUI API is unavailable at {bg.get_default_comfyui_api_url()}.",
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 1

    generation_status = 1
    import subprocess

    if command == "current":
        song_dir = _resolve_current_song_dir(project_root)
        if not render_queue.is_background_generation_allowed(str(project_root), song_dir.name):
            result = _background_blocked_result(song_dir)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            generation_status = 1
        else:
            result = bg.generate_background_for_song(str(song_dir), str(project_root))
            print(json.dumps(result, ensure_ascii=False, indent=2))
            generation_status = 0 if result.get("ok") else 1

    elif command == "missing":
        results = []
        pending_rows = render_queue.list_background_pending_rows(
            str(project_root),
            batch_value=selected_batch_value,
            include_finished=selected_batch_includes_finished,
            include_ready=selected_batch_includes_ready,
        )
        for row in pending_rows:
            song_dir_name = row.get("song_dir", "").strip()
            if not song_dir_name:
                continue
            song_dir = project_root / "artifacts" / "songs" / song_dir_name
            if not _needs_background(song_dir):
                continue
            results.append(bg.generate_background_for_song(str(song_dir), str(project_root)))
        print(
            json.dumps(
                {
                    "target": "missing-backgrounds",
                    "render_batch": selected_batch_value,
                    "include_finished": selected_batch_includes_finished,
                    "include_ready": selected_batch_includes_ready,
                    "results": results,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        generation_status = 0 if all(item.get("ok") for item in results) else 1

    elif command == "queue":
        results = []
        pending_rows = render_queue.list_background_pending_rows(
            str(project_root),
            batch_value=selected_batch_value,
            include_finished=selected_batch_includes_finished,
            include_ready=selected_batch_includes_ready,
        )
        for row in pending_rows:
            song_dir_name = row.get("song_dir", "").strip()
            if not song_dir_name:
                continue
            song_dir = project_root / "artifacts" / "songs" / song_dir_name
            result = bg.generate_background_for_song(str(song_dir), str(project_root))
            if result.get("ok"):
                render_queue.mark_background_generated(str(project_root), song_dir_name, True)
            results.append(result)

        recovered_results = []
        for row in pending_rows:
            song_dir_name = row.get("song_dir", "").strip()
            if not song_dir_name:
                continue
            song_dir = project_root / "artifacts" / "songs" / song_dir_name
            background_path = None
            for candidate in ("background.png", "background.jpg", "background.jpeg", "background.webp"):
                path = song_dir / candidate
                if path.exists():
                    background_path = str(path)
                    break
            if background_path is not None:
                render_queue.mark_background_generated(str(project_root), song_dir_name, True)
                recovered_results.append(
                    {
                        "ok": True,
                        "song_dir": str(song_dir),
                        "background_path": background_path,
                        "recovered_after_generation": True,
                    }
                )
        print(
            json.dumps(
                {
                    "target": "background-images",
                    "render_batch": selected_batch_value,
                    "include_finished": selected_batch_includes_finished,
                    "include_ready": selected_batch_includes_ready,
                    "results": results,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        if all(item.get("ok") for item in results):
            generation_status = 0
        else:
            unresolved = [
                item for item in results
                if not item.get("ok")
                and not any(recovered.get("song_dir") == item.get("song_dir") for recovered in recovered_results)
            ]
            if recovered_results:
                print(json.dumps({"recovered": recovered_results}, ensure_ascii=False, indent=2))
            generation_status = 0 if not unresolved else 1

    elif command == "lyrics-llm-workflow-text":
        results = []
        target_rows = render_queue.list_rows_for_visual_plan_regeneration(
            str(project_root),
            batch_value=selected_batch_value,
            include_finished=selected_batch_includes_finished,
        )
        for row in target_rows:
            song_dir_name = row.get("song_dir", "").strip()
            if not song_dir_name:
                continue
            results.append(_refresh_visual_plan_for_row(bg, render_queue, project_root, song_dir_name))
        print(
            json.dumps(
                {
                    "target": "lyrics-llm-workflow-text",
                    "render_batch": selected_batch_value,
                    "include_finished": selected_batch_includes_finished,
                    "count": len(target_rows),
                    "results": results,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        generation_status = 0 if results and all(item.get("ok") for item in results) else 1

    elif command in {"new-downloads", "playlist"}:
        playlist_id = "new-downloads" if command == "new-downloads" else (argv[3] if len(argv) >= 4 else "")
        if not playlist_id:
            raise SystemExit("Usage: run_background_generation.py playlist <project_root> <playlist_id>")
        results = []
        for song_dir_name in _load_playlist_song_dirs(project_root, playlist_id):
            song_dir = project_root / "artifacts" / "songs" / song_dir_name
            if not render_queue.is_background_generation_allowed(str(project_root), song_dir.name):
                results.append(_background_blocked_result(song_dir))
                continue
            result = bg.generate_background_for_song(str(song_dir), str(project_root))
            if result.get("ok"):
                render_queue.mark_background_generated(str(project_root), song_dir_name, True)
            results.append(result)
        print(json.dumps({"playlist_id": playlist_id, "results": results}, ensure_ascii=False, indent=2))
        generation_status = 0 if results and all(item.get("ok") for item in results) else 1

    elif command == "song":
        if len(argv) < 4:
            raise SystemExit("Usage: run_background_generation.py song <project_root> <song_dir_name>")
        song_dir = project_root / "artifacts" / "songs" / argv[3]
        if not render_queue.is_background_generation_allowed(str(project_root), song_dir.name):
            result = _background_blocked_result(song_dir)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            generation_status = 1
        else:
            result = bg.generate_background_for_song(str(song_dir), str(project_root))
            print(json.dumps(result, ensure_ascii=False, indent=2))
            generation_status = 0 if result.get("ok") else 1
    else:
        raise SystemExit(f"Unknown command: {command}")

    if generation_status == 0:
        current_song_config_path = project_root / "src" / "remotion" / "current-song.json"
        if current_song_config_path.exists():
            try:
                config = json.loads(current_song_config_path.read_text(encoding="utf-8"))
                song_dir_name = config.get("songDirName")
                if song_dir_name:
                    subprocess.run(["node", "tools/select-song-for-preview.mjs", song_dir_name], cwd=project_root, check=True)
            except Exception as e:
                print(f"Warning: Failed to refresh preview props after background generation: {e}", file=sys.stderr)

    try:
        subprocess.run(["node", "tools/build-web-public.mjs"], cwd=project_root, check=True)
    except Exception as e:
        print(f"Warning: Failed to refresh web public: {e}", file=sys.stderr)

    return generation_status


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv))
