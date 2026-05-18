# lyrics module task

## Task Type
Implementation

## Goal
Produce normalized timed lyric data without requiring manual sync.

## Module location

- code: `modules/lyrics/lyrics.py`
- module task: `modules/lyrics/MODULE_TASK.md`

## Scope

- accept downloaded audio and normalized metadata
- prefer already-timed lyric sources
- normalize all successful lyric sources into one shared timed lyric format
- fall back to automatic alignment/transcription only when timed sources are unavailable
- emit quality and provenance metadata for downstream rendering

## Timed lyric acquisition order

1. source-provided subtitles or captions
2. YouTube Music timed lyrics
3. external synced lyric source
4. automatic transcription + forced alignment

## Non-goals

- manual lyric editing
- manual timing correction
- final subtitle styling

## Public interface

- `TimedLyricDocument`
- `resolve_timed_lyrics(input_data)`
- `score_timed_lyrics(document)`
- `should_accept_timed_lyrics(document)`
- `timed_lyrics_to_json(document)`

## Acceptance target

- module can return one normalized timed lyric document
- every accepted result includes source provenance
- every rejected result includes a machine-readable reason
- pipeline does not depend on human lyric timing work
