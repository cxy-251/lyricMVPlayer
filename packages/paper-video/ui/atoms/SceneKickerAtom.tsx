import React from "react";

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
