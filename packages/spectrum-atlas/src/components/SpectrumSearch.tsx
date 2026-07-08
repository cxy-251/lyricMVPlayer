import React from "react";
import {Search} from "lucide-react";

import type {SpectrumColor, SpectrumFamily} from "../data/spectrum-colors";
import {spectrumFamilyOrder} from "../utils/spectrum-layout";

const familyLabels: Record<SpectrumFamily | "all", string> = {
  all: "all",
  red: "red",
  orange: "orange",
  yellow: "yellow",
  green: "green",
  cyan: "cyan",
  blue: "blue",
  purple: "purple",
  pink: "pink",
  brown: "brown",
  neutral: "neutral",
};

type SpectrumSearchProps = {
  query: string;
  family: SpectrumFamily | "all";
  resultCount: number;
  onQueryChange: (value: string) => void;
  onFamilyChange: (family: SpectrumFamily | "all") => void;
};

export const SpectrumSearch: React.FC<SpectrumSearchProps> = ({
  query,
  family,
  resultCount,
  onQueryChange,
  onFamilyChange,
}) => (
  <div className="spectrum-search-panel">
    <div className="spectrum-search-panel__meta">
      <span>Archive</span>
      <strong>{resultCount} colors</strong>
    </div>
    <label className="spectrum-search">
      <Search size={16} aria-hidden="true" />
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search name, pinyin, HEX, family"
      />
    </label>
    <div className="spectrum-family-filter" aria-label="Color family filter">
      {(["all", ...spectrumFamilyOrder] as const).map((item) => (
        <button
          key={item}
          type="button"
          data-active={family === item}
          onClick={() => onFamilyChange(item)}
        >
          {familyLabels[item]}
        </button>
      ))}
    </div>
  </div>
);
