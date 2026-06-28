import {sampleAudioFeature} from "../domain/audio-features";
import {findActiveLine} from "../domain/lyrics";
import {clamp} from "../lib/math";
import type {SongLibraryItem} from "../types";

export const useReactiveSignals = ({
  currentSong,
  currentTimeMs,
  effectiveLyricTimeMs,
  audioEnergy,
  isInteractiveAudio,
}: {
  currentSong: SongLibraryItem;
  currentTimeMs: number;
  effectiveLyricTimeMs: number;
  audioEnergy: number;
  isInteractiveAudio: boolean;
}) => {
  const activeLine = findActiveLine(currentSong.lyrics, effectiveLyricTimeMs);
  const activeSpan = activeLine ? Math.max(1, activeLine.endMs - activeLine.startMs) : 1;
  const lineProgress = activeLine ? clamp((effectiveLyricTimeMs - activeLine.startMs) / activeSpan, 0, 1) : 0;
  const fallbackEnergy = activeLine
    ? 0.26 + Math.sin(lineProgress * Math.PI) * 0.74
    : 0.2 + (Math.sin(currentTimeMs * 0.0016) * 0.5 + 0.5) * 0.08;
  const sampledFeature = sampleAudioFeature(currentSong.audioFeatures, currentTimeMs);

  return {
    lineProgress,
    fallbackEnergy,
    sampledFeature,
    reactiveBass: sampledFeature?.bass ?? fallbackEnergy * 0.82,
    reactiveMid: sampledFeature?.mid ?? fallbackEnergy * 0.72,
    reactiveHigh: sampledFeature?.high ?? fallbackEnergy * 0.62,
    reactiveEnergy: sampledFeature?.energy ?? fallbackEnergy,
    reactiveBeat: sampledFeature?.beat ?? 0,
    reactiveOnset: sampledFeature?.onset ?? 0,
    waveformEnergy: sampledFeature?.energy ?? (isInteractiveAudio ? audioEnergy : fallbackEnergy),
  };
};
