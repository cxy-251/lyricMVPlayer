import React from "react";
import {Plus} from "lucide-react";
import {motion} from "framer-motion";

import type {GradientPreset} from "../data/gradients";
import {
  getContrastColor,
  parseHexList,
  toCssVariables,
  toFallbackCss,
  toJsonSnippet,
  toReactStyle,
  toTailwindConfig,
} from "../utils/gradient";
import {CodeBlock} from "./CodeBlock";

type CustomGradientInput = {
  name: string;
  colors: string[];
  direction: string;
};

type GradientInspectorProps = {
  preset: GradientPreset;
  direction: string;
  onCopy: (value: string, label: string) => void;
  onAddCustomGradient: (gradient: CustomGradientInput) => void;
};

export const GradientInspector: React.FC<GradientInspectorProps> = ({
  preset,
  direction,
  onCopy,
  onAddCustomGradient,
}) => {
  const [customName, setCustomName] = React.useState("");
  const [customColors, setCustomColors] = React.useState("");
  const [formError, setFormError] = React.useState("");

  const codeBlocks = React.useMemo(() => [
    {label: "CSS", value: toFallbackCss(preset, direction)},
    {label: "Tailwind", value: toTailwindConfig(preset, direction)},
    {label: "CSS Variables", value: toCssVariables(preset, direction)},
    {label: "React Style", value: toReactStyle(preset, direction)},
    {label: "JSON", value: toJsonSnippet(preset, direction)},
  ], [direction, preset]);

  const handleSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const colors = parseHexList(customColors);
    if (colors.length < 2) {
      setFormError("Add at least two valid HEX colors.");
      return;
    }

    onAddCustomGradient({
      name: customName.trim() || "Custom Gradient",
      colors,
      direction,
    });
    setCustomName("");
    setCustomColors("");
    setFormError("");
  }, [customColors, customName, direction, onAddCustomGradient]);

  return (
    <aside className="gradient-inspector" aria-label="Gradient Inspector">
      <div className="gradient-panel__topline">
        <div>
          <p>Inspector</p>
          <h2>{preset.name}</h2>
        </div>
        <span className="gradient-inspector__source">{preset.source ?? "Custom"}</span>
      </div>

      <div className="gradient-inspector__colors">
        {preset.colors.map((color, index) => (
          <motion.button
            key={`${color}-${index}`}
            type="button"
            style={{backgroundColor: color, color: getContrastColor(color)}}
            onClick={() => onCopy(color, `Color ${index + 1}`)}
            whileTap={{scale: 0.97}}
            title={`Copy ${color}`}
          >
            <span>{index + 1}</span>
            <strong>{color}</strong>
          </motion.button>
        ))}
      </div>

      <div className="gradient-inspector__meta">
        <span>Direction</span>
        <strong>{direction}</strong>
        <span>Tags</span>
        <div>
          {preset.tags.map((tag) => (
            <small key={tag}>{tag}</small>
          ))}
        </div>
      </div>

      <div className="gradient-inspector__codes">
        {codeBlocks.map((block) => (
          <CodeBlock key={block.label} label={block.label} value={block.value} onCopy={onCopy} />
        ))}
      </div>

      <form className="gradient-custom-form" onSubmit={handleSubmit}>
        <div className="gradient-panel__topline gradient-panel__topline--compact">
          <div>
            <p>Custom</p>
            <h2>Add gradient</h2>
          </div>
          <Plus size={17} />
        </div>
        <label>
          Name
          <input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            placeholder="Aurora Draft"
          />
        </label>
        <label>
          HEX colors
          <input
            value={customColors}
            onChange={(event) => setCustomColors(event.target.value)}
            placeholder="#0f172a, #38bdf8, #f472b6"
          />
        </label>
        {formError && <p className="gradient-custom-form__error">{formError}</p>}
        <button type="submit">Save to local library</button>
      </form>
    </aside>
  );
};
