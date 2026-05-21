# Maintenance Backlog

Updated: 2026-05-21

## Open

- Cloudflare Pages deployed layout missing HUD styling
  - Status: `fixed in code, pending redeploy verification`
  - Problem: the deployed site rendered DOM content but looked unstyled and collapsed into the upper-left because the production Tailwind pipeline did not emit the utility classes used by `render-core`.
  - Fix: added a proper PostCSS Tailwind pipeline via `postcss.config.mjs` and included `src/web/**/*.{ts,tsx}` in the Tailwind source scan so web/player utility classes are emitted into `dist/assets/*.css`.
  - Next step: verify the next Pages deploy visually matches the local web build.

- `Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY`
  - Status: `investigating`
  - Problem: the manual-lyrics alignment is much better than before, but the bridge/tail section after `Lost but so found` still starts too early. Continuous filler lines like `Ah` no longer collapse the tail, but they still do not express long instrumental timing accurately enough on their own.
  - Next step: support stronger manual timing hints for difficult songs, preferably manual LRC timestamps or explicit gap markers, instead of relying on filler-word interpolation alone.

- `render_batch == 1` lyric-review queue
  - Status: `analyzed`
  - Songs currently marked for review:
    - `Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY`
    - `Just the Way You Are - Bruno Mars - GnUW4AF1LZo`
    - `We Don't Talk Anymore (feat. Selena Gomez) - Charlie Puth - yN6JgL0IUJg`
  - Findings:
    - `Run Wild` still has a structural timing issue around the early bridge: a large gap remains between `Da da dum...` and `Shoes in my hand...`, which matches the user's report that the bridge timing is still unstable.
    - `Just the Way You Are` currently shows no structural missing-line, overlap, or large-gap issues in the diagnostic heuristic; if it still feels off, it is more likely a fine-grained line-boundary issue than a broken lyric source.
    - `We Don't Talk Anymore` also shows no structural missing-line, overlap, or large-gap issues in the current heuristic; if it feels off, the next place to inspect is duet/alternating-vocal boundary placement rather than source completeness.

- Web deploy bundle size
  - Status: `improving`
  - Problem: the original Vite web build bundled the entire preview library into a 42 MiB JS chunk, which exceeded Cloudflare Pages' 25 MiB per-file limit.
  - Progress: the web app now fetches a generated static manifest plus per-song JSON/audio/background assets at runtime, and it only eagerly loads the current song before caching remaining songs one-by-one in the background.
  - Progress update: the web app now also prioritizes the current song's immediate neighbors, prefetching the next/previous song metadata plus audio/background assets before continuing with low-priority sequential background caching.
  - Progress update: the website now shows a splash overlay that uses the first song's dynamic `poetryFrame.bottomLine` and only fades out after the first background image is actually loaded, which hides the heaviest initial media delay.
  - Next step: if the library keeps growing, move from serial background caching toward true on-demand fetch for selected songs and nearby neighbors only.

## Resolved Recently

- Library-state default playlists
  - Removed the hardcoded fallback playlists `Night Drive`, `City Echoes`, `Neon Pulse`, `Soft Pages`, and `Afterglow`.
  - The app now only seeds custom playlists with:
    - `new-downloads`
    - `alignment-error`
  - System playlists remain:
    - `All Songs`
    - `Liked Songs`
  - Default `selectedPlaylistId` is now `new-downloads`.

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
