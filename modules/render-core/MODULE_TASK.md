# render-core module task

## Task Type
Implementation

## Goal
Create the minimum render-core skeleton for a Remotion-based lyric video composition.

## Module location

- code: `modules/render-core/src/`
- module task: `modules/render-core/MODULE_TASK.md`
- top-level integration entry: `src/remotion/Root.tsx`

## Scope

- define the base composition input contract
- define the render root registration
- define one previewable lyric video composition
- connect one real `render-input.json` into Remotion preview
- add a first music-player-style shell with queue controls and playlist drawer
- add a first lightweight particle layer
- support lyric-wheel scrubbing and smoother lyric panel motion
- account for short-video safe margins and edge microcopy
- keep the composition structure easy to extend

## Non-goals

- real audio downloading
- real lyric fetching
- background generation
- final production styling
- WebGL particle implementation

## Public interface

- `LyricVideoCompositionProps`
- `validateCompositionProps(props)`
- `sampleCompositionProps`
- `MusicVideoComposition`

## Validation target

- code structure is understandable
- contracts are reusable by later modules
- the composition can preview one real song package
- lyrics, player motion, queue controls, and particles are visible in UI
- scrubbing the lyric area changes playback time during preview
- invalid composition input can be rejected deterministically
