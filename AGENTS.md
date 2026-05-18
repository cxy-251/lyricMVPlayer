# AGENTS.md

This file defines the highest-priority project rules for Codex and other coding agents working in `lyricMVPlayer`.

## Operating rules

1. Read `AGENTS.md` first, then read only the documents needed for the current task.
2. Do not read every project document by default.
3. Before changing complex logic, explain the relevant current flow first.
4. Make the minimum safe change needed for the task.
5. Do not rewrite unrelated code.
6. Do not add dependencies unless you first explain why they are needed and receive approval.
7. Do not change public interfaces, data formats, or directory structure unless the task explicitly requires it.
8. If blocked, stop and explain the blocker instead of making repeated blind edits.
9. After every completed task, provide validation steps.
10. If project behavior, structure, or scope changes, update the related docs.
11. Write documentation for people who may not fully understand the implementation.
12. When moving or replacing code, remove obsolete empty files and empty directories in the same task.

## Project-specific rules

- This project is a production pipeline, not just a frontend app.
- Prefer building the system in vertical slices that can be run end-to-end.
- Do not implement future-stage features before MVP scope is stable.
- Keep automation observable: outputs, errors, and skips must be inspectable.
- When a song fails, the system should prefer skip-and-continue behavior over full pipeline failure unless the task explicitly requires otherwise.

## Current state

- The repository currently begins with a requirements document and lightweight control files.
- Business implementation has not started yet.
- The next step is to convert the large requirements document into an MVP execution plan.
