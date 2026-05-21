from __future__ import annotations

import importlib.util
import json
import sys
from dataclasses import asdict, dataclass, is_dataclass
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


@dataclass(frozen=True)
class AudioLyricsAlignmentResult:
    vocals_path: str
    accompaniment_path: str | None
    aligned_lrc_json_path: str
    lyric_source_format: str


@dataclass(frozen=True)
class TranscriptionFallbackResult:
    vocals_path: str
    accompaniment_path: str | None
    lyrics_json_path: str


@dataclass(frozen=True)
class ManualLyricsApplyResult:
    manual_lyrics_path: str
    vocals_path: str
    accompaniment_path: str | None
    aligned_lrc_json_path: str
    lyrics_json_path: str
    render_input_path: str
    background_json_path: str
    poetry_json_path: str
    workflow_path: str
    background_invalidated: bool
    queue_background_ready: str


def _module_paths(module_root: Path) -> dict[str, Path]:
    return {
        "separate_vocals": module_root / "separate_vocals.py",
        "align_lyrics": module_root / "align_lyrics.py",
        "diagnose_alignment": module_root / "diagnose_alignment.py",
        "background_generation": module_root.parent / "background-generation" / "background_generation.py",
        "video_render": module_root.parent / "video-render" / "video_render.py",
        "render_queue": module_root.parent / "render-queue" / "render_queue.py",
    }


def run_audio_lyrics_alignment(
    audio_path: str,
    lyrics_text: str,
    song_dir: str,
    project_root: str,
    lyrics_format: str = "auto",
) -> tuple[AudioLyricsAlignmentResult | None, dict | None]:
    module_root = Path(project_root) / "modules" / "audio-lyrics-alignment"
    paths = _module_paths(module_root)

    separate_vocals = _load_module("audio_lyrics_alignment_separate_vocals", paths["separate_vocals"])
    align_lyrics = _load_module("audio_lyrics_alignment_align_lyrics", paths["align_lyrics"])

    separation_config = separate_vocals.get_default_alignment_config(project_root)
    separation_result, separation_error = separate_vocals.separate_vocals(
        audio_path=audio_path,
        song_dir=song_dir,
        config=separation_config,
    )
    if separation_error is not None:
        return None, {
            "stage": "separate-vocals",
            "error": _serialize(separation_error),
        }

    align_input = align_lyrics.LyricsAlignmentInput(
        vocals_path=separation_result.vocals_path,
        lyrics_text=lyrics_text,
        lyrics_format=lyrics_format,
        models_root=separation_config.models_root,
    )
    aligned_document, aligned_error = align_lyrics.align_lyrics(align_input)
    if aligned_error is not None:
        return None, {
            "stage": "align-lyrics",
            "error": _serialize(aligned_error),
            "vocals_path": separation_result.vocals_path,
        }

    aligned_output_path = Path(song_dir) / "alignedLRC.json"
    align_lyrics.save_aligned_lyrics(aligned_document, str(aligned_output_path))

    return (
        AudioLyricsAlignmentResult(
            vocals_path=separation_result.vocals_path,
            accompaniment_path=separation_result.accompaniment_path,
            aligned_lrc_json_path=str(aligned_output_path),
            lyric_source_format=lyrics_format,
        ),
        None,
    )


def run_alignment_diagnostic(song_dir: str, project_root: str) -> tuple[dict | None, dict | None]:
    module_root = Path(project_root) / "modules" / "audio-lyrics-alignment"
    paths = _module_paths(module_root)
    diagnose_alignment = _load_module("audio_lyrics_alignment_diagnose_alignment", paths["diagnose_alignment"])

    try:
        report = diagnose_alignment.build_alignment_diagnostic(song_dir)
        output_paths = diagnose_alignment.save_alignment_diagnostic(report, song_dir)
        return {
            "report": _serialize(report),
            "json_path": output_paths["json_path"],
            "md_path": output_paths["md_path"],
        }, None
    except Exception as error:  # noqa: BLE001
        return None, {
            "stage": "diagnose-alignment",
            "error": {"message": str(error)},
        }


