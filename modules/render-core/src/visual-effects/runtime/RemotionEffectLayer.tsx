import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {continueRender, delayRender, useCurrentFrame, useVideoConfig} from "remotion";

import {getVisualEffectDefinition} from "../registry";
import type {EffectInputState, VisualEffectConfigMap, VisualEffectId, VisualEffectScene} from "../types";

const legacyRecipeIds: Record<string, VisualEffectId> = {
  "lyric/particle-galaxy": "particle-galaxy",
  "lyric/neon-energy-tunnel": "neon-energy-tunnel",
  "lyric/fluid-cursor-field": "fluid-cursor-field",
  "lyric/physics-cloth-banner": "physics-cloth-banner",
  "lyric/particle-morphing-field": "particle-morphing-field",
};

const toEffectId = (effectId?: VisualEffectId, recipeId?: string): VisualEffectId => {
  if (effectId) return effectId;
  if (recipeId && legacyRecipeIds[recipeId]) return legacyRecipeIds[recipeId];
  return "particle-galaxy";
};

const createRemotionInput = (frame: number, fps: number): EffectInputState => {
  const time = frame / fps;
  return {
    pointerX: Math.sin(time * 0.63) * 0.42,
    pointerY: Math.cos(time * 0.51) * 0.34,
    dragTarget: 0.35 + Math.sin(time * 0.7) * 0.18,
    wheel: Math.sin(time * 0.29) * 0.2,
    clickCount: Math.floor(time / 4),
  };
};

export function RemotionEffectLayer({
  effectId,
  recipeId,
  seed = 1307,
}: {
  audioFeatures?: unknown;
  effectId?: VisualEffectId;
  recipe?: unknown;
  recipeId?: string;
  seed?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<VisualEffectScene<VisualEffectConfigMap[VisualEffectId]> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const [renderHandle] = useState(() => delayRender("Initialize internal visual effect layer"));
  const renderReady = useRef(false);
  const resolvedEffectId = toEffectId(effectId, recipeId);
  const definition = useMemo(() => getVisualEffectDefinition(resolvedEffectId), [resolvedEffectId]);

  const handleReady = useCallback(() => {
    if (renderReady.current) return;
    renderReady.current = true;
    continueRender(renderHandle);
  }, [renderHandle]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = definition.createScene({config: definition.defaultConfig, seed});
    sceneRef.current = scene;
    scene.mount(host);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      scene.resize({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        pixelRatio: 1,
      });
    };

    const observer = new ResizeObserver(resize);
    resizeObserverRef.current = observer;
    observer.observe(host);
    resize();
    handleReady();

    return () => {
      observer.disconnect();
      scene.dispose();
      sceneRef.current = null;
      resizeObserverRef.current = null;
    };
  }, [definition, handleReady, seed]);

  useEffect(() => {
    const host = hostRef.current;
    const scene = sceneRef.current;
    if (!host || !scene) return;

    const viewport = {
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      pixelRatio: 1,
    };
    scene.resize(viewport);
    scene.setConfig(definition.defaultConfig);
    scene.update({
      clock: {
        time: frame / fps,
        delta: 1 / fps,
        frame,
        fps,
      },
      viewport,
      input: createRemotionInput(frame, fps),
    });
  }, [definition, fps, frame]);

  return (
    <div
      className="visual-effect-canvas visual-effect-canvas--remotion"
      ref={hostRef}
      style={{height: "100%", width: "100%"}}
    />
  );
}
