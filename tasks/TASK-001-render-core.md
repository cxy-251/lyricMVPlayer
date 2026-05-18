# Task 001: render-core

## Task Type
Implementation

## Goal
Build the first reusable rendering module for the project and expose a stable input contract for later modules.

## Background
The project needs a minimal vertical slice before integrating downloading, lyrics, backgrounds, and final rendering. The first module should prove that the rendering layer can accept structured inputs and produce a valid composition shape.

## Scope

- create the render-core public types
- create the render-core validation entrypoint
- create the minimal Remotion composition root
- create a sample composition payload for local development
- document the module boundary and public interface

## Non-goals

- YouTube ingestion
- audio downloading
- automatic lyric alignment
- ComfyUI integration
- final design polish

## Affected files

- `modules/render-core/MODULE_TASK.md`
- `modules/render-core/src/*`
- `src/remotion/*`

## Requirements

- module must expose a reusable public API
- module must be understandable without reading unrelated code
- module must be testable through deterministic input validation
- composition props must be strict enough for later modules to build against

## Acceptance criteria

- `render-core` has a documented public interface
- `render-core` exports reusable types
- `render-core` exports a validation function for composition props
- Remotion root registers one working composition shape
- later modules can depend on the render-core contract without importing UI internals

## Validation steps

- inspect the module task doc and confirm public API is explicit
- inspect `modules/render-core/src/index.ts` and confirm only public exports are exposed
- inspect `modules/render-core/src/validate-composition.ts` and confirm prop validation is deterministic
- inspect `src/remotion/Root.tsx` and confirm one composition is registered

## Notes / Risks

- the current composition is intentionally minimal
- later modules should consume `render-core` through its public exports only
