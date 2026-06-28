import React, {lazy, Suspense} from "react";
import {createBrowserRouter} from "react-router";

import {LyricDataLayout, useLyricData} from "./LyricDataLayout";
import {LyricPlayerPage} from "./LyricPlayerPage";
import {StudioHomePage} from "./StudioHomePage"; // direct import — too small to lazy-load

// ─── Lazy page imports ────────────────────────────────────────────────────────

const EffectLabPage = lazy(() =>
  import("@lyric-mv/web3dlab").then((m) => ({
    default: m.EffectLabPage,
  })),
);

const PaperStudioPage = lazy(() =>
  import("./PaperStudioPage").then((m) => ({default: m.PaperStudioPage})),
);

// ─── Route wrapper components ─────────────────────────────────────────────────

const EffectLabRoute: React.FC = () => {
  const [song, setSong] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const loadSong = async () => {
      try {
        const manifestResponse = await fetch("/library-manifest.json");
        if (!manifestResponse.ok) throw new Error("Failed to load manifest");
        const manifest = await manifestResponse.json();
        
        const initialManifestSong =
          manifest.songs.find((s: any) => s.id === manifest.currentSongDirName) ?? manifest.songs[0];
          
        if (!initialManifestSong) throw new Error("No songs available");

        const [renderInput, audioFeatures] = await Promise.all([
          fetch(initialManifestSong.renderInputUrl).then(r => r.json()),
          fetch(initialManifestSong.audioFeaturesUrl).then(r => r.json())
        ]);

        if (!cancelled) {
          setSong({
            id: initialManifestSong.id,
            title: renderInput.title,
            artist: renderInput.artist,
            audioSrc: renderInput.audioSrc,
            audioFeatures: audioFeatures,
            fps: renderInput.fps,
            durationInFrames: renderInput.durationInFrames,
          });
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    };
    void loadSong();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return <div className="web-route-status">Failed to load lab song: {error}</div>;
  }

  if (!song) {
    return <div className="web-route-status">Loading effect lab resources...</div>;
  }

  return (
    <Suspense fallback={<div className="web-route-status">Loading effect lab...</div>}>
      <EffectLabPage song={song} />
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
    ],
  },

  // Effect lab — current paths
  {
    path: "/studio/effects",
    element: <EffectLabRoute />,
  },
  {
    path: "/studio/effects/*",
    element: <EffectLabRoute />,
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
]);
