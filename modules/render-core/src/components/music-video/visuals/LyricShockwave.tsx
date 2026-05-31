import React from "react";

type LyricShockwaveProps = {
  lineProgress: number;
  onset: number;
};

export const LyricShockwave: React.FC<LyricShockwaveProps> = ({lineProgress, onset}) => {
  const lyricPulse = Math.max(0, 1 - Math.abs(lineProgress - 0.12) * 7);
  const wave = Math.max(onset * 0.78, lyricPulse * 0.55);
  const scale = 0.86 + wave * 0.22;
  const opacity = Math.max(0, 0.08 * wave);

  return (
    <div className="pointer-events-none absolute left-1/2 top-[1220px] z-20 -translate-x-1/2 -translate-y-1/2">
      <div
        className="rounded-full border border-white/14"
        style={{
          width: 440,
          height: 440,
          transform: `scale(${scale.toFixed(4)})`,
          opacity,
          boxShadow: `0 0 ${14 + wave * 14}px rgba(140,180,255,${opacity * 0.85})`
        }}
      />
    </div>
  );
};
