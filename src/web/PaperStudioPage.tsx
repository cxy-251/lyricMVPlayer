import React, {useEffect, useMemo, useState} from "react";
import {Link} from "react-router";
import {Player} from "@remotion/player";
import {Home, BookOpen, Menu, X} from "lucide-react";
import type {RenderManifest} from "@paper-to-video/shared-types";
import demoPaperManifest from "../../artifacts/paper-video/output/runs/demo-paper-001/demo-default/manifests/render-manifest.json";
import firstTokenKnowsManifest from "../../artifacts/paper-video/output/runs/arxiv-2605-05166v1-cover-local-donut-spin/20260518-223301/manifests/render-manifest.json";
import propertyGuidedSynthesisManifest from "../../artifacts/paper-video/output/runs/arxiv-2605-16142v1-cover-local-donut-spin/20260518-223144/manifests/render-manifest.json";
import lookBeforeLeapManifest from "../../artifacts/paper-video/output/runs/arxiv-2605-16143v1-cover-local-donut-spin/20260518-223030/manifests/render-manifest.json";
import paperJsonManifest from "../../artifacts/paper-video/output/runs/arxiv-2605-16194v1-cover-local-donut-spin/20260518-222634/manifests/render-manifest.json";
import formalMethodsManifest from "../../artifacts/paper-video/output/runs/arxiv-2605-16198v1-cover-local-donut-spin/20260518-222507/manifests/render-manifest.json";
import tutoringAgentsManifest from "../../artifacts/paper-video/output/runs/arxiv-2605-16207v1-cover-local-donut-spin/20260518-222045/manifests/render-manifest.json";
import argusManifest from "../../artifacts/paper-video/output/runs/arxiv-2605-16217v1-cover-local-donut-spin/20260518-221809/manifests/render-manifest.json";
import designVideoGenerationManifest from "../../artifacts/paper-video/output/runs/arxiv-2605-16223v1-cover-local-donut-spin/20260518-221651/manifests/render-manifest.json";
import collectiveOpinionManifest from "../../artifacts/paper-video/output/runs/arxiv-2605-16245v1-cover-local-donut-spin/20260518-220821/manifests/render-manifest.json";
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

export type PaperItem = {
  id: string;
  label: string;
  source: string;
  manifest: RenderManifest;
};

