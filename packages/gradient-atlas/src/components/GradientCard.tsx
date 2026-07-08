import React from "react";
import {Heart} from "lucide-react";
import {motion} from "framer-motion";

import type {GradientPreset} from "../data/gradients";
import {toCssGradient} from "../utils/gradient";

type GradientCardProps = {
  preset: GradientPreset;
  selected: boolean;
  favorite: boolean;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

export const GradientCard: React.FC<GradientCardProps> = ({
  preset,
  selected,
  favorite,
  onSelect,
  onToggleFavorite,
}) => {
  return (
    <motion.article
      className="gradient-card"
      data-selected={selected}
      whileHover={{y: -3}}
      whileTap={{scale: 0.985}}
      layout
    >
      <button type="button" className="gradient-card__select" onClick={() => onSelect(preset.id)}>
        <span className="gradient-card__swatch" style={{backgroundImage: toCssGradient(preset)}} />
        <span className="gradient-card__body">
          <span className="gradient-card__name">{preset.name}</span>
          <span className="gradient-card__colors">
            {preset.colors.slice(0, 3).map((color) => (
              <span key={color} style={{backgroundColor: color}} title={color}>
                {color}
              </span>
            ))}
          </span>
          <span className="gradient-card__tags">
            {preset.tags.slice(0, 3).map((tag) => (
              <small key={tag}>{tag}</small>
            ))}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="gradient-card__favorite"
        data-active={favorite}
        aria-label={favorite ? `Remove ${preset.name} from favorites` : `Favorite ${preset.name}`}
        onClick={() => onToggleFavorite(preset.id)}
      >
        <Heart size={15} fill={favorite ? "currentColor" : "none"} />
      </button>
    </motion.article>
  );
};
