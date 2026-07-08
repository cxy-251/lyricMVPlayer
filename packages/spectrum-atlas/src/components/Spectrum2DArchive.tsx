import React from "react";

import type {SpectrumColor, SpectrumFamily} from "../data/spectrum-colors";
import {toCmykString, toRgbString} from "../utils/color-output";
import {SpectrumColorCard} from "./SpectrumColorCard";
import {SpectrumSearch} from "./SpectrumSearch";

type Spectrum2DArchiveProps = {
  colors: SpectrumColor[];
  selectedColor: SpectrumColor;
  query: string;
  activeFamily: SpectrumFamily | "all";
  onQueryChange: (value: string) => void;
  onFamilyChange: (family: SpectrumFamily | "all") => void;
  onSelect: (id: string) => void;
};

export const Spectrum2DArchive: React.FC<Spectrum2DArchiveProps> = ({
  colors,
  selectedColor,
  query,
  activeFamily,
  onQueryChange,
  onFamilyChange,
  onSelect,
}) => (
  <section className="spectrum-archive" aria-label="Archive spectrum mode">
    <SpectrumSearch
      query={query}
      family={activeFamily}
      resultCount={colors.length}
      onQueryChange={onQueryChange}
      onFamilyChange={onFamilyChange}
    />

    <div className="spectrum-archive__grid" aria-label="Spectrum color archive">
      {colors.map((color) => (
        <SpectrumColorCard
          key={color.id}
          color={color}
          selected={selectedColor.id === color.id}
          onSelect={onSelect}
        />
      ))}
      {colors.length === 0 && (
        <div className="spectrum-archive__empty">
          No colors match this filter.
        </div>
      )}
    </div>

    <aside className="spectrum-archive__side" aria-label="Archive selected color">
      <div className="spectrum-archive__vertical-title writing-vertical">SPECTRUM ATLAS</div>
      <div className="spectrum-archive__metric">
        <span>RGB</span>
        <strong>{toRgbString(selectedColor)}</strong>
      </div>
      <div className="spectrum-archive__metric">
        <span>CMYK</span>
        <strong>{toCmykString(selectedColor)}</strong>
      </div>
      <div className="spectrum-archive__swatch" style={{backgroundColor: selectedColor.hex}} />
    </aside>
  </section>
);