def run_transcription_fallback(
    audio_path: str,
    song_dir: str,
    project_root: str,
) -> tuple[TranscriptionFallbackResult | None, dict | None]:
    module_root = Path(project_root) / "modules" / "audio-lyrics-alignment"
    paths = _module_paths(module_root)

    separate_vocals = _load_module("audio_lyrics_fallback_separate_vocals", paths["separate_vocals"])
    align_lyrics = _load_module("audio_lyrics_fallback_align_lyrics", paths["align_lyrics"])

    separation_config = separate_vocals.get_default_alignment_config(project_root)
    separation_result, separation_error = separate_vocals.separate_vocals(
        audio_path=audio_path,
        song_dir=song_dir,
        config=separation_config,
    )
    if separation_error is not None:
        return None, {
            "stage": "separate-vocals",
            "error": _serialize(separation_error),
        }

    transcription_document, transcription_error = align_lyrics.transcribe_vocals_to_lyrics_document(
        vocals_path=separation_result.vocals_path,
        models_root=separation_config.models_root,
    )
    if transcription_error is not None:
        return None, {
            "stage": "transcribe-vocals",
            "error": _serialize(transcription_error),
            "vocals_path": separation_result.vocals_path,
        }

    lyrics_json_path = Path(song_dir) / "lyrics.json"
    lyrics_json_path.write_text(
        json.dumps(_serialize(transcription_document), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return (
        TranscriptionFallbackResult(
            vocals_path=separation_result.vocals_path,
            accompaniment_path=separation_result.accompaniment_path,
            lyrics_json_path=str(lyrics_json_path),
        ),
        None,
    )


def _detect_lyrics_format(lyrics_text: str) -> str:
    for line in lyrics_text.splitlines():
        if "[" in line and "]" in line:
            return "lrc"
    return "plain"


def _has_existing_background(song_path: Path) -> bool:
    return any((song_path / candidate).exists() for candidate in ("background.png", "background.jpg", "background.jpeg", "background.webp"))


def _align_existing_vocals(
    vocals_path: str,
    lyrics_text: str,
    lyrics_format: str,
    project_root: str,
    aligned_output_path: str,
) -> tuple[AudioLyricsAlignmentResult | None, dict | None]:
    module_root = Path(project_root) / "modules" / "audio-lyrics-alignment"
    paths = _module_paths(module_root)
    separate_vocals = _load_module("audio_lyrics_alignment_existing_vocals_config", paths["separate_vocals"])
    align_lyrics = _load_module("audio_lyrics_alignment_existing_vocals_align", paths["align_lyrics"])

    separation_config = separate_vocals.get_default_alignment_config(project_root)
    align_input = align_lyrics.LyricsAlignmentInput(
        vocals_path=vocals_path,
        lyrics_text=lyrics_text,
        lyrics_format=lyrics_format,
        models_root=separation_config.models_root,
    )
    aligned_document, aligned_error = align_lyrics.align_lyrics(align_input)
    if aligned_error is not None:
        return None, {
            "stage": "align-lyrics",
            "error": _serialize(aligned_error),
            "vocals_path": vocals_path,
        }

    align_lyrics.save_aligned_lyrics(aligned_document, aligned_output_path)

    return (
        AudioLyricsAlignmentResult(
            vocals_path=vocals_path,
            accompaniment_path=None,
            aligned_lrc_json_path=aligned_output_path,
            lyric_source_format=lyrics_format,
        ),
        None,
    )


def _aligned_document_to_timed_lyrics_payload(aligned_document: dict, manual_file_name: str) -> dict:
    return {
        "source": "manual-lyrics-alignment",
        "source_detail": manual_file_name,
        "has_word_level_timing": True,
        "language": None,
        "lines": [
            {
                "text": str(line.get("text", "")),
                "start_ms": int(line.get("start_ms", 0)),
                "end_ms": int(line.get("end_ms", 0)),
            }
            for line in aligned_document.get("lines", [])
            if str(line.get("text", "")).strip()
        ],
    }


def apply_manual_lyrics(
    song_dir: str,
    project_root: str,
    manual_file_name: str = "lyrics.manual.txt",
) -> tuple[ManualLyricsApplyResult | None, dict | None]:
    song_path = Path(song_dir)
    manual_path = song_path / manual_file_name
    audio_path = song_path / "audio.mp3"
    if not manual_path.exists():
        return None, {
            "stage": "manual-lyrics",
            "error": {"message": f"Missing manual lyrics file: {manual_path}"},
        }
    if not audio_path.exists():
        return None, {
            "stage": "manual-lyrics",
            "error": {"message": f"Missing audio file: {audio_path}"},
        }

    lyrics_text = manual_path.read_text(encoding="utf-8").strip()
    if not lyrics_text:
        return None, {
            "stage": "manual-lyrics",
            "error": {"message": f"Manual lyrics file is empty: {manual_path}"},
        }

    lyrics_format = _detect_lyrics_format(lyrics_text)
    separated_root = song_path / "separated"
    existing_vocals_path = separated_root / "vocals.wav"
    existing_accompaniment_path = separated_root / "no_vocals.wav"
    aligned_output_path = song_path / "alignedLRC.json"

    if existing_vocals_path.exists():
        alignment_result, alignment_error = _align_existing_vocals(
            vocals_path=str(existing_vocals_path),
            lyrics_text=lyrics_text,
            lyrics_format=lyrics_format,
            project_root=project_root,
            aligned_output_path=str(aligned_output_path),
        )
        if alignment_result is not None:
            alignment_result = AudioLyricsAlignmentResult(
                vocals_path=alignment_result.vocals_path,
                accompaniment_path=str(existing_accompaniment_path) if existing_accompaniment_path.exists() else None,
                aligned_lrc_json_path=alignment_result.aligned_lrc_json_path,
                lyric_source_format=alignment_result.lyric_source_format,
            )
    else:
        alignment_result, alignment_error = run_audio_lyrics_alignment(
            audio_path=str(audio_path),
            lyrics_text=lyrics_text,
            song_dir=song_dir,
            project_root=project_root,
            lyrics_format=lyrics_format,
        )
    if alignment_error is not None or alignment_result is None:
        return None, alignment_error

    aligned_payload = json.loads(Path(alignment_result.aligned_lrc_json_path).read_text(encoding="utf-8"))
    lyrics_json_path = song_path / "lyrics.json"
    lyrics_json_path.write_text(
        json.dumps(
            _aligned_document_to_timed_lyrics_payload(aligned_payload, manual_path.name),
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    module_root = Path(project_root) / "modules" / "audio-lyrics-alignment"
    paths = _module_paths(module_root)
    background_generation = _load_module("audio_lyrics_alignment_bg_refresh", paths["background_generation"])
    video_render = _load_module("audio_lyrics_alignment_render_refresh", paths["video_render"])
    render_queue = _load_module("audio_lyrics_alignment_render_queue", paths["render_queue"])

    asset_paths = background_generation.refresh_song_background_assets(song_dir)
    background_invalidated = False
    existing_background_preserved = _has_existing_background(song_path)
    render_input_path = video_render.refresh_render_job_input(song_dir)
    render_queue.mark_background_generated(project_root, song_path.name, existing_background_preserved)

    return (
        ManualLyricsApplyResult(
            manual_lyrics_path=str(manual_path),
            vocals_path=alignment_result.vocals_path,
            accompaniment_path=alignment_result.accompaniment_path,
            aligned_lrc_json_path=alignment_result.aligned_lrc_json_path,
            lyrics_json_path=str(lyrics_json_path),
            render_input_path=render_input_path,
            background_json_path=asset_paths["background_json_path"],
            poetry_json_path=asset_paths["poetry_json_path"],
            workflow_path=asset_paths["workflow_path"],
            background_invalidated=background_invalidated,
            queue_background_ready="true" if existing_background_preserved else "false",
        ),
        None,
    )
