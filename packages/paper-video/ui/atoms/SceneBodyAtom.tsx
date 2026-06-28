import React from "react";

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
