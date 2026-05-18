# source-ingestion module task

## Task Type
Implementation

## Goal
Normalize song source input into a consistent internal format before downloading or lyric lookup.

## Module location

- code: `modules/source-ingestion/source_ingestion.py`
- module task: `modules/source-ingestion/MODULE_TASK.md`

## Scope

- accept a single YouTube URL as MVP input
- parse and normalize source identity
- extract stable identifiers for downstream modules
- expose a source record that later modules can consume without URL-specific logic

## Non-goals

- downloading media
- fetching lyrics
- playlist expansion
- rendering

## Public interface

- `NormalizedSourceRecord`
- `normalize_source_input(input)`
- `get_source_identity(record)`

## Acceptance target

- one valid YouTube URL becomes one normalized source record
- invalid input is rejected clearly
- downstream modules do not need to parse raw URLs themselves
- source identity is stable enough for dedupe and storage keys
