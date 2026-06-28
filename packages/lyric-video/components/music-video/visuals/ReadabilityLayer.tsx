import React from "react";

export const ReadabilityLayer: React.FC = () => {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <div className="absolute left-0 right-0 top-0 h-[360px] bg-gradient-to-b from-black/42 via-black/16 to-transparent" />
      <div className="absolute left-0 right-0 top-[980px] h-[430px] bg-gradient-to-b from-transparent via-black/16 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-[560px] bg-gradient-to-t from-black/56 via-black/20 to-transparent" />
    </div>
  );
};
