import React from "react";

type AudioReactiveBackgroundProps = {
  bass: number;
  energy: number;
  onset: number;
};

export const AudioReactiveBackground: React.FC<AudioReactiveBackgroundProps> = ({bass, energy, onset}) => {
  const scale = 1 + bass * 0.02;
  const glowOpacity = 0.06 + energy * 0.1 + onset * 0.08;
  const vignetteOpacity = 0.2 + bass * 0.1;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        className="absolute inset-0 transition-transform duration-150"
        style={{
          transform: `scale(${scale.toFixed(4)})`,
          background:
            "radial-gradient(circle at 50% 38%, rgba(138,180,255,0.12), rgba(138,180,255,0.05) 20%, transparent 50%)",
          opacity: glowOpacity
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, transparent 0%, rgba(0,0,0,0.07) 45%, rgba(0,0,0,0.16) 75%, rgba(0,0,0,0.28) 100%)",
          opacity: vignetteOpacity
        }}
      />
    </div>
  );
};
