# Maintenance Backlog

Updated: 2026-05-21

## Open

- `Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY`
  - Status: `investigating`
  - Problem: the manual-lyrics alignment is much better than before, but the bridge/tail section after `Lost but so found` still starts too early. Continuous filler lines like `Ah` no longer collapse the tail, but they still do not express long instrumental timing accurately enough on their own.
  - Next step: support stronger manual timing hints for difficult songs, preferably manual LRC timestamps or explicit gap markers, instead of relying on filler-word interpolation alone.

- Web deploy bundle size
  - Status: `observing`
  - Problem: the new Vite web build works, but all song audio and background assets are currently bundled into the deploy output, which will make Cloudflare deploys grow quickly as the library expands.
  - Next step: move from fully bundled preview assets toward a manifest + external/static asset serving strategy so the site can scale without enormous JS and asset payloads.

## Resolved Recently

- Playlist membership toggle
  - Fixed `Add to Playlist` so clicking a playlist now toggles membership for the current song instead of only adding tracks. `Liked Songs` now also toggles on/off from the same panel.

- Web build pipeline
  - Added a Vite-based web player build with:
    - `npm run dev:web`
    - `npm run build:web`
  - Cloudflare Pages can now use `npm run build:web` with `dist/` as the output directory.

- Preview library loading
  - Replaced the oversized generated `preview-composition-props.ts` approach with a manifest-based structure:
    - `src/remotion/preview-library-manifest.json`
    - `src/remotion/preview-asset-map.ts`
    - a much smaller generated `preview-composition-props.ts`

- Background writeback after ComfyUI generation
  - Fixed by preferring ComfyUI history/API recovery and making output import tolerant of folder-name changes.

- `production-queue.csv` source URLs missing for newly prepared songs
  - Fixed by backfilling `source_url` from each song's `source.json` when queue rows are normalized.

- Manual lyrics should not delete existing backgrounds
  - Fixed by preserving `background.png/jpg/jpeg/webp` when `apply:manual-lyrics` reruns.

- Browser playlist/likes state not persisting to `artifacts/common/library-state.json`
  - Fixed by adding a local sync service on port `3210` and wiring player actions to write through it.
