# single-song-pipeline module task

## Task Type
Implementation

## Goal
Compose the current MVP ingestion modules into one real single-song runner.

## Module location

- code: `modules/single-song-pipeline/single_song_pipeline.py`
- module task: `modules/single-song-pipeline/MODULE_TASK.md`

## Scope

- accept one YouTube URL
- call source-ingestion
- call audio-download
- call lyrics resolution
- call background-generation prompt packaging
- call video-render input preparation
- persist timed lyrics, background prompt files, render input, and pipeline result summary

## Non-goals

- playlist orchestration
- background generation
- remotion rendering
- batch scheduling

## Public interface

- `run_single_song_pipeline(input_url, project_root)`
- `save_pipeline_result(result, project_root)`
- `sync_generated_background(song_dir, project_root, comfy_output_root=None)`

## Acceptance target

- one URL can produce a combined machine-readable result
- successful runs persist timed lyrics and summary output
- failures are explicit and do not require reading raw stack traces
