# lyricMVPlayer

`lyricMVPlayer` is an automated AI lyric video production project.

## Current state

- The project now has one unified Vite development entry for the Lyrics, Effects, and Paper studio pages.
- Remotion remains the rendering backend for MP4 export, but it is no longer the default local preview UI.
- Song, paper, and generated visual assets are kept under `artifacts/` and exposed to the web UI through generated static manifests.

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
  Start the unified local studio. This command:
  - refreshes static web assets under `public-web/`
  - starts the library-state sync API on `http://127.0.0.1:3210`
  - starts the Vite web app on `http://127.0.0.1:3212`

  Main local routes:
  - `http://127.0.0.1:3212/`
  - `http://127.0.0.1:3212/LyricsMusic`
  - `http://127.0.0.1:3212/studio`
  - `http://127.0.0.1:3212/studio/effects`
  - `http://127.0.0.1:3212/studio/papers`

  The old Remotion Studio URL such as `http://localhost:3000/MusicVideo` is not the current development entry anymore.

- `npm run dev:web`
  Start only the Vite web app locally, without the library-state sync API.
  Default preview URL:
  `http://127.0.0.1:3212`
  This command first prepares deployable static song assets under:
  `public-web/`
  Prefer `npm run dev` for normal local work so playlist and review-state changes can be written back to `artifacts/common/library-state.json`.

- `npm run build:web`
  Build the deployable static web player into:
  `dist/`
  This command first prepares deployable static song assets under:
  `public-web/`
  This is the command to use for Cloudflare Pages builds.
  Recommended Cloudflare Pages settings:
  - Build command: `npm run build:web`
  - Build output directory: `dist`

- `npm run use:song -- "<song-folder-name>"`
  Switch the active direct-render song package.
  This updates the Remotion render entry to read from the selected song directory under:
  `artifacts/songs/`

- `artifacts/common/library-state.json`
  This file is the project-level seed for playlist definitions and the default nickname.
  If you want to add, rename, or reorder playlists, edit this file directly.
  The preview player no longer provides create/delete playlist UI.
  The fixed playlist `New Downloads` is maintained automatically:
  each time `prepare:playlist` succeeds, newly prepared songs are appended to that playlist so you can review and later remove them manually.
  The fixed playlist `Lyrics Review` is also maintained automatically:
  if the pipeline cannot find reliable synced lyrics, or detects that a YouTube Music lyric source points to a different video ID than the downloaded audio, the song is added to this playlist for manual review.
  The fixed playlist `Alignment Error` is for songs whose lyric source may be correct but whose listening result still needs alignment review.

- `npm run prepare:playlist -- "<playlist-url>" [default-render-batch]`
  Run the playlist preparation pipeline.
  This downloads and prepares each song package, resolves lyrics, aligns lyrics, generates prompt/workflow assets for the future background step, generates `audio-features.json`, and writes or updates:
  `artifacts/common/production-queue.csv`
  It also writes:
  `artifacts/common/recent-downloads.json`
  This file lists the latest downloaded song IDs and includes `lyrics_review_items` when a song needs lyric-source review.
  It also refreshes the current web preview library so newly prepared songs appear in the player after a page refresh.
  It does not generate background images and does not render MP4 files.
  The CSV keeps:
  - `video_status`
  - `render_batch`
  - `background_ready`
  - `song_dir`
  - `source_url`
  Song resource directory names normalize filesystem-sensitive characters and also replace commas with `-` to avoid queue parsing issues.

- `npm run refresh:cookies`
  Try to export reusable YouTube browser cookies into:
  `artifacts/common/youtube-cookies.txt`
  Future download steps will reuse this file automatically when it exists.

- `npm run generate:background:current`
  Regenerate the current song's background prompt, poetry frame, and ComfyUI workflow, then submit it to the local ComfyUI API if it is available.

- `npm run generate:backgrounds`
  Read `artifacts/common/production-queue.csv` and generate background images only for rows where:
  - `background_ready = false`
  This command uses the local ComfyUI API on:
  `http://127.0.0.1:8000`
  If the API is unavailable, the command still refreshes each song's prompt / poetry / workflow files but will stop before image generation.

- `npm run apply:manual-lyrics -- "<song-folder-name>"`
  If a song folder contains `lyrics.manual.txt`, use that file as the preferred lyric source, realign it against the song audio, overwrite `lyrics.json`, refresh `alignedLRC.json`, regenerate background prompt / poetry / workflow assets, and refresh `render-input.json`.
  Manual lyrics can include per-line start anchors with:
  `Lyric text || mm:ss.xx`
  You only need anchors on lines that are audibly wrong.
  Songs with no reliable LRC, mismatched lyric source, duet/bridge issues, or manually supplied lyrics should use this path.
  The audio alignment step no longer invents missing lyric timings with mathematical interpolation; lines must be backed by downloaded LRC timing, a manual anchor, or model matching.

- `npm run render:queue -- [batch-value]`
  Read `artifacts/common/production-queue.csv` and render only rows where:
  - `video_status = pending`
  - `render_batch = 0` by default, or the provided batch value
  - `background_ready = true`
  Rendered MP4s keep the full song in web preview, but video export starts a few seconds before the first detected vocal so long intros do not dominate the final video.

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
