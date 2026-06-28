import React from "react";

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
