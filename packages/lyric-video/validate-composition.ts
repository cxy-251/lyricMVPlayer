import type {LyricVideoCompositionProps, TimedLyricLine} from "./types";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isTimedLyricLine = (value: TimedLyricLine): boolean =>
  Number.isFinite(value.startMs) &&
  Number.isFinite(value.endMs) &&
  value.startMs >= 0 &&
  value.endMs > value.startMs &&
  isNonEmptyString(value.text);

export const validateCompositionProps = (
  value: LyricVideoCompositionProps
): {ok: true} | {ok: false; errors: string[]} => {
  const errors: string[] = [];

  if (!isNonEmptyString(value.title)) {
    errors.push("title must be a non-empty string");
  }

  if (!isNonEmptyString(value.artist)) {
    errors.push("artist must be a non-empty string");
  }

  if (!Number.isInteger(value.durationInFrames) || value.durationInFrames <= 0) {
    errors.push("durationInFrames must be a positive integer");
  }

  if (!Number.isInteger(value.fps) || value.fps <= 0) {
    errors.push("fps must be a positive integer");
  }

  if (!value.background) {
    errors.push("background is required");
  } else {
    if (!["image", "video", "color"].includes(value.background.kind)) {
      errors.push("background.kind must be image, video, or color");
    }

    if (value.background.kind === "color" && !isNonEmptyString(value.background.color)) {
      errors.push("background.color is required when background.kind is color");
    }

    if (
      (value.background.kind === "image" || value.background.kind === "video") &&
      !isNonEmptyString(value.background.src)
    ) {
      errors.push("background.src is required when background.kind is image or video");
    }
  }

  if (!Array.isArray(value.lyrics) || value.lyrics.length === 0) {
    errors.push("lyrics must be a non-empty array");
  } else {
    value.lyrics.forEach((line, index) => {
      if (!isTimedLyricLine(line)) {
        errors.push(`lyrics[${index}] is invalid`);
      }
    });
  }

  if (errors.length > 0) {
    return {ok: false, errors};
  }

  return {ok: true};
};
