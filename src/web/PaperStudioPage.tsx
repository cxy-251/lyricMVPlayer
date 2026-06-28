import React, {useEffect, useMemo, useState} from "react";
import {Link} from "react-router";
import {Player} from "@remotion/player";
import {FileText, Home, Info} from "lucide-react";
import type {BackgroundEffectId, RenderManifest} from "@paper-to-video/shared-types";

import {PaperListDrawer} from "./components/PaperListDrawer";
import type {PaperItem} from "./components/PaperListDrawer";
import {PaperInfoDrawer} from "./components/PaperInfoDrawer";
import type {PaperEffectOption} from "./components/PaperInfoDrawer";

import demoPaperManifest from "../../packages/paper-video/data/manifests/demo-paper.render.json";
import {PaperVideo} from "@paper-to-video/components";

declare const __LATEST_RUN_FILE__: string;
declare const __PROJECT_ROOT__: string;

type PaperLibraryEntry = {
  id: string;
  label: string;
  title: string;
  source: string;
  renderManifestPath: string;
};

type PaperEffectSelection = "manifest" | BackgroundEffectId;

const paperEffectOptions: PaperEffectOption[] = [
  {id: "manifest", label: "Manifest Default", description: "Use the effect stored in each scene."},
  {id: "cellular-life", label: "Cellular Life", description: "WebGL life-grid motion layer."},
  {id: "snake-grid", label: "Snake Grid", description: "Arcade grid path motion."},
  {id: "particle-orbit", label: "Particle Orbit", description: "Central particle field."},
  {id: "donut-spin", label: "Donut Spin", description: "Rotating 3D anchor object."},
  {id: "lights-beams", label: "Lights Beams", description: "Cinematic beam field."},
  {id: "rubiks-auto-solve", label: "Rubiks Auto Solve", description: "Procedural cube motion."},
  {id: "aurora", label: "Aurora", description: "Soft gradient atmosphere."},
  {id: "grid-drift", label: "Grid Drift", description: "Lightweight technical grid."},
  {id: "noise-bloom", label: "Noise Bloom", description: "Subtle glowing noise layer."},
  {id: "none", label: "None", description: "Disable scene effects."},
];

const getFileName = (filePath: string | undefined) => filePath?.split("/").pop() ?? "missing file path";

const getUniqueValues = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const fetchJson = async <T,>(absolutePath: string): Promise<T> => {
  const response = await fetch(`/@fs${absolutePath}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${absolutePath}: ${response.status}`);
  }

  return (await response.json()) as T;
};

const fetchPublicJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }

  return (await response.json()) as T;
};

const normalizeManifestPaths = (manifest: RenderManifest): RenderManifest => {
  const currentOutputRoot = `${__PROJECT_ROOT__}/artifacts/paper-video/output`;
  const artifactSuffix = "/artifacts/paper-video/output";
  
  const rewrite = (value: unknown): unknown => {
    if (typeof value === "string") {
      const index = value.indexOf(artifactSuffix);
      if (index >= 0) {
        return currentOutputRoot + value.slice(index + artifactSuffix.length);
      }
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(rewrite);
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, nextValue]) => [key, rewrite(nextValue)]));
    }
    return value;
  };

  return rewrite(manifest) as RenderManifest;
};

const getInitialPaperId = () => {
  const pathname = window.location.pathname;
  const parts = pathname.split("/").filter(Boolean);
  const papersIndex = parts.indexOf("papers");
  const routePaperId = papersIndex >= 0 ? parts[papersIndex + 1] : null;
  if (routePaperId) {
    return routePaperId;
  }

  return pathname.includes("latest") ? "latest" : "demo";
};

const useLatestRun = () => {
  const [latestManifest, setLatestManifest] = useState<RenderManifest | null>(null);
  useEffect(() => {
    let cancelled = false;
    const loadLatest = async () => {
      try {
        const latestRun = await fetchJson<{renderManifestPath: string}>(__LATEST_RUN_FILE__);
        const manifest = normalizeManifestPaths(await fetchJson<RenderManifest>(latestRun.renderManifestPath));
        if (!cancelled) setLatestManifest(manifest);
      } catch {
        if (!cancelled) setLatestManifest(null);
      }
    };
    void loadLatest();
    return () => { cancelled = true; };
  }, []);
  return latestManifest;
};

const usePaperLibrary = () => {
  const [artifactPapers, setArtifactPapers] = useState<PaperItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    const loadPaperLibrary = async () => {
      try {
        const library = await fetchPublicJson<{papers: PaperLibraryEntry[]}>("/paper-library.json");
        const manifests = await Promise.all(
          library.papers.slice(0, 80).map(async (paper) => {
            const manifest = normalizeManifestPaths(await fetchJson<RenderManifest>(paper.renderManifestPath));
            return {
              id: paper.id,
              label: paper.label,
              source: paper.source,
              manifest,
            } satisfies PaperItem;
          })
        );
        if (!cancelled) setArtifactPapers(manifests);
      } catch {
        if (!cancelled) setArtifactPapers([]);
      }
    };
    void loadPaperLibrary();
    return () => { cancelled = true; };
  }, []);
  return artifactPapers;
};

