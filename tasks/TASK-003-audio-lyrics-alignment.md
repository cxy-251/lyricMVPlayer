# Task 003: audio lyrics alignment

## Task Type
Implementation

## Goal
Add a dedicated module that can separate `vocals.wav` from a song audio file and align provided lyric text into `alignedLRC.json`.

## Background
Current timed lyrics can still drift from the real vocal start and sentence boundaries. The project needs a reusable offline alignment slice that can later be wired into the single-song pipeline without changing the player UI.

## Scope

- create `modules/audio-lyrics-alignment/`
- define Demucs-oriented vocals separation interface
- define lyric-line alignment interface
- define `alignedLRC.json` output shape
- reserve `artifacts/common/models/` for shared downloadable models

## Non-goals

- WhisperX
- word-level karaoke timing
- UI or layout changes
- direct integration into the live player in this task

## Affected files

- `modules/audio-lyrics-alignment/`
- `artifacts/common/models/`
- `docs/MODULES.md`
- `docs/PROJECT_MAP.md`
- `docs/FEATURE_STATUS.md`

## Requirements

1. Python runtime target is the `kwai` conda environment.
2. Module code stays inside `modules/audio-lyrics-alignment/`.
3. Shared downloadable model files live under `artifacts/common/models/`.
4. Per-song generated artifacts still stay under each song folder.

## Acceptance criteria

- a clear vocals separation interface exists
- a clear lyric alignment interface exists
- `alignedLRC.json` output is defined and saveable
- the module can be validated for syntax/import health

## Validation steps

1. compile the new Python files in the `kwai` environment
2. confirm no empty files or dead placeholder directories were introduced

## Notes / Risks

- real Demucs and transcription model downloads are not part of this step
- faster-whisper is used as the first transcript provider design, but runtime availability still depends on the local environment
