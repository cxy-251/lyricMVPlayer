import type {TimedLyricLine} from "../types";

export const isDecorativeLyric = (text: string): boolean => /^[♪\s]+$/.test(text);

export const findActiveLine = (lyrics: TimedLyricLine[], currentMs: number): TimedLyricLine | null =>
  lyrics.find((line) => currentMs >= line.startMs && currentMs < line.endMs) ?? lyrics[0] ?? null;

export const findActiveLyricIndex = (lyrics: TimedLyricLine[], currentMs: number): number => {
  const activeIndex = lyrics.findIndex((line) => currentMs >= line.startMs && currentMs < line.endMs);
  if (activeIndex >= 0) {
    return activeIndex;
  }

  const firstFuture = lyrics.findIndex((line) => currentMs < line.startMs);
  return firstFuture > 0 ? firstFuture - 1 : 0;
};

export const findPreviousMeaningfulLine = (
  lyrics: TimedLyricLine[],
  startIndex: number
): TimedLyricLine | null => {
  for (let index = startIndex; index >= 0; index -= 1) {
    if (!isDecorativeLyric(lyrics[index].text)) {
      return lyrics[index];
    }
  }

  return null;
};

export const findNextMeaningfulLine = (
  lyrics: TimedLyricLine[],
  startIndex: number
): TimedLyricLine | null => {
  for (let index = startIndex; index < lyrics.length; index += 1) {
    if (!isDecorativeLyric(lyrics[index].text)) {
      return lyrics[index];
    }
  }

  return null;
};

export const getCurrentLyricFontSize = (text: string): number => {
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