export const PaperStudioPage: React.FC = () => {
  const [selectedPaperId, setSelectedPaperId] = useState(getInitialPaperId);
  const [selectedEffectId, setSelectedEffectId] = useState<PaperEffectSelection>("manifest");
  const [paperListOpen, setPaperListOpen] = useState(false);
  const [paperInfoOpen, setPaperInfoOpen] = useState(false);
  const latestManifest = useLatestRun();
  const artifactPapers = usePaperLibrary();

  const papers = useMemo<PaperItem[]>(() => {
    const byId = new Map<string, PaperItem>();
    const addPaper = (item: PaperItem) => {
      byId.set(item.id, item);
    };

    addPaper(
      {
        id: "demo",
        label: "Repository Demo",
        source: "modules/paper-video/data/manifests/demo-paper.render.json",
        manifest: normalizeManifestPaths(demoPaperManifest as RenderManifest),
      },
    );

    if (latestManifest) {
      addPaper({
        id: "latest",
        label: "Latest Run",
        source: "artifacts/paper-video/output/latest-run.json",
        manifest: latestManifest,
      });
    }

    artifactPapers.forEach(addPaper);
    return Array.from(byId.values());
  }, [artifactPapers, latestManifest]);

  const selectedPaper = papers.find((paper) => paper.id === selectedPaperId) ?? papers[0];
  const previewManifest = useMemo<RenderManifest>(() => {
    if (selectedEffectId === "manifest") {
      return selectedPaper.manifest;
    }

    return {
      ...selectedPaper.manifest,
      scenes: selectedPaper.manifest.scenes.map((scene) => ({
        ...scene,
        backgroundEffectId: selectedEffectId,
      })),
    };
  }, [selectedEffectId, selectedPaper.manifest]);
  const scenes = previewManifest.scenes;
  const effectLabelsById = useMemo(
    () => new Map(paperEffectOptions.map((effect) => [effect.id, effect.label])),
    [],
  );
  const selectedEffectLabel = effectLabelsById.get(selectedEffectId) ?? selectedEffectId;
  const manifestEffectIds = getUniqueValues(scenes.map((scene) => scene.backgroundEffectId));
  const layoutIds = getUniqueValues(scenes.map((scene) => scene.backgroundImageLayoutId));
  const subtitleCountByScene = useMemo(() => {
    const counts = new Map<string, number>();
    previewManifest.subtitleSegments.forEach((segment) => {
      counts.set(segment.sceneId, (counts.get(segment.sceneId) ?? 0) + 1);
    });
    return counts;
  }, [previewManifest.subtitleSegments]);
  const audioCountByScene = useMemo(() => {
    const counts = new Map<string, number>();
    previewManifest.audioAssets.forEach((asset) => {
      counts.set(asset.sceneId, (counts.get(asset.sceneId) ?? 0) + 1);
    });
    return counts;
  }, [previewManifest.audioAssets]);

  const selectPaper = (paperId: string) => {
    setSelectedPaperId(paperId);
    setPaperListOpen(false);
    window.history.pushState({}, "", `/studio/papers/${paperId}`);
  };

  return (
    <main className="paper-studio">
      <section className="paper-studio__stage">
        <div className="paper-studio__phone">
          <div className="paper-studio__toolbar">
            <Link className="paper-studio__back" to="/studio" aria-label="Open studio home" title="Home">
              <Home size={15} strokeWidth={1.9} />
            </Link>
            <button
              className="paper-studio__drawer-button"
              onClick={() => {
                setPaperListOpen(true);
                setPaperInfoOpen(false);
              }}
              type="button"
              aria-label="Open paper list"
              title="Papers"
            >
              <FileText size={16} strokeWidth={1.8} />
            </button>
            <button
              className="paper-studio__info-button"
              onClick={() => {
                setPaperInfoOpen(true);
                setPaperListOpen(false);
              }}
              type="button"
              aria-label="Open paper information"
              title="Info"
            >
              <Info size={16} strokeWidth={1.8} />
            </button>
          </div>
          <Player
            autoPlay={false}
            component={PaperVideo}
            compositionHeight={previewManifest.height}
            compositionWidth={previewManifest.width}
            controls
            clickToPlay={false}
            durationInFrames={previewManifest.totalFrames}
            fps={previewManifest.fps}
            inputProps={{manifest: previewManifest}}
            key={`${selectedPaper.id}:${selectedEffectId}`}
            loop={false}
            style={{width: "100%", height: "100%", backgroundColor: "#050a10"}}
          />
        </div>
      </section>

      {paperListOpen ? (
        <PaperListDrawer
          onClose={() => setPaperListOpen(false)}
          onSelect={selectPaper}
          papers={papers}
          selectedPaper={selectedPaper}
        />
      ) : null}

      {paperInfoOpen ? (
        <PaperInfoDrawer
          audioCountByScene={audioCountByScene}
          getFileName={getFileName}
          layoutIds={layoutIds}
          manifestEffectIds={manifestEffectIds}
          onClose={() => setPaperInfoOpen(false)}
          onSelectEffect={(id) => setSelectedEffectId(id as PaperEffectSelection)}
          paperEffectOptions={paperEffectOptions}
          previewManifest={previewManifest}
          scenes={scenes}
          selectedEffectId={selectedEffectId}
          selectedEffectLabel={selectedEffectLabel}
          selectedPaper={selectedPaper}
          subtitleCountByScene={subtitleCountByScene}
        />
      ) : null}
    </main>
  );
};
