# background-generation module task

## Task Type
Implementation

## Goal
Maintain two separate visual-production stages for renderable song items: local-LLM visual planning and ComfyUI image generation.

## Module location

- code: `modules/background-generation/background_generation.py`
- module task: `modules/background-generation/MODULE_TASK.md`

## Scope

- analyze song metadata and timed lyrics
- infer mood and scene direction
- generate subjectless illustration prompts, poetry-frame text, fourteen-line poem text, and workflow JSON through the local LLM server
- pass the cleaned full lyric sequence to the local LLM instead of a representative excerpt
- save prompt files into the song directory
- submit existing workflow JSON files to ComfyUI for selectable render batches
- refresh render-input and web-public manifests after visual assets change

## Non-goals

- final background image selection
- animated background rendering
- calling the local LLM while generating images from already prepared workflows

## Public interface

- `BackgroundPromptContext`
- `BackgroundPromptPackage`
- `require_local_llm_available()`
- `build_background_prompt_package(context)`
- `save_background_prompt_package(package, context)`
- `ComfyUIWorkflowPackage`
- `build_comfyui_workflow_package(package, context)`
- `save_comfyui_workflow_package(package, context)`
- `generate_background_for_song(song_dir, project_root, ...)`
- `refresh_song_background_assets(song_dir, require_llm=True)`
- `refresh_render_input_for_song(song_dir, project_root)`
- `import_latest_comfy_background(context, comfy_output_root=None)`

## Acceptance target

- one song can produce a reusable background prompt package
- local LLM unavailability is reported as a hard failure instead of silently using repeated fallback text
- local LLM lyric-understanding/workflow/text regeneration defaults to `render_batch=0`, with explicit batch selection for intentional rebuilds such as `render_batch=22`
- the LLM output includes a full-song reading, a visual metaphor, prompt focus, frame text, and exactly fourteen poem lines
- prompt output is saved inside the same song folder as audio and lyrics
- prompt direction avoids human figures and focuses on subjectless illustration backgrounds
- a ComfyUI workflow JSON can be exported by the planning stage and later submitted by the image stage
- generated background images can overwrite the song folder background asset and refresh `render-input.json`
