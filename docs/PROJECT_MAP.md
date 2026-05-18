# PROJECT_MAP.md

## Current project structure

```text
lyricMVPlayer/
├─ AGENTS.md
├─ README.md
├─ PROJECT_REQUIREMENTS.md
├─ package.json
├─ remotion.config.ts
├─ tsconfig.json
├─ docs/
│  ├─ PROJECT_SCOPE.md
│  ├─ PROJECT_MAP.md
│  ├─ MODULES.md
│  └─ FEATURE_STATUS.md
├─ modules/
│  ├─ render-core/
│  │  └─ src/
│  ├─ source-ingestion/
│  ├─ audio-download/
│  ├─ lyrics/
│  ├─ audio-lyrics-alignment/
│  ├─ audio-features/
│  ├─ render-queue/
│  ├─ playlist-pipeline/
│  ├─ background-generation/
│  ├─ video-render/
│  ├─ history-dedupe/
│  └─ single-song-pipeline/
├─ artifacts/
│  ├─ common/
│  ├─ songsout/
│  └─ songs/
├─ src/
│  ├─ remotion/
│  └─ styles/
└─ tasks/
   └─ TASK_TEMPLATE.md
```

## What each file or directory does

- `AGENTS.md`
  Highest-priority operating rules for Codex and other agents.

- `README.md`
  Human-readable project entry point.

- `PROJECT_REQUIREMENTS.md`
  Large source requirements document describing the intended full system.

- `package.json`
  Initial project manifest for the render-core task.

- `remotion.config.ts`
  Initial Remotion configuration.

- `tsconfig.json`
  TypeScript compiler configuration.

- `docs/PROJECT_SCOPE.md`
  Defines the practical current MVP boundary.

- `docs/PROJECT_MAP.md`
  Explains the current structure and where future implementation areas should be introduced.

- `docs/MODULES.md`
  Defines the module split and the intended module responsibilities.

- `docs/FEATURE_STATUS.md`
  Tracks project workstreams and feature progress.

- `modules/`
  Module folders. Pipeline-facing modules should keep their own Python code beside their task files.

- `artifacts/common/`
  Shared cross-song state such as downloaded ID archives.
  Shared downloadable model files should also live under `artifacts/common/models/`.
  The render control CSV also lives here as `render-queue.csv`.

- `artifacts/songs/`
  One folder per song. Audio, lyrics, prompt files, generated images, and per-song temporary render outputs should stay together here.

- `artifacts/songsout/`
  Final exported MP4 files using the song folder name as the filename.

- `src/remotion/`
  Thin top-level Remotion integration entry plus preview binding for the currently selected song package.

- `src/styles/`
  Thin global reset / Tailwind entry only. Main HUD layout now lives inside render-core components.

- `tasks/TASK_TEMPLATE.md`
  Standard format for implementation or diagnosis tasks.

## Current codebase reality

- A minimal render-core skeleton now exists.
- The Remotion preview root now binds to one real `render-input.json` from `artifacts/songs/...`.
- A first non-mock source-ingestion Python module now exists for single-song YouTube URL normalization.
- A first audio-download Python module now exists and is designed around `yt-dlp` plus download-archive dedupe.
- A first lyrics Python module now exists with timed-lyrics fallback structure and two real providers in scope.
- A first audio-lyrics-alignment module now exists with a Demucs-oriented vocals separation interface and a replaceable lyric-line alignment runner.
- A first audio-features module now exists to preprocess deterministic `bass / mid / high / energy / beat / onset` frame data into `audio-features.json`.
- A first render-queue module now exists to maintain one CSV file controlling which prepared songs should be rendered.
- A first playlist-pipeline module now exists to prepare playlist entries up to song-package readiness without starting MP4 renders.
- A first background-generation Python module now exists to generate subjectless illustration prompt packages.
- A first single-song pipeline runner now exists to compose source, audio, and lyrics into one saved result.
- Song artifacts are now grouped by per-song folder using the naming pattern `song title - artist - id`.
- The currently active preview/render song is tracked in `src/remotion/current-song.json` and can be switched with `npm run use:song -- "<song-folder-name>"`.
- Shared downloaded-ID state now lives in `artifacts/common/`.
- The Remotion composition contract still lives under `modules/render-core/src/`.
- The fixed player HUD now lives under `modules/render-core/src/components/music-video/`.
- There is no CLI yet.
- There is no full video pipeline yet, but the first single-song ingestion runner now exists.

## Expected future implementation areas

Current top-level module areas are declared in `docs/MODULES.md` and `modules/`.

## How to maintain this file

Update this file when:

- a real implementation directory is added
- a major pipeline stage is introduced
- module responsibility changes

Keep it short and describe only structures that actually exist.
