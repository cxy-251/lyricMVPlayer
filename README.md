# lyricMVPlayer

`lyricMVPlayer` is an automated AI lyric video production project.

## Current state

- The project currently starts from a detailed requirements document.
- Business code has not been implemented yet.
- The immediate goal is to define a practical MVP before building the pipeline.

## What this project is

This project is intended to automate a full music lyric video workflow:

1. read song sources
2. download audio
3. get and align lyrics
4. generate background visuals
5. render lyric video output

It is not only a UI project. It is a multi-stage automation pipeline.

## Recommended reading order

1. [AGENTS.md](/Users/cxy251/Code/04AIMedia/lyricMVPlayer/AGENTS.md)
2. [docs/PROJECT_SCOPE.md](/Users/cxy251/Code/04AIMedia/lyricMVPlayer/docs/PROJECT_SCOPE.md)
3. [docs/PROJECT_MAP.md](/Users/cxy251/Code/04AIMedia/lyricMVPlayer/docs/PROJECT_MAP.md)
4. [docs/FEATURE_STATUS.md](/Users/cxy251/Code/04AIMedia/lyricMVPlayer/docs/FEATURE_STATUS.md)
5. [PROJECT_REQUIREMENTS.md](/Users/cxy251/Code/04AIMedia/lyricMVPlayer/PROJECT_REQUIREMENTS.md)

## Control files

- [AGENTS.md](/Users/cxy251/Code/04AIMedia/lyricMVPlayer/AGENTS.md): highest-priority rules for agents
- [docs/PROJECT_SCOPE.md](/Users/cxy251/Code/04AIMedia/lyricMVPlayer/docs/PROJECT_SCOPE.md): MVP boundaries and staged scope
- [docs/PROJECT_MAP.md](/Users/cxy251/Code/04AIMedia/lyricMVPlayer/docs/PROJECT_MAP.md): current structure and where future modules should live
- [docs/FEATURE_STATUS.md](/Users/cxy251/Code/04AIMedia/lyricMVPlayer/docs/FEATURE_STATUS.md): current workstream and feature status
- [tasks/TASK_TEMPLATE.md](/Users/cxy251/Code/04AIMedia/lyricMVPlayer/tasks/TASK_TEMPLATE.md): task format for future implementation work

## npm commands

Common commands for the frontend preview and render layer:

- `npm install`
  Install project dependencies.

- `npm run dev`
  Start Remotion Studio locally.
  Default preview URL:
  `http://localhost:3100/MusicVideo`

- `npm run use:song -- "<song-folder-name>"`
  Switch the active preview/render song package.
  This updates the Remotion preview entry to read from the selected song directory under:
  `artifacts/songs/`

- `npm run prepare:playlist -- "<playlist-url>" [default-render-batch]`
  Run the playlist preparation pipeline.
  This downloads and prepares each song package, resolves lyrics, aligns lyrics, generates background workflow assets, generates `audio-features.json`, and writes or updates:
  `artifacts/common/render-queue.csv`
  The CSV now keeps only:
  - `视频状态`
  - `渲染批次`
  - `资源文件夹`
  - `来源URL`
  It does not render MP4 files.

- `npm run refresh:cookies`
  Try to export reusable YouTube browser cookies into:
  `artifacts/common/youtube-cookies.txt`
  Future download steps will reuse this file automatically when it exists.

- `npm run render:queue -- [batch-value]`
  Read `artifacts/common/render-queue.csv` and render only rows where:
  - `视频状态 = 未渲染`
  - `渲染批次 = 0` by default, or the provided batch value

- `npm run typecheck`
  Run TypeScript checks without building.

- `npm run render`
  Render the currently selected song package directly to:
  `artifacts/songsout/<song-folder-name>.mp4`

Use these commands from:
`/Users/cxy251/Code/04AIMedia/lyricMVPlayer`

## Python preprocessing

Use the local `kwai` conda environment for Python-side media preprocessing.

- Generate deterministic motion features for one song:
  `conda run -n kwai python -c "import importlib.util, sys; p='/Users/cxy251/Code/04AIMedia/lyricMVPlayer/modules/audio-features/extract_audio_features.py'; spec=importlib.util.spec_from_file_location('audio_features_module', p); m=importlib.util.module_from_spec(spec); sys.modules['audio_features_module']=m; spec.loader.exec_module(m); print(m.extract_audio_features_for_song('/absolute/path/to/song-folder', frame_rate=60))"`

- The generated file will be:
  `audio-features.json`
  inside the song folder.

## Why this setup exists

The original requirements are large and ambitious. These control files exist to keep the project focused, staged, and implementable without overbuilding too early.
