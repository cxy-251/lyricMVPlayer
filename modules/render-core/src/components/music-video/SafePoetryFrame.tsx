import React from "react";

type SafePoetryFrameProps = {
  nickname: string;
};

export const SafePoetryFrame: React.FC<SafePoetryFrameProps> = ({nickname}) => {
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="absolute left-[96px] top-[96px] h-[1728px] w-[888px] rounded-[36px] border border-white/18" />
      <div className="absolute left-1/2 top-[112px] -translate-x-1/2 text-[18px] uppercase tracking-[0.22em] text-white/42">
        {nickname} · AUDIO DIARY
      </div>
      <div
        className="absolute left-[116px] top-[360px] text-[16px] uppercase tracking-[0.16em] text-white/30"
        style={{writingMode: "vertical-rl", textOrientation: "mixed"}}
      >
        THE RAIN WRITES SOFTLY ON THE GLASS WHILE THE MUSIC REMEMBERS
      </div>
      <div
        className="absolute right-[116px] top-[360px] text-[16px] uppercase tracking-[0.16em] text-white/26"
        style={{writingMode: "vertical-rl", textOrientation: "mixed"}}
      >
        STREETLIGHTS RETURN AS QUIET STARS BENEATH THE MIDNIGHT SKY
      </div>
    </div>
  );
};
