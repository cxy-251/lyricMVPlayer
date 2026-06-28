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
