import React from "react";
import {cn} from "../../../lib/cn";

type TopSongInfoProps = {
  label: string;
  title: string;
  artist: string;
};

export const TopSongInfo: React.FC<TopSongInfoProps> = ({label, title, artist}) => {
  const titleSize = title.length > 34 ? "text-[42px]" : "text-[46px]";

  return (
    <div className="absolute left-[120px] top-[205px] z-40 flex h-[150px] w-[760px] flex-col">
      <div className="text-[20px] uppercase tracking-[0.18em] text-white/60 [text-shadow:0_4px_18px_rgba(0,0,0,0.55),0_0_24px_rgba(80,130,255,0.16)]">
        {label}
      </div>
      <div
        className={cn(
          "mt-[10px] line-clamp-2 font-semibold leading-[1.05] text-white/95 [text-shadow:0_4px_18px_rgba(0,0,0,0.55),0_0_24px_rgba(80,130,255,0.16)]",
          titleSize
        )}
      >
        {title}
      </div>
      <div className="mt-[8px] truncate text-[28px] text-white/78 [text-shadow:0_4px_18px_rgba(0,0,0,0.55),0_0_24px_rgba(80,130,255,0.16)]">
        {artist}
      </div>
    </div>
  );
};
