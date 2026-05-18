# audio-download module task

## Task Type
Implementation

## Goal
Download audio and source metadata with `yt-dlp`, while preventing duplicate downloads for the same source identity.

## Module location

- code: `modules/audio-download/audio_download.py`
- module task: `modules/audio-download/MODULE_TASK.md`

## Scope

- accept normalized source records
- use `yt-dlp` for audio download
- persist source metadata needed for later lyric lookup
- record downloaded source identity so repeated runs can skip already-downloaded audio

## Non-goals

- lyric fetching
- lyric alignment
- final video rendering
- playlist scheduling

## Public interface

- `DownloadedAudioRecord`
- `download_audio(record, config)`
- `has_downloaded_audio(record, archive_path)`
- `record_downloaded_audio(config, metadata)`

## Acceptance target

- same source is not downloaded twice when identity already exists
- successful download returns audio path and normalized metadata
- failed download is visible without corrupting history
- source metadata is persisted for later lyric lookup
