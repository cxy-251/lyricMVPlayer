# background-generation module task

## Task Type
Implementation

## Goal
Generate subjectless illustration background prompts for a renderable song item and prepare them for ComfyUI execution.

## Module location

- code: `modules/background-generation/background_generation.py`
- module task: `modules/background-generation/MODULE_TASK.md`

## Scope

- analyze song metadata and timed lyrics
- infer mood and scene direction
- generate subjectless illustration prompts
- save prompt files into the song directory
- prepare prompt payloads for later ComfyUI execution

## Non-goals

- direct ComfyUI execution in this task
- final background image selection
- animated background rendering

## Public interface

- `BackgroundPromptContext`
- `BackgroundPromptPackage`
- `build_background_prompt_package(context)`
- `save_background_prompt_package(package, context)`
- `ComfyUIWorkflowPackage`
- `build_comfyui_workflow_package(package, context)`
- `save_comfyui_workflow_package(package, context)`
- `import_latest_comfy_background(context, comfy_output_root=None)`

## Acceptance target

- one song can produce a reusable background prompt package
- prompt output is saved inside the same song folder as audio and lyrics
- prompt direction avoids human figures and focuses on subjectless illustration backgrounds
- a ComfyUI workflow JSON can be exported for manual import and execution
- generated background images can be copied back from ComfyUI output into the song folder
