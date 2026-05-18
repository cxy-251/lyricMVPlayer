# TASK_TEMPLATE.md

Use this template before starting implementation work.

## Allowed Task Type values

- `Diagnosis` - analysis only, no code changes
- `Implementation` - implement within an explicitly defined scope

## Task template

```md
# Task

## Task Type
Diagnosis | Implementation

## Goal
What result is needed?

## Background
What context from the project or requirements document matters here?

## Scope
What is included in this task?

## Non-goals
What must not be done in this task?

## Affected files
Which files or directories are expected to be read or changed?

## Requirements
What rules, constraints, or expected behaviors must be followed?

## Acceptance criteria
How do we know the task is complete?

## Validation steps
How should the result be checked?

## Notes / Risks
What uncertainties or failure risks should be recorded?
```

## Usage notes

- Use `Diagnosis` when the goal is understanding or evaluation only.
- Use `Implementation` only when the slice is narrow enough to build safely.
- Prefer tasks that correspond to one pipeline stage or one vertical slice.
