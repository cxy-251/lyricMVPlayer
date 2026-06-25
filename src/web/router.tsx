import React, {lazy, Suspense} from "react";
import {createBrowserRouter} from "react-router";

import {LyricDataLayout, useLyricData} from "./LyricDataLayout";
import {LyricPlayerPage} from "./LyricPlayerPage";
import {StudioHomePage} from "./StudioHomePage"; // direct import — too small to lazy-load

// ─── Lazy page imports ────────────────────────────────────────────────────────

const EffectLabPage = lazy(() =>
  import("../../modules/render-core/src/visual-effects/lab/EffectLabPage").then((m) => ({
    default: m.EffectLabPage,
  })),
);

const PaperStudioPage = lazy(() =>
  import("./PaperStudioPage").then((m) => ({default: m.PaperStudioPage})),
);

// ─── Route wrapper components ─────────────────────────────────────────────────

/**
 * Connects EffectLabPage to the lyric data loaded by LyricDataLayout.
 * Mirrors the original App.tsx behaviour: shows a loading state until the
 * selected song is ready, then passes a LabSong-compatible object to the page.
 */
const EffectLabRoute: React.FC = () => {
  const {props} = useLyricData();

  if (!props) {
    return <div className="web-route-status">Loading the selected lyric song...</div>;
  }

  return (
    <Suspense fallback={<div className="web-route-status">Loading effect lab...</div>}>
      <EffectLabPage
        song={{
          id: props.initialTrackId ?? props.title,
          title: props.title,
          artist: props.artist,
          audioSrc: props.audioSrc,
          audioFeatures: props.audioFeatures,
          fps: props.fps,
          durationInFrames: props.durationInFrames,
        }}
      />
    </Suspense>
  );
};

// ─── Shared fallback elements ─────────────────────────────────────────────────

const paperFallback = <div className="web-route-status">Loading paper player...</div>;

// ─── Route table ──────────────────────────────────────────────────────────────
//
// Hierarchy:
//
//   LyricDataLayout (pathless layout — loads lyric library, shares via context)
//   ├── /               → LyricPlayerPage
//   ├── /LyricsMusic    → LyricPlayerPage  (legacy alias)
//   ├── /studio/effects → EffectLabRoute   (current)
//   ├── /studio/effects/*                  (sub-paths)
//   ├── /effects        → EffectLabRoute   (legacy)
//   ├── /effects/*                         (legacy sub-paths)
//   └── /paper/effects/* → EffectLabRoute  (legacy)
//
//   /studio             → StudioHomePage
//
//   /studio/papers      → PaperStudioPage  (current)
//   /studio/papers/*                       (sub-paths)
//   /paper              → PaperStudioPage  (legacy)
//   /paper/*            → PaperStudioPage  (legacy; /paper/effects/* is more
//                                           specific and wins in the layout above)
//   /previews/*         → PaperStudioPage  (legacy)
//   /templates/*        → PaperStudioPage  (legacy)

export const router = createBrowserRouter([
  {
    // Pathless layout: loads lyric data and makes it available to child routes
    element: <LyricDataLayout />,
    children: [
      {path: "/", element: <LyricPlayerPage />},
      {path: "/LyricsMusic", element: <LyricPlayerPage />},

      // Effect lab — current paths
      {path: "/studio/effects", element: <EffectLabRoute />},
      {path: "/studio/effects/*", element: <EffectLabRoute />},

      // Effect lab — legacy paths
      {path: "/effects", element: <EffectLabRoute />},
      {path: "/effects/*", element: <EffectLabRoute />},
      {path: "/paper/effects/*", element: <EffectLabRoute />},
    ],
  },

  // Studio home (no lyric data needed — rendered synchronously, no Suspense)
  {
    path: "/studio",
    element: <StudioHomePage />,
  },

  // Paper player — current paths
  {
    path: "/studio/papers",
    element: <Suspense fallback={paperFallback}><PaperStudioPage /></Suspense>,
  },
  {
    path: "/studio/papers/*",
    element: <Suspense fallback={paperFallback}><PaperStudioPage /></Suspense>,
  },

  // Paper player — legacy paths
  {
    path: "/paper",
    element: <Suspense fallback={paperFallback}><PaperStudioPage /></Suspense>,
  },
  {
    path: "/paper/*",
    element: <Suspense fallback={paperFallback}><PaperStudioPage /></Suspense>,
  },
  {
    path: "/previews/*",
    element: <Suspense fallback={paperFallback}><PaperStudioPage /></Suspense>,
  },
  {
    path: "/templates/*",
    element: <Suspense fallback={paperFallback}><PaperStudioPage /></Suspense>,
  },
]);
