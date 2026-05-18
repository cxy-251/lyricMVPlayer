# video-render module task

## Task Type
Implementation

## Goal
Render a final lyric video from prepared media, lyric timing, and visual assets.

## Output naming rule

- final MP4 filename should include `song title - artist`
- example: `Never Gonna Give You Up - Rick Astley.mp4`

## Public interface

- `RenderJobInput`
- `build_render_job_input(song_dir, fps=30)`
- `save_render_job_input(job)`
- `refresh_render_job_input(song_dir, fps=30)`
- render result output
