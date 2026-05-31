import React from "react";
import {spring, useCurrentFrame} from "remotion";

import type {TimedLyricLine} from "../../types";
import {cn} from "../../lib/cn";

type LyricCarouselProps = {
  lyrics: TimedLyricLine[];
  fps: number;
  currentTimeMs: number;
  onSeek?: (targetMs: number) => void;
  interactiveHint?: boolean;
};

const isDecorativeLyric = (text: string): boolean => /^[♪\s]+$/.test(text);

const findActiveIndex = (lyrics: TimedLyricLine[], currentMs: number): number => {
  const activeIndex = lyrics.findIndex((line) => currentMs >= line.startMs && currentMs < line.endMs);
  if (activeIndex >= 0) {
    return activeIndex;
  }

  const firstFuture = lyrics.findIndex((line) => currentMs < line.startMs);
  return firstFuture > 0 ? firstFuture - 1 : 0;
};

const findPreviousMeaningfulLine = (lyrics: TimedLyricLine[], startIndex: number): TimedLyricLine | null => {
  for (let index = startIndex; index >= 0; index -= 1) {
    if (!isDecorativeLyric(lyrics[index].text)) {
      return lyrics[index];
    }
  }

  return null;
};

const findNextMeaningfulLine = (lyrics: TimedLyricLine[], startIndex: number): TimedLyricLine | null => {
  for (let index = startIndex; index < lyrics.length; index += 1) {
    if (!isDecorativeLyric(lyrics[index].text)) {
      return lyrics[index];
    }
  }

  return null;
};

const getCurrentFontSize = (text: string): number => {
  if (text.length <= 24) {
    return 82;
  }

  if (text.length <= 42) {
    return 74;
  }

  if (text.length <= 58) {
    return 68;
  }

  return 62;
};

export const LyricCarousel: React.FC<LyricCarouselProps> = ({
  lyrics,
  fps,
  currentTimeMs,
  onSeek
}) => {
  const frame = useCurrentFrame();
  if (lyrics.length === 0) {
    return (
      <div className="absolute left-[120px] top-[1110px] z-40 flex h-[250px] w-[840px] items-center justify-center text-center text-[44px] font-bold leading-[1.1] text-white/64 [text-shadow:0_8px_28px_rgba(0,0,0,0.62)]">
        Lyrics unavailable
      </div>
    );
  }

  const activeIndex = findActiveIndex(lyrics, currentTimeMs);
  const rawCurrentLine = lyrics[activeIndex] ?? lyrics[0];
  const currentLine = isDecorativeLyric(rawCurrentLine.text)
    ? findNextMeaningfulLine(lyrics, activeIndex + 1) ?? rawCurrentLine
    : rawCurrentLine;
  const currentIndex = lyrics.findIndex((line) => line === currentLine);
  const previousLine = findPreviousMeaningfulLine(lyrics, currentIndex - 1);
  const nextLine = findNextMeaningfulLine(lyrics, currentIndex + 1);
  const transition = spring({
    frame,
    fps,
    config: {
      damping: 22,
      stiffness: 120
    }
  });
  const currentFontSize = getCurrentFontSize(currentLine.text);

  return (
    <>
      <div
        className="absolute left-[120px] top-[1110px] z-40 h-[250px] w-[840px] overflow-hidden"
        onWheel={(event) => {
          if (!onSeek) {
            return;
          }

          event.preventDefault();
          onSeek(currentTimeMs + event.deltaY * 16);
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[24px]">
          <button
            className="max-w-[760px] truncate border-0 bg-transparent px-0 text-center text-[38px] leading-[1.2] text-white/26 [text-shadow:0_4px_18px_rgba(0,0,0,0.45),0_0_24px_rgba(80,130,255,0.16)]"
            onClick={() => previousLine && onSeek?.(previousLine.startMs)}
            style={{visibility: previousLine ? "visible" : "hidden"}}
          >
            {previousLine?.text ?? ""}
          </button>
          <button
            className={cn(
              "max-w-[840px] border-0 bg-transparent px-0 text-center font-bold leading-[1.08] text-white/96 [text-shadow:0_8px_28px_rgba(0,0,0,0.62)]",
              currentFontSize > 58 ? "text-[54px]" : "text-[48px]"
            )}
            onClick={() => onSeek?.(currentLine.startMs)}
            style={{
              transform: `perspective(1200px) rotateX(${(1 - transition) * 10}deg) translateY(${(1 - transition) * 6}px) scale(${0.985 + transition * 0.015})`
            }}
          >
            {currentLine.text}
          </button>
          <button
            className="max-w-[760px] truncate border-0 bg-transparent px-0 text-center text-[38px] leading-[1.2] text-white/22 [text-shadow:0_4px_18px_rgba(0,0,0,0.45),0_0_24px_rgba(80,130,255,0.16)]"
            onClick={() => nextLine && onSeek?.(nextLine.startMs)}
            style={{visibility: nextLine ? "visible" : "hidden"}}
          >
            {nextLine?.text ?? ""}
          </button>
        </div>
      </div>
    </>
  );
};
