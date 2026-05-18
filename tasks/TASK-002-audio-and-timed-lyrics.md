# Task 002: audio and timed lyrics acquisition

## Task Type
Implementation

## Goal
Build the first real data-ingestion slice: fetch audio from YouTube and obtain timed lyrics without manual synchronization.

## Background
The render-core module is not the MVP bottleneck. The real production constraint is obtaining reusable audio plus timed lyrics in a stable, unattended way. This task starts the non-mock pipeline.

## Scope

- normalize a single YouTube song URL
- download audio with `yt-dlp`
- persist a stable source identity for duplicate prevention
- build a timed lyric resolution strategy with ordered fallbacks
- normalize accepted lyric results into one internal timed lyric format

## Non-goals

- playlist expansion
- background generation
- Remotion rendering
- manual lyric cleanup workflows

## Affected modules

- `modules/source-ingestion`
- `modules/audio-download`
- `modules/lyrics`
- `modules/history-dedupe`

## Timed lyric strategy

1. Try source-provided subtitles or captions first.
2. If unavailable, try YouTube Music timed lyrics.
3. If unavailable, try an external synced lyric source.
4. If unavailable, fall back to automatic transcription plus forced alignment.
5. If quality is below threshold, skip the song instead of asking for manual intervention.

## Requirements

- no mock lyric data
- no manual sync step
- duplicate audio downloads must be prevented using stable source identity
- every lyric result must record its provenance
- every failure must be machine-readable

## Acceptance criteria

- one YouTube URL can produce a downloaded audio file and metadata
- repeated runs for the same source can skip audio download
- timed lyric lookup follows deterministic fallback order
- accepted timed lyrics are normalized into one internal format
- the module can fail closed when lyrics are unavailable or low-confidence

## Validation steps

- test a URL with available captions or timed lyrics
- test a repeated run of the same URL and confirm duplicate skip behavior
- test a URL without direct timed lyrics and confirm fallback path is used
- inspect stored metadata and confirm lyric provenance is recorded

## Notes / Risks

- fully unattended lyric timing is realistic, but not every song will succeed
- the stable approach is fallback plus quality gating, not assuming one provider is always enough
