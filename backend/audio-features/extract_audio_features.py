from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal


@dataclass(frozen=True)
class AudioFeatureFrame:
    timeMs: int
    bass: float
    mid: float
    high: float
    energy: float
    beat: float
    onset: float


@dataclass(frozen=True)
class AudioFeatureTrack:
    frameRate: int
    durationMs: int
    frames: list[AudioFeatureFrame]


def _normalize(values: np.ndarray) -> np.ndarray:
    if values.size == 0:
        return values
    values = np.maximum(values.astype(np.float32), 0.0)
    high = np.percentile(values, 95)
    if high <= 1e-8:
        return np.zeros_like(values, dtype=np.float32)
    return np.clip(values / high, 0.0, 1.0).astype(np.float32)


def _sample_series(values: np.ndarray, source_times_ms: np.ndarray, target_times_ms: np.ndarray) -> np.ndarray:
    if values.size == 0:
        return np.zeros_like(target_times_ms, dtype=np.float32)
    return np.interp(target_times_ms, source_times_ms, values).astype(np.float32)


def _moving_average(values: np.ndarray, window_size: int) -> np.ndarray:
    if values.size == 0 or window_size <= 1:
        return values.astype(np.float32)
    kernel = np.ones(window_size, dtype=np.float32) / float(window_size)
    return np.convolve(values.astype(np.float32), kernel, mode="same").astype(np.float32)


def _resample_if_needed(samples: np.ndarray, source_rate: int, target_rate: int) -> np.ndarray:
    if source_rate == target_rate:
        return samples.astype(np.float32)
    target_length = max(1, int(round(len(samples) * (target_rate / source_rate))))
    return signal.resample(samples.astype(np.float32), target_length).astype(np.float32)


def _rms_from_frames(samples: np.ndarray, hop_length: int, window_length: int) -> np.ndarray:
    if samples.size == 0:
        return np.zeros(0, dtype=np.float32)

    frame_count = max(1, int(np.ceil(samples.size / hop_length)))
    rms_values = np.zeros(frame_count, dtype=np.float32)

    for frame_index in range(frame_count):
        start = frame_index * hop_length
        end = min(samples.size, start + window_length)
        window = samples[start:end]
        if window.size == 0:
            continue
        rms_values[frame_index] = float(np.sqrt(np.mean(window * window)))

    return rms_values


def _detect_peaks(values: np.ndarray, minimum_distance_frames: int) -> np.ndarray:
    if values.size == 0:
        return np.zeros(0, dtype=np.int32)

    adaptive_threshold = max(
        float(np.mean(values) + np.std(values) * 0.45),
        float(np.percentile(values, 75) * 0.9),
        1e-4,
    )
    peak_indices, _ = signal.find_peaks(values, height=adaptive_threshold, distance=max(1, minimum_distance_frames))
    return peak_indices.astype(np.int32)


def extract_audio_features(audio_path: str, output_path: str, frame_rate: int = 60) -> str:
    raw_samples, source_rate = sf.read(audio_path, always_2d=False)
    if isinstance(raw_samples, np.ndarray) and raw_samples.ndim > 1:
        samples = raw_samples.mean(axis=1).astype(np.float32)
    else:
        samples = np.asarray(raw_samples, dtype=np.float32)

    sample_rate = 22050
    samples = _resample_if_needed(samples, int(source_rate), sample_rate)
    if samples.size == 0:
        raise ValueError(f"No audio samples loaded from {audio_path}")

    hop_length = 512
    window_length = 2048

    freqs, _, stft_complex = signal.stft(
        samples,
        fs=sample_rate,
        nperseg=window_length,
        noverlap=window_length - hop_length,
        nfft=window_length,
        padded=True,
        boundary="zeros",
    )
    stft = np.abs(stft_complex).astype(np.float32)

    bass_mask = (freqs >= 20) & (freqs < 180)
    mid_mask = (freqs >= 180) & (freqs < 2200)
    high_mask = freqs >= 2200

    bass_raw = np.mean(stft[bass_mask], axis=0) if np.any(bass_mask) else np.zeros(stft.shape[1], dtype=np.float32)
    mid_raw = np.mean(stft[mid_mask], axis=0) if np.any(mid_mask) else np.zeros(stft.shape[1], dtype=np.float32)
    high_raw = np.mean(stft[high_mask], axis=0) if np.any(high_mask) else np.zeros(stft.shape[1], dtype=np.float32)

    rms_raw = _rms_from_frames(samples, hop_length=hop_length, window_length=window_length)
    spectral_flux = np.sum(np.maximum(np.diff(stft, axis=1), 0.0), axis=0).astype(np.float32)
    onset_envelope = np.concatenate(([0.0], spectral_flux)).astype(np.float32)
    onset_envelope = _moving_average(onset_envelope, 3)

    onset_frames = _detect_peaks(onset_envelope, minimum_distance_frames=max(1, int(round(0.12 * sample_rate / hop_length))))
    beat_frames = _detect_peaks(rms_raw, minimum_distance_frames=max(1, int(round(0.33 * sample_rate / hop_length))))

    source_times_ms = (np.arange(stft.shape[1], dtype=np.float32) * hop_length / sample_rate) * 1000.0
    duration_ms = int(round((samples.size / sample_rate) * 1000.0))
    target_times_ms = np.arange(0, max(duration_ms, 1), 1000.0 / frame_rate, dtype=np.float32)

    bass = _sample_series(_normalize(bass_raw), source_times_ms, target_times_ms)
    mid = _sample_series(_normalize(mid_raw), source_times_ms, target_times_ms)
    high = _sample_series(_normalize(high_raw), source_times_ms, target_times_ms)
    energy = _sample_series(_normalize(rms_raw), source_times_ms[: len(rms_raw)], target_times_ms)
    onset_strength = _sample_series(_normalize(onset_envelope), source_times_ms[: len(onset_envelope)], target_times_ms)

    onset_signal = np.zeros_like(source_times_ms, dtype=np.float32)
    onset_signal[np.clip(onset_frames, 0, len(onset_signal) - 1)] = 1.0
    beat_signal = np.zeros_like(source_times_ms, dtype=np.float32)
    beat_signal[np.clip(beat_frames, 0, len(beat_signal) - 1)] = 1.0

    onset = _sample_series(onset_signal, source_times_ms, target_times_ms)
    beat = _sample_series(beat_signal, source_times_ms, target_times_ms)

    frames = [
        AudioFeatureFrame(
            timeMs=int(round(time_ms)),
            bass=float(bass[index]),
            mid=float(mid[index]),
            high=float(high[index]),
            energy=float(energy[index]),
            beat=float(beat[index]),
            onset=float(onset[index] * max(onset_strength[index], 0.35)),
        )
        for index, time_ms in enumerate(target_times_ms)
    ]

    output = AudioFeatureTrack(frameRate=frame_rate, durationMs=duration_ms, frames=frames)
    target = Path(output_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(asdict(output), ensure_ascii=False, indent=2), encoding="utf-8")
    return str(target)


def extract_audio_features_for_song(song_dir: str, frame_rate: int = 60) -> str:
    song_path = Path(song_dir)
    return extract_audio_features(
        audio_path=str(song_path / "audio.mp3"),
        output_path=str(song_path / "audio-features.json"),
        frame_rate=frame_rate,
    )
