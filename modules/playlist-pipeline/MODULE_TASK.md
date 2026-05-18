# playlist-pipeline module task

## Task Type
Implementation

## Goal
Given one playlist URL, complete every preparation step except final MP4 rendering, then register each prepared song into the render queue CSV.

## Scope

- accept one YouTube playlist URL
- resolve playlist entries into individual watch URLs
- run the single-song pipeline for each entry
- extract `audio-features.json` for each prepared song
- register each song in `artifacts/common/render-queue.csv`
- do not render MP4 in this step

## Public interface

- `run_playlist_pipeline(playlist_url, project_root, default_render_batch="")`

## Output

- prepared song folders under `artifacts/songs/`
- `audio-features.json` for each prepared song
- `artifacts/common/render-queue.csv`
