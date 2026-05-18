# render-queue module task

## Task Type
Implementation

## Goal
Maintain one CSV control file that decides which prepared song folders should be rendered into MP4 outputs.

## Scope

- keep one CSV file in `artifacts/common/`
- use first column for video status
- use one column for render batch
- use last column for song resource folder name
- support queue creation, row upsert, runnable row selection, and status updates

## Public interface

- `get_render_queue_csv_path(project_root)`
- `ensure_render_queue_csv(project_root)`
- `upsert_render_queue_row(project_root, row)`
- `list_runnable_rows(project_root, batch_value="0")`
- `mark_render_status(project_root, song_dir_name, status)`

## Output

- `artifacts/common/render-queue.csv`
