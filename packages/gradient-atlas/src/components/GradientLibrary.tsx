import React from "react";
import {Search, Sparkles} from "lucide-react";
import {AnimatePresence, motion} from "framer-motion";

import type {GradientPreset} from "../data/gradients";
import {GradientCard} from "./GradientCard";
import {TagFilter} from "./TagFilter";

type GradientLibraryProps = {
  presets: GradientPreset[];
  selectedId: string;
  favorites: Set<string>;
  query: string;
  activeTag: string;
  tags: string[];
  onQueryChange: (value: string) => void;
  onTagChange: (tag: string) => void;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

export const GradientLibrary: React.FC<GradientLibraryProps> = ({
  presets,
  selectedId,
  favorites,
  query,
  activeTag,
  tags,
  onQueryChange,
  onTagChange,
  onSelect,
  onToggleFavorite,
}) => {
  return (
    <aside className="gradient-library" aria-label="Gradient Library">
      <div className="gradient-panel__topline">
        <div>
          <p>Library</p>
          <h2>{presets.length} presets</h2>
        </div>
        <Sparkles size={18} />
      </div>

      <label className="gradient-search">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search name, HEX, tag"
        />
      </label>

      <TagFilter tags={tags} activeTag={activeTag} onSelectTag={onTagChange} />

      <div className="gradient-library__list">
        <AnimatePresence initial={false}>
          {presets.map((preset) => (
            <GradientCard
              key={preset.id}
              preset={preset}
              selected={selectedId === preset.id}
              favorite={favorites.has(preset.id)}
              onSelect={onSelect}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </AnimatePresence>

        {presets.length === 0 && (
          <motion.div
            className="gradient-library__empty"
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
          >
            No gradients match this filter.
          </motion.div>
        )}
      </div>
    </aside>
  );
};
