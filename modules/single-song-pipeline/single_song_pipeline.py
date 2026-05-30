from __future__ import annotations

import importlib.util
import json
import re
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


def _module_paths(project_root: Path) -> dict[str, Path]:
    modules_root = project_root / "modules"
    return {
        "source_ingestion": modules_root / "source-ingestion" / "source_ingestion.py",
        "audio_download": modules_root / "audio-download" / "audio_download.py",
        "lyrics": modules_root / "lyrics" / "lyrics.py",
        "audio_lyrics_alignment": modules_root / "audio-lyrics-alignment" / "audio_lyrics_alignment.py",
        "background_generation": modules_root / "background-generation" / "background_generation.py",
        "video_render": modules_root / "video-render" / "video_render.py",
    }


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _is_decorative_lyric(text: str) -> bool:
    return bool(re.fullmatch(r"[♪\s]+", text))


def _format_lrc_timestamp(start_ms: int) -> str:
    total_seconds = max(0, start_ms / 1000)
    minutes = int(total_seconds // 60)
    seconds = total_seconds - minutes * 60
    return f"{minutes:02d}:{seconds:05.2f}"


def _timed_lyrics_document_to_lrc_text(document) -> str:
    rows: list[str] = []
    for line in document.lines:
        text = line.text.strip()
        if not text:
            continue
        rows.append(f"[{_format_lrc_timestamp(int(line.start_ms))}] {text}")
    return "\n".join(rows)


def save_pipeline_result(result: dict, project_root: str, write_to_song_dir: bool = True) -> str:
    root = Path(project_root)
    song_dir = result.get("song_dir")
    if write_to_song_dir and song_dir:
        output_dir = Path(song_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / "pipeline.json"
    else:
        result_dir = root / "artifacts" / "common"
        result_dir.mkdir(parents=True, exist_ok=True)
        source_identity_key = result.get("source", {}).get("source_identity_key", "pipeline-error")
        safe_name = source_identity_key.replace(":", "__")
        output_path = result_dir / f"{safe_name}.pipeline.json"
    output_path.write_text(json.dumps(_serialize(result), ensure_ascii=False, indent=2), encoding="utf-8")
    return str(output_path)


def run_single_song_pipeline(input_url: str, project_root: str) -> dict:
    root = Path(project_root)
    paths = _module_paths(root)

    source_ingestion = _load_module("source_ingestion_module", paths["source_ingestion"])
    audio_download = _load_module("audio_download_module", paths["audio_download"])
    lyrics = _load_module("lyrics_module_pipeline", paths["lyrics"])
    audio_lyrics_alignment = _load_module("audio_lyrics_alignment_module", paths["audio_lyrics_alignment"])
    background_generation = _load_module("background_generation_module", paths["background_generation"])
    video_render = _load_module("video_render_module", paths["video_render"])

    record, source_error = source_ingestion.normalize_source_input(input_url)
    if source_error is not None:
        result = {
            "ok": False,
            "stage": "source-ingestion",
            "error": _serialize(source_error),
        }
        result["result_path"] = save_pipeline_result(result, project_root)
        return result

    audio_config = audio_download.get_default_audio_download_config(project_root)
    audio_record, audio_error = audio_download.download_audio(record, audio_config)
    if audio_error is not None:
        result = {
            "ok": False,
            "stage": "audio-download",
            "source": {
                "source_identity_key": source_ingestion.get_source_identity(record),
                "record": _serialize(record),
            },
            "error": _serialize(audio_error),
        }
        result["result_path"] = save_pipeline_result(result, project_root)
        return result

    song_base_name = audio_download.build_song_base_name(audio_record.metadata)
    song_dir = audio_download.build_song_directory(audio_config, audio_record.metadata)
    if audio_record.status == "skipped":
        result = {
            "ok": True,
            "stage": "skipped-existing",
            "song_base_name": song_base_name,
            "song_dir": str(song_dir),
            "source": {
                "source_identity_key": source_ingestion.get_source_identity(record),
                "record": _serialize(record),
            },
            "audio": _serialize(audio_record),
            "skipped_existing": True,
        }
        result["result_path"] = save_pipeline_result(result, project_root, write_to_song_dir=False)
        return result

    lyric_input = lyrics.TimedLyricResolutionInput(
        watch_url=record.watch_url,
        title=audio_record.metadata.title,
        artist=audio_record.metadata.channel or audio_record.metadata.uploader,
        duration_seconds=audio_record.metadata.duration,
    )
    song_dir.mkdir(parents=True, exist_ok=True)
    timed_lyrics_path = song_dir / "lyrics.json"
    lyric_document, lyric_error = lyrics.resolve_timed_lyrics(lyric_input)
    fallback_result = None
    fallback_error = None
    if lyric_error is not None:
        result = {
            "ok": False,
            "stage": "lyrics",
            "song_base_name": song_base_name,
            "song_dir": str(song_dir),
            "source": {
                "source_identity_key": source_ingestion.get_source_identity(record),
                "record": _serialize(record),
            },
            "audio": _serialize(audio_record),
            "error": _serialize(lyric_error),
            "fallback_error": fallback_error,
        }
        result["result_path"] = save_pipeline_result(result, project_root)
        return result

    if hasattr(lyric_document, "lines"):
        timed_lyrics_path.write_text(lyrics.timed_lyrics_to_json(lyric_document), encoding="utf-8")
    alignment_result = None
    alignment_error = None
    if audio_record.audio_path:
        lyrics_lines_for_alignment = (
            lyric_document.lines if hasattr(lyric_document, "lines") else []
        )
        lyrics_text = _timed_lyrics_document_to_lrc_text(lyric_document) if hasattr(lyric_document, "lines") else ""
        if lyrics_text.strip():
            alignment_result, alignment_error = audio_lyrics_alignment.run_audio_lyrics_alignment(
                audio_path=audio_record.audio_path,
                lyrics_text=lyrics_text,
                song_dir=str(song_dir),
                project_root=project_root,
                lyrics_format="lrc",
            )

    background_context = background_generation.BackgroundPromptContext(
        song_title=audio_record.metadata.title or record.source_identity.video_id,
        artist=audio_record.metadata.channel or audio_record.metadata.uploader or "unknown-artist",
        song_base_name=song_base_name,
        song_dir=str(song_dir),
        lyric_lines=[
            line.text if hasattr(line, "text") else str(line.get("text", ""))
            for line in (lyric_document.lines if hasattr(lyric_document, "lines") else [])
        ],
    )
    background_package = background_generation.build_background_prompt_package(background_context)
    background_paths = background_generation.save_background_prompt_package(background_package, background_context)
    poetry_package = background_generation.build_poetry_frame_package(background_context)
    poetry_paths = background_generation.save_poetry_frame_package(poetry_package, background_context)
    workflow_package = background_generation.build_comfyui_workflow_package(background_package, background_context)
    workflow_path = background_generation.save_comfyui_workflow_package(workflow_package, background_context)
    render_job = video_render.build_render_job_input(str(song_dir))
    render_input_path = video_render.save_render_job_input(render_job)

    result = {
        "ok": True,
        "stage": "done",
        "song_base_name": song_base_name,
        "song_dir": str(song_dir),
        "source": {
            "source_identity_key": source_ingestion.get_source_identity(record),
            "record": _serialize(record),
        },
        "audio": _serialize(audio_record),
        "timed_lyrics": {
            "path": str(timed_lyrics_path),
            "document": _serialize(lyric_document),
            "score": lyrics.score_timed_lyrics(lyric_document) if hasattr(lyric_document, "lines") else None,
            "fallback_used": fallback_result is not None,
        },
        "aligned_lyrics": {
            "path": alignment_result.aligned_lrc_json_path if alignment_result else None,
            "vocals_path": alignment_result.vocals_path if alignment_result else None,
            "accompaniment_path": alignment_result.accompaniment_path if alignment_result else None,
            "error": alignment_error,
        },
        "background_prompt": {
            "package": _serialize(background_package),
            "json_path": background_paths["json_path"],
            "md_path": background_paths["md_path"],
        },
        "poetry_frame": {
            "package": _serialize(poetry_package),
            "json_path": poetry_paths["json_path"],
            "md_path": poetry_paths["md_path"],
        },
        "background_workflow": {
            "checkpoint_name": workflow_package.checkpoint_name,
            "width": workflow_package.width,
            "height": workflow_package.height,
            "steps": workflow_package.steps,
            "cfg": workflow_package.cfg,
            "sampler_name": workflow_package.sampler_name,
            "scheduler": workflow_package.scheduler,
            "workflow_path": workflow_path,
        },
        "render_input": {
            "path": render_input_path,
            "output_mp4_name": render_job.outputMp4Name,
            "background_kind": render_job.background.kind,
            "background_src": render_job.background.src,
        },
    }
    result["result_path"] = save_pipeline_result(result, project_root)
    return result


def sync_generated_background(
    song_dir: str,
    project_root: str,
    comfy_output_root: str | None = None,
) -> dict:
    root = Path(project_root)
    song_path = Path(song_dir)
    paths = _module_paths(root)

    background_generation = _load_module("background_generation_sync_module", paths["background_generation"])
    video_render = _load_module("video_render_sync_module", paths["video_render"])

    source_data = _load_json(song_path / "source.json")
    lyrics_data = _load_json(song_path / "lyrics.json")

    context = background_generation.BackgroundPromptContext(
        song_title=source_data.get("title") or song_path.name,
        artist=source_data.get("channel") or source_data.get("uploader") or "unknown-artist",
        song_base_name=song_path.name,
        song_dir=str(song_path),
        lyric_lines=[line.get("text", "") for line in lyrics_data.get("lines", [])],
    )

    imported_background_path = background_generation.import_latest_comfy_background(
        context=context,
        comfy_output_root=comfy_output_root,
    )
    render_input_path = video_render.refresh_render_job_input(str(song_path))

    return {
        "ok": imported_background_path is not None,
        "song_dir": str(song_path),
        "background_path": imported_background_path,
        "render_input_path": render_input_path,
    }
