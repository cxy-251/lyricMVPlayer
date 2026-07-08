import React from "react";
import {motion} from "framer-motion";

import type {SpectrumColor} from "../data/spectrum-colors";
import {getReadableTextColor} from "../utils/color-convert";

type SpectrumColorCardProps = {
  color: SpectrumColor;
  selected: boolean;
  onSelect: (id: string) => void;
};

export const SpectrumColorCard: React.FC<SpectrumColorCardProps> = ({color, selected, onSelect}) => {
  const textColor = getReadableTextColor(color.hex);

  return (
    <motion.button
      type="button"
      className="spectrum-card"
      data-selected={selected}
      style={{"--card-color": color.hex, "--card-text": textColor} as React.CSSProperties}
      onClick={() => onSelect(color.id)}
      whileHover={{y: -3}}
      whileTap={{scale: 0.98}}
      title={`${color.name} ${color.hex}`}
    >
      <span className="spectrum-card__strip" />
      <span className="spectrum-card__name writing-vertical">{color.name}</span>
      <span className="spectrum-card__pinyin writing-vertical">{color.pinyin ?? color.displayName}</span>
      <span className="spectrum-card__hex">{color.hex}</span>
      <span className="spectrum-card__rings" aria-hidden="true">
        {color.rgb.map((channel, index) => (
          <span key={index} style={{opacity: 0.26 + channel / 360}} />
        ))}
      </span>
    </motion.button>
  );
};
