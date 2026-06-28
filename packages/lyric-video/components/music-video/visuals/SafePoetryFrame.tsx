import React from "react";

type SafePoetryFrameProps = {
  nickname: string;
  topLabel?: string;
  leftVertical?: string;
  rightVertical?: string;
  bottomLine?: string;
};

export const SafePoetryFrame: React.FC<SafePoetryFrameProps> = ({
  nickname,
  topLabel,
  leftVertical,
  rightVertical,
  bottomLine,
}) => {
  const resolvedNickname = nickname.replace(/xcai43323/gi, "CleanKsen");
  const resolvedTopLabel = (topLabel ?? `${resolvedNickname} · AUDIO DIARY`).replace(
    /@?xcai43323/gi,
    "CLEANKSEN"
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="absolute left-[96px] top-[96px] h-[1728px] w-[888px] rounded-[36px] border border-white/18" />
      <div className="absolute left-1/2 top-[112px] -translate-x-1/2 text-[18px] uppercase tracking-[0.22em] text-white/42">
        {resolvedTopLabel}
      </div>
      <div
        className="absolute left-[116px] top-[360px] text-[16px] uppercase tracking-[0.16em] text-white/30"
        style={{writingMode: "vertical-rl", textOrientation: "mixed"}}
      >
        {leftVertical ?? "THE RAIN WRITES SOFTLY ON THE GLASS WHILE THE MUSIC REMEMBERS"}
      </div>
      <div
        className="absolute right-[116px] top-[360px] text-[16px] uppercase tracking-[0.16em] text-white/26"
        style={{writingMode: "vertical-rl", textOrientation: "mixed"}}
      >
        {rightVertical ?? "STREETLIGHTS RETURN AS QUIET STARS BENEATH THE MIDNIGHT SKY"}
      </div>
      {bottomLine ? (
        <div className="absolute bottom-[112px] left-1/2 -translate-x-1/2 text-[16px] uppercase tracking-[0.16em] text-white/24">
          {bottomLine}
        </div>
      ) : null}
    </div>
  );
};
