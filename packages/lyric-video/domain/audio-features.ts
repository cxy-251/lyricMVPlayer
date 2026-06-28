import {clamp} from "../lib/math";
import type {AudioFeatureFrame, AudioFeatureTrack} from "../types";

export const sampleAudioFeature = (
  audioFeatures: AudioFeatureTrack | undefined,
  currentMs: number
): AudioFeatureFrame | null => {
  if (!audioFeatures || audioFeatures.frames.length === 0) {
    return null;
  }

  const frameDurationMs = 1000 / audioFeatures.frameRate;
  const index = clamp(Math.round(currentMs / frameDurationMs), 0, audioFeatures.frames.length - 1);
  return audioFeatures.frames[index];
};
