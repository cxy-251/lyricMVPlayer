import React from "react";

type TagFilterProps = {
  tags: string[];
  activeTag: string;
  onSelectTag: (tag: string) => void;
};

export const TagFilter: React.FC<TagFilterProps> = ({tags, activeTag, onSelectTag}) => {
  return (
    <div className="gradient-tags" aria-label="Gradient tags">
      <button
        type="button"
        data-active={activeTag === "all"}
        onClick={() => onSelectTag("all")}
      >
        All
      </button>
      {tags.slice(0, 18).map((tag) => (
        <button
          key={tag}
          type="button"
          data-active={activeTag === tag}
          onClick={() => onSelectTag(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  );
};
