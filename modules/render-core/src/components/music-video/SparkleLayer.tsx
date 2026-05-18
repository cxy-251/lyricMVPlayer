import React from "react";

type SparkleLayerProps = {
  currentFrame: number;
  high: number;
  beat: number;
  onset: number;
};

const sparkles = Array.from({length: 18}, (_, index) => ({
  id: index,
  x: 380 + (index % 6) * 56,
  y: 430 + Math.floor(index / 6) * 64,
  phase: index * 0.9
}));

export const SparkleLayer: React.FC<SparkleLayerProps> = ({currentFrame, high, beat, onset}) => {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {sparkles.map((sparkle) => {
        const pulse = Math.sin(currentFrame * 0.08 + sparkle.phase) * 0.5 + 0.5;
        const accent = Math.max(onset * 0.85, beat * 0.65);
        const opacity = Math.max(0, (high * 0.08 + accent * 0.18) * pulse);
        const scale = 0.7 + opacity * 1.15;
        return (
          <div
            key={sparkle.id}
            className="absolute rounded-full bg-white"
            style={{
              left: sparkle.x,
              top: sparkle.y,
              width: 3,
              height: 3,
              opacity,
              transform: `scale(${scale.toFixed(3)})`,
              boxShadow: `0 0 ${8 + opacity * 18}px rgba(255,255,255,${0.08 + opacity * 0.24})`
            }}
          />
        );
      })}
    </div>
  );
};
