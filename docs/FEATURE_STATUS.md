# FEATURE_STATUS.md

## Status values

Allowed status values:

- `Not Started`
- `Planned`
- `Partial`
- `Done`
- `Deprecated`

## Feature status table

| Feature name | Status | Description | Related files |
| --- | --- | --- | --- |
| Project control setup | Done | Lightweight control files have been created for this repository. | `AGENTS.md`, `README.md`, `docs/*`, `tasks/TASK_TEMPLATE.md` |
| MVP scope definition | Partial | The full requirements exist, and MVP boundaries now emphasize non-mock audio plus timed lyric acquisition, but implementation sequencing still needs continued refinement. | `PROJECT_REQUIREMENTS.md`, `docs/PROJECT_SCOPE.md`, `docs/MODULES.md`, `tasks/TASK-002-audio-and-timed-lyrics.md` |
| Module decomposition | Done | The project has been split into explicit modules with per-module task documents. | `docs/MODULES.md`, `modules/*` |
| Render-core module skeleton | Partial | The render-core slice now drives a fixed 1080x1920 music-video HUD with dedicated components, lucide-react icons, a canvas waveform ribbon, playlist drawer, timed lyric carousel, and one real-song Remotion preview, but final MP4 verification and broader queue data are still pending. | `package.json`, `remotion.config.ts`, `tsconfig.json`, `src/components/music-video/*`, `src/styles/music-video-player.css`, `src/remotion/*`, `modules/render-core/src/*`, `modules/render-core/MODULE_TASK.md`, `tasks/TASK-001-render-core.md` |
| Source-ingestion module | Done | Single-song YouTube URL normalization and stable source identity generation are implemented in Python and have been validated with a real YouTube URL parse. | `modules/source-ingestion/source_ingestion.py`, `modules/source-ingestion/MODULE_TASK.md`, `tasks/TASK-002-audio-and-timed-lyrics.md` |
| Audio-download module | Done | `yt-dlp`-based audio download, metadata persistence, and archive-based dedupe are implemented in Python and have been validated with a real public YouTube download plus duplicate-skip behavior. | `modules/audio-download/audio_download.py`, `modules/audio-download/MODULE_TASK.md`, `tasks/TASK-002-audio-and-timed-lyrics.md` |
| Lyrics module | Partial | Timed lyric normalization, scoring, and fallback resolution structure are implemented in Python. YouTube captions, YouTube Music timed lyrics, and LRCLIB are wired as real providers and have real-network validation, while alignment fallback is still pending. | `modules/lyrics/lyrics.py`, `modules/lyrics/MODULE_TASK.md`, `tasks/TASK-002-audio-and-timed-lyrics.md` |
| Audio lyrics alignment module | Partial | A dedicated Python module now exists for vocals separation and lyric-line alignment. It defines Demucs-based separation, a faster-whisper-based transcript provider, and alignedLRC JSON output, but the required local models and runtime dependencies are not validated yet. | `modules/audio-lyrics-alignment/separate_vocals.py`, `modules/audio-lyrics-alignment/align_lyrics.py`, `modules/audio-lyrics-alignment/audio_lyrics_alignment.py`, `modules/audio-lyrics-alignment/MODULE_TASK.md` |
| Offline lyric offset estimation | Partial | A browser-side utility now exists to estimate `lyricOffsetMs` from audio RMS by detecting the first sustained vocal-energy onset. It is not wired into the pipeline automatically yet, and manual offset remains available as a fallback. | `src/lib/estimateLyricOffset.ts`, `modules/video-render/video_render.py`, `src/remotion/preview-composition-props.ts` |
| Background-generation module | Partial | A first Python module generates subjectless illustration background prompt packages, exports a ComfyUI workflow, and can sync the latest generated background image back into the song folder, but full automated ComfyUI execution is not connected yet. | `modules/background-generation/background_generation.py`, `modules/background-generation/MODULE_TASK.md` |
| Single-song pipeline runner | Done | The Python runner now composes source ingestion, audio download, lyric resolution, background prompt/workflow generation, and render-input refresh for one real song package. | `modules/single-song-pipeline/single_song_pipeline.py`, `modules/single-song-pipeline/MODULE_TASK.md` |
| Single-song automated pipeline | Partial | The real single-song slice now reaches audio, timed lyrics, prompt files, ComfyUI workflow export, synced background image, and Remotion render input, but live Remotion preview and MP4 rendering are not fully verified yet. | `modules/source-ingestion/source_ingestion.py`, `modules/audio-download/audio_download.py`, `modules/lyrics/lyrics.py`, `modules/background-generation/background_generation.py`, `modules/video-render/video_render.py`, `modules/single-song-pipeline/single_song_pipeline.py` |
| Playlist automation | Planned | Playlist handling is part of the long-term product direction but not the first build target. | `PROJECT_REQUIREMENTS.md` |
| Lyric acquisition and timing | Not Started | Not implemented yet. | None |
| Background generation via ComfyUI | Partial | Background workflow export and generated-image sync are implemented; direct automated ComfyUI execution remains pending. | `modules/background-generation/background_generation.py`, `artifacts/songs/*/background-workflow.json` |
| Remotion lyric video rendering | Partial | Real render-input preparation exists, the preview composition is wired to one song package, and the rebuilt fixed-layout HUD has live preview and still-render validation, but final MP4 export flow is still pending. | `src/components/music-video/*`, `src/styles/music-video-player.css`, `src/remotion/*`, `modules/render-core/src/*`, `modules/video-render/video_render.py` |

## How to maintain this file

- Track real workstreams, not imagined architecture.
- Mark `Done` only when the work is actually usable.
- Prefer simple descriptions that a non-specialist can understand.
