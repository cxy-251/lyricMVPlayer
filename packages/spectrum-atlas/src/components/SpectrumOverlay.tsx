import React from "react";
import {Link} from "react-router";
import {motion} from "framer-motion";

import type {SpectrumColor} from "../data/spectrum-colors";
import {toCmykString, toHslString, toRgbString} from "../utils/color-output";
import {SpectrumModeToggle, type SpectrumMode} from "./SpectrumModeToggle";

type SpectrumOverlayProps = {
  color: SpectrumColor;
  mode: SpectrumMode;
  onModeChange: (mode: SpectrumMode) => void;
};

const hasCjk = (value: string): boolean => /[\u3400-\u9fff]/.test(value);

const titleParts = (color: SpectrumColor): string[] => {
  if (hasCjk(color.name)) return Array.from(color.name);
  return color.displayName.toUpperCase().split(/\s+/);
};

export const SpectrumOverlay: React.FC<SpectrumOverlayProps> = ({color, mode, onModeChange}) => (
  <div className="spectrum-overlay" aria-label="Current spectrum color">
    <Link className="spectrum-studio-link" to="/studio" title="Studio" aria-label="Back to studio">
      Studio
    </Link>

    <header className="spectrum-nav">
      <SpectrumModeToggle mode={mode} onModeChange={onModeChange} />
    </header>

    <motion.div
      key={color.id}
      className="spectrum-title"
      initial={{opacity: 0, y: 16, filter: "blur(10px)"}}
      animate={{opacity: 1, y: 0, filter: "blur(0px)"}}
      transition={{duration: 0.42, ease: [0.16, 1, 0.3, 1]}}
    >
      {titleParts(color).map((part) => (
        <span key={part}>{part}</span>
      ))}
    </motion.div>

    <div className="spectrum-overlay__readout">
      <span>{color.name}</span>
      <strong>{color.displayName}</strong>
      <small>{color.hex}</small>
      <small>{toRgbString(color)}</small>
      <small>{toCmykString(color)}</small>
      <small>{toHslString(color)}</small>
    </div>
  </div>
);
