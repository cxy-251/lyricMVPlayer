import React from "react";

export const SubtitlePanelAtom: React.FC<{
  text: string;
  panelColor: string;
  foreground: string;
  fontSize?: string;
}> = ({text, panelColor, foreground, fontSize = "clamp(0.95rem, 1.25vw + 0.45rem, 1.75rem)"}) => {
  return (
    <div
      style={{
        fontSize,
        lineHeight: 1.45,
        color: foreground,
        padding: "clamp(0.95rem, 1.35vw, 1.5rem) clamp(1rem, 1.6vw, 1.75rem)",
        borderRadius: 28,
        backgroundColor: panelColor,
        border: "1px solid rgba(255,255,255,0.08)",
        minHeight: "clamp(4rem, 8vw, 7.5rem)",
        opacity: 0.98,
      }}
    >
      {text}
    </div>
  );
};
