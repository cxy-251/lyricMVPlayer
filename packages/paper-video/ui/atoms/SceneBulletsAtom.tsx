import React from "react";

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
