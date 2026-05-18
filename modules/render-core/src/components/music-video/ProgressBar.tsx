import React, {useRef, useState} from "react";

type ProgressBarProps = {
  currentTimeMs: number;
  durationMs: number;
  onSeek?: (targetMs: number) => void;
};

const formatTime = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
};

export const ProgressBar: React.FC<ProgressBarProps> = ({currentTimeMs, durationMs, onSeek}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const progress = durationMs > 0 ? Math.max(0, Math.min(1, currentTimeMs / durationMs)) : 0;

  const updateSeek = (clientX: number) => {
    if (!trackRef.current || !onSeek || durationMs <= 0) {
      return;
    }

    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * durationMs);
  };

  return (
    <div className="absolute left-[120px] top-[1450px] z-40 h-[70px] w-[840px]">
      <div
        ref={trackRef}
        className="absolute left-0 right-0 top-[8px] h-[2px] cursor-pointer rounded-full bg-white/24"
        onClick={(event) => updateSeek(event.clientX)}
        onPointerDown={(event) => {
          setDragging(true);
          updateSeek(event.clientX);
        }}
        onPointerMove={(event) => {
          if (dragging) {
            updateSeek(event.clientX);
          }
        }}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
      >
        <div
          className="relative h-full rounded-full bg-gradient-to-r from-white/95 to-blue-300/95 shadow-[0_0_18px_rgba(118,164,255,0.36)]"
          style={{width: `${progress * 100}%`}}
        >
          <div className="absolute right-0 top-1/2 h-[10px] w-[10px] -translate-y-1/2 translate-x-1/2 rounded-full bg-blue-100 shadow-[0_0_16px_rgba(126,174,255,0.66)]" />
        </div>
      </div>
      <div className="absolute left-0 right-0 top-[24px] flex justify-between text-[18px] text-white/72 [text-shadow:0_4px_18px_rgba(0,0,0,0.45)]">
        <span>{formatTime(currentTimeMs)}</span>
        <span>{formatTime(durationMs)}</span>
      </div>
    </div>
  );
};
