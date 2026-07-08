import React from "react";

export type SpectrumMode = "3d" | "2d";

type SpectrumModeToggleProps = {
  mode: SpectrumMode;
  onModeChange: (mode: SpectrumMode) => void;
};

export const SpectrumModeToggle: React.FC<SpectrumModeToggleProps> = ({mode, onModeChange}) => (
  <div className="spectrum-mode-toggle" role="tablist" aria-label="Spectrum mode">
    {(["3d", "2d"] as const).map((item) => (
      <button
        key={item}
        type="button"
        role="tab"
        aria-selected={mode === item}
        data-active={mode === item}
        onClick={() => onModeChange(item)}
      >
        {item.toUpperCase()} Mode
      </button>
    ))}
  </div>
);