const repositoryPaperSamples: Array<{
  id: string;
  label: string;
  source: string;
  manifest: RenderManifest;
}> = [
  {
    id: "demo",
    label: "Repository Demo",
    source: "artifacts/paper-video/output/runs/demo-paper-001/demo-default/manifests/render-manifest.json",
    manifest: demoPaperManifest as RenderManifest,
  },
  {
    id: "arxiv-2605-05166v1",
    label: "2605.05166v1",
    source:
      "artifacts/paper-video/output/runs/arxiv-2605-05166v1-cover-local-donut-spin/20260518-223301/manifests/render-manifest.json",
    manifest: firstTokenKnowsManifest as RenderManifest,
  },
  {
    id: "arxiv-2605-16142v1",
    label: "2605.16142v1",
    source:
      "artifacts/paper-video/output/runs/arxiv-2605-16142v1-cover-local-donut-spin/20260518-223144/manifests/render-manifest.json",
    manifest: propertyGuidedSynthesisManifest as RenderManifest,
  },
  {
    id: "arxiv-2605-16143v1",
    label: "2605.16143v1",
    source:
      "artifacts/paper-video/output/runs/arxiv-2605-16143v1-cover-local-donut-spin/20260518-223030/manifests/render-manifest.json",
    manifest: lookBeforeLeapManifest as RenderManifest,
  },
  {
    id: "arxiv-2605-16194v1",
    label: "2605.16194v1",
    source:
      "artifacts/paper-video/output/runs/arxiv-2605-16194v1-cover-local-donut-spin/20260518-222634/manifests/render-manifest.json",
    manifest: paperJsonManifest as RenderManifest,
  },
  {
    id: "arxiv-2605-16198v1",
    label: "2605.16198v1",
    source:
      "artifacts/paper-video/output/runs/arxiv-2605-16198v1-cover-local-donut-spin/20260518-222507/manifests/render-manifest.json",
    manifest: formalMethodsManifest as RenderManifest,
  },
  {
    id: "arxiv-2605-16207v1",
    label: "2605.16207v1",
    source:
      "artifacts/paper-video/output/runs/arxiv-2605-16207v1-cover-local-donut-spin/20260518-222045/manifests/render-manifest.json",
    manifest: tutoringAgentsManifest as RenderManifest,
  },
  {
    id: "arxiv-2605-16217v1",
    label: "2605.16217v1",
    source:
      "artifacts/paper-video/output/runs/arxiv-2605-16217v1-cover-local-donut-spin/20260518-221809/manifests/render-manifest.json",
    manifest: argusManifest as RenderManifest,
  },
  {
    id: "arxiv-2605-16223v1",
    label: "2605.16223v1",
    source:
      "artifacts/paper-video/output/runs/arxiv-2605-16223v1-cover-local-donut-spin/20260518-221651/manifests/render-manifest.json",
    manifest: designVideoGenerationManifest as RenderManifest,
  },
  {
    id: "arxiv-2605-16245v1",
    label: "2605.16245v1",
    source:
      "artifacts/paper-video/output/runs/arxiv-2605-16245v1-cover-local-donut-spin/20260518-220821/manifests/render-manifest.json",
    manifest: collectiveOpinionManifest as RenderManifest,
  },
];

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
  
  const rewrite = (value: unknown): unknown => {
    if (typeof value === "string") {
      // Handle the new artifacts/paper-video/output suffix
      let suffixIndex = value.indexOf("/artifacts/paper-video/output");
      if (suffixIndex >= 0) {
        return currentOutputRoot + value.slice(suffixIndex + "/artifacts/paper-video/output".length);
      }
      // Handle the legacy 02codeX/output/runs/ suffix
      suffixIndex = value.indexOf("/output/runs/");
      if (suffixIndex >= 0) {
        return currentOutputRoot + "/runs/" + value.slice(suffixIndex + "/output/runs/".length);
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
  }

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const latestManifest = useLatestRun();
  const artifactPapers = usePaperLibrary();

  const papers = useMemo<PaperItem[]>(() => {
    const byId = new Map<string, PaperItem>();
    const addPaper = (item: PaperItem) => {
      byId.set(item.id, item);
    };

    repositoryPaperSamples.forEach((sample) =>
      addPaper({
        ...sample,
        manifest: normalizeManifestPaths(sample.manifest),
      })
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
  const manifest = selectedPaper.manifest;
  
  const selectPaper = (paperId: string) => {
    setSelectedPaperId(paperId);
    window.history.pushState({}, "", `/studio/papers/${paperId}`);
    setIsSidebarOpen(false); // Auto close sidebar on mobile/selection
  };

  return (
    <div className="web-shell bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Abstract glowing background blobs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="web-stage-frame relative">
        <Link className="web-studio-link !z-[100]" to="/studio" title="Studio" aria-label="Open studio">
          <span>Lab</span>
        </Link>
        
        {/* Toggle Sidebar Button */}
        <button 
          className="absolute z-[60] top-4 left-4 p-2 bg-black/40 hover:bg-black/60 rounded-full border border-white/10 text-white/70 hover:text-white transition-all backdrop-blur-md"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Floating Sidebar */}
        <aside 
          className={`absolute z-50 left-0 top-0 h-full w-72 flex flex-col border-r border-white/10 bg-slate-950/80 backdrop-blur-xl shadow-2xl transition-transform duration-300 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="p-6 pb-2 pt-16 border-b border-white/10 flex items-center gap-4">
            <h1 className="text-xl font-medium tracking-wide text-white">Papers</h1>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {papers.map((paper) => {
              const isSelected = paper.id === selectedPaper.id;
              return (
                <button
                  key={paper.id}
                  onClick={() => selectPaper(paper.id)}
                  className={`w-full text-left p-4 rounded-xl transition-all duration-200 border flex flex-col gap-1 
                    ${isSelected 
                      ? "bg-indigo-500/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10" 
                      : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                    }`}
                >
                  <div className="flex items-start justify-between w-full">
                    <span className={`text-sm font-medium ${isSelected ? "text-indigo-300" : "text-slate-400"}`}>
                      {paper.label}
                    </span>
                    {isSelected && <BookOpen size={16} className="text-indigo-400" />}
                  </div>
                  <strong className="text-base font-normal leading-snug line-clamp-2 text-slate-200 mt-1">
                    {paper.manifest.paper.title}
                  </strong>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Video Player */}
        <Player
          autoPlay={false}
          component={PaperVideo}
          compositionHeight={manifest.height}
          compositionWidth={manifest.width}
          controls
          clickToPlay={true}
          durationInFrames={manifest.totalFrames}
          fps={manifest.fps}
          inputProps={{manifest}}
          key={selectedPaper.id}
          loop={false}
          style={{
            width: "100%", 
            height: "100%", 
            backgroundColor: "#050a10"
          }}
        />
      </div>
    </div>
  );
};
