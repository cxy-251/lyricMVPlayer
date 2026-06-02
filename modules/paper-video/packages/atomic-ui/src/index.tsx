import React from "react";

export const CoverAvatarAtom: React.FC<{
  src: string;
  size?: number;
}> = ({src, size = 148}) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        overflow: "hidden",
        border: "3px solid rgba(255,255,255,0.18)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
      }}
    >
      <img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
  );
};

export const SceneKickerAtom: React.FC<{
  text: string;
  color: string;
  fontSize?: string;
}> = ({text, color, fontSize = "clamp(0.72rem, 1vw + 0.42rem, 1.5rem)"}) => {
  return (
    <div style={{fontSize, letterSpacing: "0.28em", color}}>
      {text}
    </div>
  );
};

export const SceneTitleAtom: React.FC<{
  text: string;
  fontSize?: string;
}> = ({text, fontSize = "clamp(1.9rem, 4vw + 0.4rem, 4.8rem)"}) => {
  return (
    <div style={{fontSize, lineHeight: 1.08, fontWeight: 700, maxWidth: "min(100%, 54rem)"}}>
      {text}
    </div>
  );
};

export const SceneBodyAtom: React.FC<{
  text: string;
  fontSize?: string;
}> = ({text, fontSize = "clamp(1rem, 1.6vw + 0.5rem, 2.1rem)"}) => {
  return (
    <div style={{fontSize, lineHeight: 1.5, maxWidth: "min(100%, 54rem)", color: "#dbe7f5"}}>
      {text}
    </div>
  );
};

export const SceneBulletsAtom: React.FC<{
  bullets: string[];
  fontSize?: string;
}> = ({bullets, fontSize = "clamp(0.98rem, 1.45vw + 0.45rem, 1.9rem)"}) => {
  return (
    <div style={{display: "flex", flexDirection: "column", gap: "clamp(0.7rem, 1.2vw, 1.15rem)", maxWidth: "min(100%, 54rem)"}}>
      {bullets.map((bullet) => (
        <div key={bullet} style={{fontSize, lineHeight: 1.5, color: "#ecf6ff"}}>
          {"• "}{bullet}
        </div>
      ))}
    </div>
  );
};

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
