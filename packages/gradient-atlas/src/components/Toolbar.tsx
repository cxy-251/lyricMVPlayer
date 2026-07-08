import React from "react";
import {ChevronLeft, ChevronRight, Copy, Download, Heart, Shuffle} from "lucide-react";

import type {GradientPreset} from "../data/gradients";
import type {GradientDirection} from "../utils/gradient";

type ToolbarProps = {
  preset: GradientPreset;
  direction: string;
  directions: readonly GradientDirection[];
  favorite: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onRandom: () => void;
  onToggleFavorite: () => void;
  onDirectionChange: (direction: string) => void;
  onCopyCss: () => void;
  onExportPng: () => void;
};

export const Toolbar: React.FC<ToolbarProps> = ({
  preset,
  direction,
  directions,
  favorite,
  onPrevious,
  onNext,
  onRandom,
  onToggleFavorite,
  onDirectionChange,
  onCopyCss,
  onExportPng,
}) => {
  return (
    <section className="gradient-toolbar" aria-label="Gradient controls">
      <div className="gradient-toolbar__identity">
        <span>Gradient Atlas</span>
        <strong>{preset.name}</strong>
      </div>

      <div className="gradient-toolbar__buttons">
        <button type="button" onClick={onPrevious} aria-label="Previous gradient" title="Previous">
          <ChevronLeft size={17} />
        </button>
        <button type="button" onClick={onRandom} title="Random gradient">
          <Shuffle size={16} />
          <span>Random</span>
        </button>
        <button type="button" onClick={onNext} aria-label="Next gradient" title="Next">
          <ChevronRight size={17} />
        </button>
        <button
          type="button"
          data-active={favorite}
          onClick={onToggleFavorite}
          title={favorite ? "Remove favorite" : "Favorite"}
        >
          <Heart size={16} fill={favorite ? "currentColor" : "none"} />
          <span>Favorite</span>
        </button>
        <button type="button" onClick={onCopyCss} title="Copy CSS">
          <Copy size={16} />
          <span>Copy CSS</span>
        </button>
        <button type="button" onClick={onExportPng} title="Export PNG preview">
          <Download size={16} />
          <span>PNG</span>
        </button>
      </div>

      <div className="gradient-toolbar__directions" aria-label="Direction">
        {directions.map((item) => (
          <button
            key={item}
            type="button"
            data-active={direction === item}
            onClick={() => onDirectionChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </section>
  );
};
