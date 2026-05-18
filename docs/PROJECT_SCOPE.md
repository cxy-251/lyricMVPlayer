# PROJECT_SCOPE.md

## Project goal

Build an automated pipeline that can turn song inputs into lyric-player-style videos with generated visuals and rendered MP4 output.

## Current phase

- Phase: MVP definition and project setup
- Status: First render module exists, but source acquisition has not started
- Focus: build the first non-mock acquisition slice for audio and timed lyrics

## MVP target

The first MVP should prove one complete vertical slice:

1. accept a single song URL
2. download audio
3. obtain timed lyrics or aligned lyric timing without manual sync
4. generate one background visual
5. render one lyric video output

The MVP does not need to solve full batch automation, trend ingestion, or advanced visual variety yet.

## Core users

- Project owner
- Agent or developer implementing the pipeline
- Future collaborators who need to understand pipeline stages quickly

## In scope for MVP

- Single-song input flow
- Audio download
- Automatic timed lyric acquisition and fallback alignment path
- One background-generation path through ComfyUI
- One render path through Remotion
- One output video per successful run
- Basic skip/error visibility

## Out of scope for MVP

- Trending-source ingestion
- Full playlist scaling and scheduling
- Advanced multi-template rendering
- Rich dashboard or management UI
- Complex asset reuse and caching strategies
- Full quality scoring and automatic aesthetic selection

## Success criteria

The MVP is successful when:

- one song can go from URL to final rendered video
- the lyric path does not require manual timing intervention
- the pipeline is reproducible
- failures are visible and understandable
- the project structure remains simple enough to extend
