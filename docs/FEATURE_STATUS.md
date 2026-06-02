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
| Render-core module skeleton | Partial | The render-core slice now drives a fixed 1080x1920 music-video HUD with dedicated components, lucide-react icons, queue and playlist panels, timed lyric carousel, deterministic reactive layers, and one real-song render composition reused by the unified web studio, but final MP4 verification and broader queue data are still pending. | `package.json`, `remotion.config.ts`, `tsconfig.json`, `src/remotion/*`, `src/web/*`, `src/styles/*`, `modules/render-core/src/*`, `modules/render-core/MODULE_TASK.md`, `tasks/TASK-001-render-core.md` |
| Unified studio app | Partial | The local development UI now runs through one Vite app for LyricsMusic, visual effect previews, and paper playback. `npm run dev` starts the web app plus library-state sync, while Remotion remains the MP4 render backend. | `vite.config.ts`, `src/web/*`, `tools/dev-with-sync.mjs`, `tools/build-web-public.mjs`, `modules/render-core/src/*` |
| Source-ingestion module | Done | Single-song YouTube URL normalization and stable source identity generation are implemented in Python and have been validated with a real YouTube URL parse. | `modules/source-ingestion/source_ingestion.py`, `modules/source-ingestion/MODULE_TASK.md`, `tasks/TASK-002-audio-and-timed-lyrics.md` |
| Audio-download module | Done | `yt-dlp`-based audio download, metadata persistence, and archive-based dedupe are implemented in Python and have been validated with a real public YouTube download plus duplicate-skip behavior. | `modules/audio-download/audio_download.py`, `modules/audio-download/MODULE_TASK.md`, `tasks/TASK-002-audio-and-timed-lyrics.md` |
| Lyrics module | Partial | Timed lyric normalization, scoring, and fallback resolution structure are implemented in Python. YouTube captions, YouTube Music timed lyrics, and LRCLIB are wired as real providers and have real-network validation, while alignment fallback is still pending. | `modules/lyrics/lyrics.py`, `modules/lyrics/MODULE_TASK.md`, `tasks/TASK-002-audio-and-timed-lyrics.md` |
| Audio lyrics alignment module | Partial | A dedicated Python module now exists for vocals separation, lyric-line alignment, and alignment diagnostics. It now runs on the local `kwai` environment with Demucs and faster-whisper, and the current reference song is aligned cleanly, but hard songs with heavy overlap or backing vocals may still need iterative tuning. | `modules/audio-lyrics-alignment/separate_vocals.py`, `modules/audio-lyrics-alignment/align_lyrics.py`, `modules/audio-lyrics-alignment/audio_lyrics_alignment.py`, `modules/audio-lyrics-alignment/diagnose_alignment.py`, `modules/audio-lyrics-alignment/MODULE_TASK.md` |
| Audio features preprocessing | Done | A deterministic preprocessing module now generates per-frame `bass`, `mid`, `high`, `energy`, `beat`, and `onset` values into `audio-features.json` for visual motion layers. | `modules/audio-features/extract_audio_features.py`, `modules/audio-features/MODULE_TASK.md`, `artifacts/songs/*/audio-features.json` |
| Render queue control | Done | A CSV-based render control system now lives in `artifacts/common/render-queue.csv` and tracks `未渲染 / 已渲染 / 已发布`, render batch, and song resource folder names. | `modules/render-queue/render_queue.py`, `modules/render-queue/MODULE_TASK.md`, `artifacts/common/render-queue.csv` |
| Playlist preparation pipeline | Partial | A playlist-level preparation pipeline now exists to process playlist entries through non-render stages and register them in the render queue, but it still needs live playlist validation on real playlist URLs. | `modules/playlist-pipeline/playlist_pipeline.py`, `modules/playlist-pipeline/MODULE_TASK.md`, `tools/prepare-playlist.mjs` |
| Offline lyric offset estimation | Partial | A browser-side utility now exists to estimate `lyricOffsetMs` from audio RMS by detecting the first sustained vocal-energy onset. It is not wired into the pipeline automatically yet, and manual offset remains available as a fallback. | `src/lib/estimateLyricOffset.ts`, `modules/video-render/video_render.py`, `src/remotion/preview-composition-props.ts` |
| Background-generation module | Partial | A first Python module generates subjectless illustration background prompt packages, exports a ComfyUI workflow, and can sync the latest generated background image back into the song folder, but full automated ComfyUI execution is not connected yet. | `modules/background-generation/background_generation.py`, `modules/background-generation/MODULE_TASK.md` |
| Single-song pipeline runner | Done | The Python runner now composes source ingestion, audio download, lyric resolution, background prompt/workflow generation, and render-input refresh for one real song package. | `modules/single-song-pipeline/single_song_pipeline.py`, `modules/single-song-pipeline/MODULE_TASK.md` |
| Single-song automated pipeline | Partial | The real single-song slice now reaches audio, timed lyrics, alignment, prompt files, ComfyUI workflow export, synced background image, `audio-features.json`, and Remotion render input, but playlist-scale validation and the final publish workflow are still pending. | `modules/source-ingestion/source_ingestion.py`, `modules/audio-download/audio_download.py`, `modules/lyrics/lyrics.py`, `modules/audio-lyrics-alignment/*`, `modules/audio-features/extract_audio_features.py`, `modules/background-generation/background_generation.py`, `modules/video-render/video_render.py`, `modules/single-song-pipeline/single_song_pipeline.py` |
| Playlist automation | Planned | Playlist handling is part of the long-term product direction but not the first build target. | `PROJECT_REQUIREMENTS.md` |
| Lyric acquisition and timing | Not Started | Not implemented yet. | None |
| Background generation via ComfyUI | Partial | Background workflow export and generated-image sync are implemented; direct automated ComfyUI execution remains pending. | `modules/background-generation/background_generation.py`, `artifacts/songs/*/background-workflow.json` |
| Remotion lyric video rendering | Partial | Real render-input preparation exists, the render composition is wired to one song package, the rebuilt fixed-layout HUD has live preview through the unified Vite app, and deterministic reactive visual layers can now consume `audio-features.json`, but broader MP4 export verification is still pending. | `src/remotion/*`, `src/web/*`, `src/styles/*`, `modules/render-core/src/*`, `modules/video-render/video_render.py`, `artifacts/songs/*/audio-features.json` |

## How to maintain this file

- Track real workstreams, not imagined architecture.
- Mark `Done` only when the work is actually usable.
- Prefer simple descriptions that a non-specialist can understand.
