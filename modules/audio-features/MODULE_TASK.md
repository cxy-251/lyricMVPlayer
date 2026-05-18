# audio-features module task

## Task Type
Implementation

## Goal
Create a deterministic audio feature preprocessing module that outputs `audio-features.json` for lyric video motion systems.

## Scope

- read song audio from `mp3` or `wav`
- compute frame-based `bass`, `mid`, `high`, `energy`, `beat`, and `onset`
- normalize values into a stable `0..1` range
- save one `audio-features.json` inside the song folder
- keep the output reusable by render-core and final video rendering

## Non-goals

- training any model
- live realtime audio analysis in the browser
- final render orchestration

## Public interface

- `extract_audio_features(audio_path, output_path, frame_rate=60)`
- `extract_audio_features_for_song(song_dir, frame_rate=60)`

## Outputs

- `audio-features.json`
