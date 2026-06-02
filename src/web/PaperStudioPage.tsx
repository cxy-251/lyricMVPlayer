import React, {useEffect, useMemo, useState} from "react";
import {Player} from "@remotion/player";
import {FileText, Home, Info} from "lucide-react";
import type {BackgroundEffectId, RenderManifest} from "@paper-to-video/shared-types";

import demoPaperManifest from "../../modules/paper-video/data/manifests/demo-paper.render.json";
import {PaperVideo} from "../../modules/render-core/src";
import {getVisualEffectDefinition, visualEffectRegistry} from "../../modules/render-core/src/visual-effects";
import type {VisualEffectId} from "../../modules/render-core/src/visual-effects";

declare const __LATEST_RUN_FILE__: string;
declare const __PROJECT_ROOT__: string;

type PaperItem = {
  id: string;
  label: string;
  source: string;
  manifest: RenderManifest;
};

type PaperLibraryEntry = {
  id: string;
  label: string;
  title: string;
  source: string;
  renderManifestPath: string;
};

type CreativePaperEffectSelection = `creative:${VisualEffectId}`;
type PaperEffectSelection = "manifest" | BackgroundEffectId | CreativePaperEffectSelection;

type PaperEffectOption = {
  description: string;
  id: PaperEffectSelection;
  label: string;
};

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
  ...(Object.keys(visualEffectRegistry) as VisualEffectId[]).map((effectId) => {
    const definition = getVisualEffectDefinition(effectId);
    return {
      id: `creative:${definition.id}` as const,
      label: definition.title,
      description: `3DLab · ${definition.description}`,
    };
  }),
];

