import React from "react";
import type {RenderManifest} from "@paper-to-video/shared-types";
import type {PaperItem} from "./PaperListDrawer";

export type PaperEffectOption = {
  id: string;
  label: string;
  description: string;
};

interface PaperInfoDrawerProps {
  selectedPaper: PaperItem;
  previewManifest: RenderManifest;
  scenes: any[];
  paperEffectOptions: PaperEffectOption[];
  selectedEffectId: string;
  onSelectEffect: (id: string) => void;
  onClose: () => void;
  audioCountByScene: Map<string, number>;
  subtitleCountByScene: Map<string, number>;
  manifestEffectIds: string[];
  layoutIds: string[];
  selectedEffectLabel: string;
  getFileName: (filePath: string | undefined) => string;
}

export const PaperInfoDrawer: React.FC<PaperInfoDrawerProps> = ({
  selectedPaper,
  previewManifest,
  scenes,
  paperEffectOptions,
  selectedEffectId,
  onSelectEffect,
  onClose,
  audioCountByScene,
  subtitleCountByScene,
  manifestEffectIds,
  layoutIds,
  selectedEffectLabel,
  getFileName,
}) => {
  return (
    <div className="paper-studio__drawer-layer paper-studio__drawer-layer--right">
      <button
        aria-label="Close paper information"
        className="paper-studio__scrim"
        onClick={onClose}
        type="button"
      />
      <aside className="paper-studio__meta">
        <div className="paper-studio__drawer-head">
          <p>{selectedPaper.source}</p>
          <button
            aria-label="Close paper information"
            className="paper-studio__close"
            onClick={onClose}
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
                onClick={() => onSelectEffect(effect.id)}
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
  );
};
