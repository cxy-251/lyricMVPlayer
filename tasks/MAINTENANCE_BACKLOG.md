# Maintenance Backlog

Updated: 2026-05-21

## Open

- `Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY`
  - Status: `investigating`
  - Problem: the manual-lyrics alignment is much better than before, but the bridge/tail section after `Lost but so found` still starts too early. The `Ah` filler block is now preserved as a gap marker, but the `Maybe I was made to fly` section still needs more accurate timing.
  - Next step: improve plain-text manual lyric alignment so repeated chorus tails preserve later stable anchors while filler sections interpolate to realistic durations.

- Preview library loading
  - Status: `planned`
  - Problem: `src/remotion/preview-composition-props.ts` is still generated as a large static import file. This works for the current library size, but should eventually move to a manifest-based loader as the song count grows.
  - Next step: replace static preview imports with a generated manifest JSON and runtime resolution layer.

## Resolved Recently

- Background writeback after ComfyUI generation
  - Fixed by preferring ComfyUI history/API recovery and making output import tolerant of folder-name changes.

- `production-queue.csv` source URLs missing for newly prepared songs
  - Fixed by backfilling `source_url` from each song's `source.json` when queue rows are normalized.

- Manual lyrics should not delete existing backgrounds
  - Fixed by preserving `background.png/jpg/jpeg/webp` when `apply:manual-lyrics` reruns.

- Browser playlist/likes state not persisting to `artifacts/common/library-state.json`
  - Fixed by adding a local sync service on port `3210` and wiring player actions to write through it.
