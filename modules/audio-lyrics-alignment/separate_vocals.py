from __future__ import annotations

import os
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from demucs.apply import apply_model
from demucs.audio import AudioFile
from demucs.pretrained import get_model


@dataclass(frozen=True)
class VocalSeparationConfig:
    project_root: str
    models_root: str
    demucs_model_name: str = "htdemucs"
    stems: str = "vocals"
    two_stems: bool = True
    device: str = "cpu"
    shifts: int = 1
    overlap: float = 0.25
    split: bool = True


@dataclass(frozen=True)
class VocalSeparationResult:
    input_audio_path: str
    vocals_path: str
    accompaniment_path: str | None
    output_directory: str
    model_name: str


@dataclass(frozen=True)
class VocalSeparationError:
    code: str
    message: str
    details: dict | None = None


def get_default_models_root(project_root: str) -> Path:
    return Path(project_root) / "artifacts" / "common" / "models"


def get_default_alignment_config(project_root: str) -> VocalSeparationConfig:
    return VocalSeparationConfig(
        project_root=project_root,
        models_root=str(get_default_models_root(project_root)),
    )


def _demucs_models_root(config: VocalSeparationConfig) -> Path:
    root = Path(config.models_root) / "demucs"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _prepare_model_environment(config: VocalSeparationConfig) -> None:
    demucs_models_root = _demucs_models_root(config)
    os.environ["TORCH_HOME"] = str(demucs_models_root / "torch-home")
    os.environ["HF_HOME"] = str(demucs_models_root / "hf-home")
    os.environ["XDG_CACHE_HOME"] = str(demucs_models_root / "xdg-cache")


def _load_mix(audio_path: str, target_samplerate: int, target_channels: int) -> torch.Tensor:
    reader = AudioFile(Path(audio_path))
    wav = reader.read(streams=0, samplerate=target_samplerate, channels=target_channels)
    if isinstance(wav, torch.Tensor):
        if wav.ndim == 3:
            wav = wav[0]
        return wav.float()
    if isinstance(wav, np.ndarray):
        if wav.ndim == 3:
            wav = wav[0]
        return torch.from_numpy(wav).float()
    raise RuntimeError(f"Failed to decode audio into a supported waveform tensor. Got: {type(wav)!r}")


def _save_stem(stem_tensor: torch.Tensor, output_path: Path, samplerate: int) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    stem = stem_tensor.detach().cpu().numpy().T
    sf.write(str(output_path), stem, samplerate)


def separate_vocals(
    audio_path: str,
    song_dir: str,
    config: VocalSeparationConfig,
) -> tuple[VocalSeparationResult | None, VocalSeparationError | None]:
    input_path = Path(audio_path)
    if not input_path.exists():
        return None, VocalSeparationError(
            code="audio-not-found",
            message=f"Audio file does not exist: {audio_path}",
        )

    output_dir = Path(song_dir) / "separated"
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        _prepare_model_environment(config)
        model = get_model(config.demucs_model_name)
        model.to(config.device)
        model.eval()

        samplerate = int(model.samplerate)
        audio_channels = int(model.audio_channels)
        mix = _load_mix(audio_path, target_samplerate=samplerate, target_channels=audio_channels)
        separated = apply_model(
            model,
            mix[None].to(config.device),
            shifts=config.shifts,
            split=config.split,
            overlap=config.overlap,
            progress=True,
            device=config.device,
            num_workers=0,
        )[0]

        sources = list(model.sources)
        if config.stems not in sources:
            return None, VocalSeparationError(
                code="stem-not-found",
                message=f"Requested stem '{config.stems}' is not available in model sources.",
                details={"available_sources": sources},
            )

        vocals_index = sources.index(config.stems)
        vocals_path = output_dir / "vocals.wav"
        _save_stem(separated[vocals_index], vocals_path, samplerate)

        accompaniment_path: Path | None = None
        if config.two_stems:
            accompaniment = torch.zeros_like(separated[vocals_index])
            for index, source_name in enumerate(sources):
                if source_name == config.stems:
                    continue
                accompaniment = accompaniment + separated[index]
            accompaniment_path = output_dir / "no_vocals.wav"
            _save_stem(accompaniment, accompaniment_path, samplerate)

        return (
            VocalSeparationResult(
                input_audio_path=str(input_path),
                vocals_path=str(vocals_path),
                accompaniment_path=str(accompaniment_path) if accompaniment_path else None,
                output_directory=str(output_dir),
                model_name=config.demucs_model_name,
            ),
            None,
        )
    except Exception as error:  # noqa: BLE001
        return None, VocalSeparationError(
            code="demucs-failed",
            message="Demucs failed while separating vocals.",
            details={"error": str(error)},
        )


def vocal_separation_result_to_json(result: VocalSeparationResult) -> dict:
    return asdict(result)
