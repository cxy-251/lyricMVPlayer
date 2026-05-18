import React from "react";

type EnergyRingProps = {
  currentFrame: number;
  bass: number;
  mid: number;
  energy: number;
  beat: number;
  onset: number;
  lineProgress: number;
};

export const EnergyRing: React.FC<EnergyRingProps> = ({
  currentFrame,
  bass,
  mid,
  energy,
  beat,
  onset,
  lineProgress
}) => {
  const breath = Math.sin(currentFrame * 0.035) * 6;
  const lyricPulse = Math.max(0, 1 - Math.abs(lineProgress - 0.08) * 10);
  const eventPulse = Math.max(beat * 1.1, onset * 0.95, lyricPulse * 0.75);
  const size = 270 + bass * 18 + breath + eventPulse * 44;
  const opacity = 0.06 + energy * 0.04 + eventPulse * 0.07;
  const blur = 12 + energy * 8 + eventPulse * 12;
  const innerScale = 0.72 + eventPulse * 0.04;
  const wobbleA = Math.sin(currentFrame * 0.028) * (2 + bass * 6 + eventPulse * 10);
  const wobbleB = Math.cos(currentFrame * 0.023) * (1.5 + mid * 4 + eventPulse * 8);

  return (
    <div className="pointer-events-none absolute left-1/2 top-[560px] z-20 -translate-x-1/2 -translate-y-1/2">
      <div
        className="rounded-[48%]"
        style={{
          width: size + wobbleA,
          height: size + wobbleB,
          opacity,
          border: "1px solid rgba(186,214,255,0.2)",
          boxShadow: `0 0 ${blur}px rgba(126,168,255,${0.08 + mid * 0.05 + eventPulse * 0.08})`
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 rounded-[48%]"
        style={{
          width: size * innerScale,
          height: size * innerScale,
          transform: "translate(-50%, -50%)",
          border: "1px solid rgba(255,255,255,0.12)",
          opacity: 0.04 + energy * 0.04 + eventPulse * 0.05
        }}
      />
    </div>
  );
};