const isCreativeEffectSelection = (effectId: PaperEffectSelection): effectId is CreativePaperEffectSelection =>
  effectId.startsWith("creative:");

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
  const oldOutputRoot = "/Users/cxy251/Code/02codeX/output";
  const currentOutputRoot = `${__PROJECT_ROOT__}/artifacts/paper-video/output`;
  const rewrite = (value: unknown): unknown => {
    if (typeof value === "string") {
      return value.startsWith(oldOutputRoot) ? value.replace(oldOutputRoot, currentOutputRoot) : value;
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

export const PaperStudioPage: React.FC = () => {
  const [selectedPaperId, setSelectedPaperId] = useState(getInitialPaperId);
  const [selectedEffectId, setSelectedEffectId] = useState<PaperEffectSelection>("manifest");
  const [paperListOpen, setPaperListOpen] = useState(false);
  const [paperInfoOpen, setPaperInfoOpen] = useState(false);
  const [latestManifest, setLatestManifest] = useState<RenderManifest | null>(null);
  const [artifactPapers, setArtifactPapers] = useState<PaperItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadLatest = async () => {
      try {
        const latestRun = await fetchJson<{renderManifestPath: string}>(__LATEST_RUN_FILE__);
        const manifest = normalizeManifestPaths(await fetchJson<RenderManifest>(latestRun.renderManifestPath));
        if (!cancelled) {
          setLatestManifest(manifest);
        }
      } catch {
        if (!cancelled) {
          setLatestManifest(null);
        }
      }
    };

    void loadLatest();

    return () => {
      cancelled = true;
    };
  }, []);

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
          }),
        );
        if (!cancelled) {
          setArtifactPapers(manifests);
        }
      } catch {
        if (!cancelled) {
          setArtifactPapers([]);
        }
      }
    };

    void loadPaperLibrary();

    return () => {
      cancelled = true;
    };
  }, []);

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
    if (selectedEffectId === "manifest" || isCreativeEffectSelection(selectedEffectId)) {
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
  const creativeEffect = useMemo(() => {
    if (!isCreativeEffectSelection(selectedEffectId)) {
      return undefined;
    }
    const effectId = selectedEffectId.replace("creative:", "") as VisualEffectId;
    return {
      id: effectId,
      config: getVisualEffectDefinition(effectId).defaultConfig,
    };
  }, [selectedEffectId]);
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
            <a className="paper-studio__back" href="/studio" aria-label="Open studio home" title="Home">
              <Home size={15} strokeWidth={1.9} />
            </a>
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
            durationInFrames={previewManifest.totalFrames}
            fps={previewManifest.fps}
            inputProps={{creativeEffect, manifest: previewManifest}}
            key={`${selectedPaper.id}:${selectedEffectId}`}
            loop={false}
            style={{width: "100%", height: "100%", backgroundColor: "#050a10"}}
          />
        </div>
      </section>

      {paperListOpen ? (
        <div className="paper-studio__drawer-layer">
          <button
            aria-label="Close paper list"
            className="paper-studio__scrim"
            onClick={() => setPaperListOpen(false)}
            type="button"
          />
          <aside className="paper-studio__rail">
            <div className="paper-studio__drawer-head">
              <div>
                <p className="paper-studio__kicker">Papers</p>
                <h1>Paper Player</h1>
              </div>
              <button
                aria-label="Close paper list"
                className="paper-studio__close"
                onClick={() => setPaperListOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <nav className="paper-studio__list" aria-label="Papers">
              {papers.map((paper) => (
                <button
                  aria-pressed={paper.id === selectedPaper.id}
                  key={paper.id}
                  onClick={() => selectPaper(paper.id)}
                  type="button"
                >
                  <span>{paper.label}</span>
                  <strong>{paper.manifest.paper.title}</strong>
                </button>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}

      {paperInfoOpen ? (
        <div className="paper-studio__drawer-layer paper-studio__drawer-layer--right">
          <button
            aria-label="Close paper information"
            className="paper-studio__scrim"
            onClick={() => setPaperInfoOpen(false)}
            type="button"
          />
          <aside className="paper-studio__meta">
            <div className="paper-studio__drawer-head">
              <p>{selectedPaper.source}</p>
              <button
                aria-label="Close paper information"
                className="paper-studio__close"
                onClick={() => setPaperInfoOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <h2>{previewManifest.paper.title}</h2>
            <div className="paper-studio__stats">
              <span>{scenes.length} scenes</span>
              <span>{(previewManifest.totalFrames / previewManifest.fps).toFixed(1)}s</span>
              <span>{previewManifest.theme.id}</span>
            </div>
            <section className="paper-studio__effect-section">
              <p className="paper-studio__kicker">Visual Effect</p>
              <div className="paper-studio__effect-list">
                {paperEffectOptions.map((effect) => (
                  <button
                    aria-pressed={effect.id === selectedEffectId}
                    key={effect.id}
                    onClick={() => setSelectedEffectId(effect.id)}
                    type="button"
                  >
                    <strong>{effect.label}</strong>
                    <span>{effect.description}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="paper-studio__asset-section">
              <p className="paper-studio__kicker">Assets</p>
              <div className="paper-studio__asset-grid">
                <div>
                  <span>Audio</span>
                  <strong>{previewManifest.audioAssets.length} files</strong>
                  <small>{previewManifest.audioAssets.map((asset) => getFileName(asset.filePath)).join(" · ")}</small>
                </div>
                <div>
                  <span>Subtitles</span>
                  <strong>{previewManifest.subtitleSegments.length} segments</strong>
                  <small>
                    {previewManifest.subtitleSegments.length > 0
                      ? previewManifest.subtitleSegments.slice(0, 3).map((segment) => segment.text).join(" / ")
                      : "No subtitle segments in this manifest."}
                  </small>
                </div>
                <div>
                  <span>Background</span>
                  <strong>{selectedEffectLabel}</strong>
                  <small>
                    {previewManifest.imageAssets.length > 0
                      ? `${previewManifest.imageAssets.length} image assets · ${layoutIds.join(", ")}`
                      : `Procedural effect only · ${manifestEffectIds.join(", ") || "none"}`}
                  </small>
                </div>
              </div>
            </section>
            <div className="paper-studio__scene-section">
              <p className="paper-studio__kicker">Scenes</p>
              <div className="paper-studio__scene-list">
                {scenes.map((scene) => (
                  <div key={scene.id}>
                    <span>{scene.type}</span>
                    <strong>{typeof scene.content.title === "string" ? scene.content.title : scene.id}</strong>
                    <small>
                      audio {audioCountByScene.get(scene.id) ?? 0} · subtitles {subtitleCountByScene.get(scene.id) ?? 0} · {scene.backgroundEffectId}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
};
