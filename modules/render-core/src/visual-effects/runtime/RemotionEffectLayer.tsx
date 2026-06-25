import React, {useCallback, useMemo, useRef, useState} from "react";
import {continueRender, delayRender, useCurrentFrame, useVideoConfig} from "remotion";
import {
  getVisualEffectRecipe,
  visualEffectAtoms,
  VisualEffectStage,
  type EffectAudioFrame,
  type VisualEffectRecipe,
} from "@lyric-mv/visual-effects";

import {sampleAudioFeature} from "../../domain/audio-features";
import type {AudioFeatureTrack} from "../../types";
import type {VisualEffectId} from "../types";

const legacyRecipeIds: Record<VisualEffectId, string> = {
  "particle-galaxy": "lyric/particle-galaxy",
  "neon-energy-tunnel": "lyric/neon-energy-tunnel",
  "fluid-cursor-field": "lyric/fluid-cursor-field",
  "physics-cloth-banner": "lyric/physics-cloth-banner",
  "particle-morphing-field": "lyric/particle-morphing-field",
};

const toAudioFrame = (audioFeatures: AudioFeatureTrack | undefined, frame: number, fps: number): EffectAudioFrame | null => {
  const sampled = sampleAudioFeature(audioFeatures, frame / fps * 1000);
  return sampled ? {
    bass: sampled.bass,
    mid: sampled.mid,
    high: sampled.high,
    energy: sampled.energy,
    beat: sampled.beat,
    onset: sampled.onset,
  } : null;
};

export function RemotionEffectLayer({
  audioFeatures,
  effectId,
  recipe,
  recipeId,
  seed = 1307,
}: {
  audioFeatures?: AudioFeatureTrack;
  effectId?: VisualEffectId;
  recipe?: VisualEffectRecipe;
  recipeId?: string;
  seed?: number;
}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const [renderHandle] = useState(() => delayRender("Initialize visual effect WebGL stage"));
  const renderReady = useRef(false);
  const resolvedRecipe = useMemo(() => recipe ?? getVisualEffectRecipe(recipeId ?? legacyRecipeIds[effectId ?? "particle-galaxy"]), [effectId, recipe, recipeId]);
  const audio = useMemo(() => toAudioFrame(audioFeatures, frame, fps), [audioFeatures, fps, frame]);
  const handleReady = useCallback(() => {
    if (renderReady.current) return;
    renderReady.current = true;
    continueRender(renderHandle);
  }, [renderHandle]);

  return (
    <VisualEffectStage
      atoms={visualEffectAtoms}
      audio={audio}
      className="visual-effect-canvas visual-effect-canvas--remotion"
      fps={fps}
      frame={frame}
      mode="remotion"
      onReady={handleReady}
      recipe={resolvedRecipe}
      seed={seed}
    />
  );
}
