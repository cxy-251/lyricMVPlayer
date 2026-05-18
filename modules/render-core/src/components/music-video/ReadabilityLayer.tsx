import React from "react";

export const ReadabilityLayer: React.FC = () => {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <div className="absolute left-0 right-0 top-0 h-[360px] bg-gradient-to-b from-black/45 via-black/18 to-transparent" />
      <div className="absolute left-[80px] top-[1040px] h-[300px] w-[920px] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.32),rgba(0,0,0,0.10)_48%,transparent_75%)]" />
      <div className="absolute bottom-0 left-0 right-0 h-[560px] bg-gradient-to-t from-black/60 via-black/24 to-transparent" />
    </div>
  );
};
