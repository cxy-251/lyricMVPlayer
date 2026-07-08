import React from "react";
import {ChevronLeft, ChevronRight, RotateCcw, Shuffle} from "lucide-react";

import type {SpectrumColor} from "../data/spectrum-colors";
import type {SpectrumMode} from "./SpectrumModeToggle";

type SpectrumToolbarProps = {
  mode: SpectrumMode;
  color: SpectrumColor;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onRandom: () => void;
  onResetView: () => void;
};

export const SpectrumToolbar: React.FC<SpectrumToolbarProps> = ({
  mode,
  color,
  total,
  onPrevious,
  onNext,
  onRandom,
  onResetView,
}) => (
  <div className="spectrum-toolbar" aria-label="Spectrum toolbar">
    <div className="spectrum-toolbar__actions">
      <button type="button" onClick={onPrevious} title="Previous color">
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={onNext} title="Next color">
        <ChevronRight size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={onRandom} title="Random color">
        <Shuffle size={15} aria-hidden="true" />
      </button>
      <button type="button" onClick={onResetView} title="Reset 3D view" disabled={mode !== "3d"}>
        <RotateCcw size={15} aria-hidden="true" />
      </button>
    </div>
    <div className="spectrum-toolbar__count">
      <span>{String(color.index + 1).padStart(3, "0")}</span>
      <strong>/ {total}</strong>
    </div>
  </div>
);
