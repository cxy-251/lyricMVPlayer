import React from "react";
import type {RenderManifest} from "@paper-to-video/shared-types";

export type PaperItem = {
  id: string;
  label: string;
  source: string;
  manifest: RenderManifest;
};

interface PaperListDrawerProps {
  papers: PaperItem[];
  selectedPaper: PaperItem;
  onSelect: (paperId: string) => void;
  onClose: () => void;
}

export const PaperListDrawer: React.FC<PaperListDrawerProps> = ({
  papers,
  selectedPaper,
  onSelect,
  onClose,
}) => {
  return (
    <div className="paper-studio__drawer-layer">
      <button
        aria-label="Close paper list"
        className="paper-studio__scrim"
        onClick={onClose}
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
            onClick={onClose}
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
              onClick={() => onSelect(paper.id)}
              type="button"
            >
              <span>{paper.label}</span>
              <strong>{paper.manifest.paper.title}</strong>
            </button>
          ))}
        </nav>
      </aside>
    </div>
  );
};
