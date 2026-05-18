import React from "react";

type BackgroundLayerProps = {
  kind: "image" | "video" | "color";
  src?: string;
  color?: string;
};

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({kind, src, color}) => {
  if (kind === "image" && src) {
    return (
      <img
        className="absolute inset-0 z-0 h-full w-full object-cover object-center"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center"
        }}
        src={src}
        alt=""
      />
    );
  }

  if (kind === "video" && src) {
    return (
      <video
        className="absolute inset-0 z-0 h-full w-full object-cover object-center"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center"
        }}
        src={src}
        autoPlay
        loop
        muted
        playsInline
      />
    );
  }

  return (
    <div
      className="absolute inset-0 z-0 h-full w-full"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        width: "100%",
        height: "100%",
        background: color ?? "#0d1426"
      }}
    />
  );
};
