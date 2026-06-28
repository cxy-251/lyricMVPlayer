# Architecture & Developer Guide

## 1. Project Scope & Overview

`lyricMVPlayer` is an automated, high-fidelity lyric video generation pipeline. It bridges audio acquisition, advanced lyric alignment, procedural background generation, and Remotion-based compositing into a unified studio. 

### Core Requirements
- **High-Quality Audio & Lyrics**: Rely heavily on normalized YouTube music metadata, LRCLIB/YT Music lyrics, and Whisper-based alignment when needed.
- **Procedural & Reactive Visuals**: Instead of generic static images, the pipeline generates 3D reactive visuals, dynamic typography, and ComfyUI-based backgrounds.
- **Unified Studio Environment**: A Vite-based local React application (`/studio`) to preview papers (video definitions), debug visual effects, and inspect lyric alignment before the heavy Remotion MP4 export process.

## 2. Directory Structure

- `artifacts/`: Local caching directory for all pipeline data (songs, manifests, render output). **Not checked into git**.
- `docs/`: Core project documentation.
- `modules/`: Discrete business logic packages.
  - `audio-download/`: `yt-dlp` based audio ingestion.
  - `audio-features/`: Preprocessing track frequency/energy data for reactive layers.
  - `audio-lyrics-alignment/`: Advanced Whisper + Demucs fallback for lyric timing.
  - `background-generation/`: Integration with ComfyUI.
  - `history-dedupe/`, `playlist-pipeline/`, `render-queue/`: Batch processing orchestration.
  - `lyrics/`: Scrapers and normalizers for text acquisition.
  - `paper-video/`: Main React composition and data loading logic.
  - `render-core/`: Pure React/Three.js visual effect registry and core components.
  - `single-song-pipeline/`: Python orchestrator for the backend prep.
  - `source-ingestion/`, `video-render/`: Helpers.
- `src/`: The unified Web Studio and Remotion roots.
  - `src/web/`: The Vite studio frontend (Paper Player, Effect Lab, etc).
  - `src/remotion/`: The Remotion renderer entry points.

## 3. Pipeline Stages

1. **Ingestion & Prep (Python)**
   - Single Song Pipeline -> Source Ingestion -> Audio Download -> Lyrics -> Alignment -> Audio Features -> Background.
2. **Preview & Tweak (Web / React)**
   - Developers and users view `/studio` to check `paper-library.json`, use Effect Lab to design visuals, and verify lyrics.
3. **Render (Remotion)**
   - `npm run build` or `npm run dev` kicks off Remotion using the finalized manifest.

## 4. Current Feature Status

- **Completed**: Control setup, module decomposition, source ingestion, audio download, basic audio feature extraction, render queue structure.
- **In Progress**: 
  - *Unified Studio App*: React router refactored; Effect Lab and Paper Player active.
  - *Render Core*: Stable 3D Lab and React visual engine.
  - *Audio Lyrics Alignment*: Implemented Whisper/Demucs fallback; needs hard-song tuning.
  - *Background Generation*: Implemented prompt logic; needs automated ComfyUI execution.
- **Planned**: Playlist-scale automation, fully autonomous batch MP4 publishing.
