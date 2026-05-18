# MODULES.md

This document defines the intended module split for `lyricMVPlayer`.

## Module design rules

- Each module must have one primary responsibility.
- Each module must expose a small public interface.
- Each module should be testable in isolation.
- Each module should have its own task document.
- Modules should compose into the full pipeline without hidden coupling.

## Current modules

### `render-core`
- Purpose: base Remotion composition structure and rendering contracts
- Public interface: composition props, root registration, composition component
- Code location: `modules/render-core/src/` plus fixed HUD components in `src/components/music-video/`

### `source-ingestion`
- Purpose: normalize single-song or playlist inputs
- Public interface: normalized source record and source identity helpers
- Code location: `modules/source-ingestion/source_ingestion.py`

### `audio-download`
- Purpose: download audio, cover, and source metadata
- Public interface: downloaded asset record
- Code location: `modules/audio-download/audio_download.py`

### `lyrics`
- Purpose: normalize timed lyric data
- Public interface: timed lyric document
- Code location: `modules/lyrics/lyrics.py`

### `audio-lyrics-alignment`
- Purpose: separate vocals and align provided lyric text into reusable line timings
- Public interface: vocals separation result, aligned lyric JSON result, and one orchestration runner
- Code location: `modules/audio-lyrics-alignment/`

### `background-generation`
- Purpose: resolve or generate background visuals
- Public interface: prompt package, ComfyUI workflow package, and background import helper
- Code location: `modules/background-generation/background_generation.py`

### `video-render`
- Purpose: produce final rendered video outputs
- Public interface: render job input, refresh helper, and render result output
- Code location: `modules/video-render/`

### `history-dedupe`
- Purpose: track generated items and skip duplicates
- Public interface: duplicate check and append-history operations
- Code location: `modules/history-dedupe/`

### `single-song-pipeline`
- Purpose: compose source ingestion, audio download, and lyric resolution into one real runner
- Public interface: single-song pipeline run function and saved result output
- Code location: `modules/single-song-pipeline/single_song_pipeline.py`

## Recommended implementation order

1. `render-core`
2. `source-ingestion`
3. `audio-download`
4. `lyrics`
5. `audio-lyrics-alignment`
6. `background-generation`
7. `history-dedupe`
8. `single-song-pipeline`
9. `video-render`
