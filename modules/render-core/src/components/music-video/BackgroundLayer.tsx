import React from "react";

type BackgroundLayerProps = {
  kind: "image" | "video" | "color";
  src?: string;
  color?: string;
};

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({kind, src, color}) => {
  if (kind === "image" && src) {
    return (
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          className="absolute inset-0 h-full w-full object-cover object-center"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            transform: "scale(1.018)",
            filter: "blur(4px) saturate(0.94) brightness(0.9)"
          }}
          src={src}
          alt=""
        />
        <img
          className="absolute inset-0 h-full w-full object-cover object-center"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            opacity: 0.88
          }}
          src={src}
          alt=""
        />
      </div>
    );
  }

  if (kind === "video" && src) {
    return (
      <div className="absolute inset-0 z-0 overflow-hidden">
        <video
          className="absolute inset-0 h-full w-full object-cover object-center"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            transform: "scale(1.018)",
            filter: "blur(4px) saturate(0.94) brightness(0.9)"
          }}
          src={src}
          autoPlay
          loop
          muted
          playsInline
        />
        <video
          className="absolute inset-0 h-full w-full object-cover object-center"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            opacity: 0.88
          }}
          src={src}
          autoPlay
          loop
          muted
          playsInline
        />
      </div>
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
