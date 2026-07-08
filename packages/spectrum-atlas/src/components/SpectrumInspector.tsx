import React from "react";
import {Copy} from "lucide-react";

import type {SpectrumColor} from "../data/spectrum-colors";
import {getReadableTextColor} from "../utils/color-convert";
import {
  toCmykString,
  toCssVariable,
  toHslString,
  toJsonSnippet,
  toRgbString,
  toTailwindToken,
} from "../utils/color-output";

type SpectrumInspectorProps = {
  color: SpectrumColor;
  onCopy: (value: string, label: string) => void;
};

const makeRows = (color: SpectrumColor) => [
  ["HEX", color.hex],
  ["RGB", toRgbString(color)],
  ["CMYK", toCmykString(color)],
  ["HSL", toHslString(color)],
  ["Family", color.family],
  ["Index", String(color.index).padStart(3, "0")],
];

export const SpectrumInspector: React.FC<SpectrumInspectorProps> = ({color, onCopy}) => {
  const copyBlocks = React.useMemo(() => [
    {label: "Copy HEX", value: color.hex},
    {label: "Copy RGB", value: toRgbString(color)},
    {label: "Copy CMYK", value: toCmykString(color)},
    {label: "Copy HSL", value: toHslString(color)},
    {label: "Copy CSS Variable", value: toCssVariable(color)},
    {label: "Copy Tailwind Token", value: toTailwindToken(color)},
    {label: "Copy JSON", value: toJsonSnippet(color)},
  ], [color]);
  const readable = getReadableTextColor(color.hex);

  return (
    <aside className="spectrum-inspector" aria-label="Spectrum inspector">
      <div className="spectrum-inspector__hero" style={{backgroundColor: color.hex, color: readable}}>
        <span>{color.family}</span>
        <strong>{color.hex}</strong>
      </div>
      <div className="spectrum-inspector__title">
        <span>Inspector</span>
        <h2>{color.name}</h2>
        <p>{color.pinyin ?? color.displayName}</p>
      </div>
      <dl className="spectrum-inspector__rows">
        {makeRows(color).map(([label, value]) => (
          <React.Fragment key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      <div className="spectrum-inspector__copy">
        {copyBlocks.map((block) => (
          <button key={block.label} type="button" onClick={() => onCopy(block.value, block.label.replace("Copy ", ""))}>
            <Copy size={14} aria-hidden="true" />
            {block.label}
          </button>
        ))}
      </div>
    </aside>
  );
};
