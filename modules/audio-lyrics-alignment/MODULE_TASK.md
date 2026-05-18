# audio-lyrics-alignment module task

## Task Type
Implementation

## Goal
Create a dedicated Python module that can:

1. separate vocals from a given song audio file
2. align provided lyric text against the vocal track
3. output a machine-readable `alignedLRC.json`

The module should be designed to run inside the `kwai` conda environment.

## Module location

- code: `modules/audio-lyrics-alignment/`
- module task: `modules/audio-lyrics-alignment/MODULE_TASK.md`

## Scope

- accept `mp3` or `wav` song audio
- generate `vocals.wav`
- accept lyric input as `LRC` or plain text
- transcribe vocals through a replaceable transcription provider
- align lyric lines to transcript timing
- save `alignedLRC.json`
- keep all per-song outputs inside the song folder
- keep downloadable model assets under `artifacts/common/models/`

## Non-goals

- WhisperX
- word-level karaoke alignment
- UI changes
- background generation
- Remotion rendering

## Model path convention

- shared models root: `artifacts/common/models/`
- recommended subfolders:
  - `artifacts/common/models/demucs/`
  - `artifacts/common/models/faster-whisper/`

## Public interface

- `get_default_alignment_config(project_root)`
- `separate_vocals(audio_path, song_dir, config)`
- `align_lyrics(input_data, config)`
- `run_audio_lyrics_alignment(audio_path, lyrics_text, song_dir, project_root, lyrics_format="auto")`

## Outputs

- `separated/vocals.wav`
- `separated/no_vocals.wav` if available
- `alignedLRC.json`

## Acceptance target

- the module can return a stable `alignedLRC.json` shape
- vocals separation is isolated behind one interface
- lyric-text alignment is isolated behind one interface
- manual lyric offset can still remain as a fallback elsewhere in the app
