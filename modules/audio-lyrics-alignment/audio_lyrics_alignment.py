from __future__ import annotations

import importlib.util
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


def _module_paths(module_root: Path) -> dict[str, Path]:
    return {
        "separate_vocals": module_root / "separate_vocals.py",
        "align_lyrics": module_root / "align_lyrics.py",
        "diagnose_alignment": module_root / "diagnose_alignment.py",
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
