import React from "react";

export const ReadabilityLayer: React.FC = () => {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <div className="absolute left-0 right-0 top-0 h-[360px] bg-gradient-to-b from-black/42 via-black/16 to-transparent" />
      <div className="absolute left-[120px] top-[1020px] h-[340px] w-[840px] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.24),rgba(0,0,0,0.08)_52%,transparent_76%)]" />
      <div className="absolute right-[110px] top-[300px] h-[360px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.22),rgba(0,0,0,0.06)_50%,transparent_74%)] blur-[24px]" />
      <div className="absolute bottom-0 left-0 right-0 h-[560px] bg-gradient-to-t from-black/56 via-black/20 to-transparent" />
    </div>
  );
};
