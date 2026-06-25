import React, {useEffect, useLayoutEffect, useMemo, useRef} from "react";
import * as THREE from "three";

import type {EffectAudioFrame, EffectPointer, VisualEffectAtom, VisualEffectMode, VisualEffectRecipe} from "../types";
import {SILENT_AUDIO_FRAME} from "../types";
import {LayerCompositor} from "./LayerCompositor";

export type VisualEffectStageProps = {
  atoms: VisualEffectAtom[];
  recipe: VisualEffectRecipe;
  mode: VisualEffectMode;
  frame?: number;
  fps?: number;
  audio?: EffectAudioFrame | null;
  seed?: number;
  className?: string;
  onReady?: () => void;
};

const neutralPointer = (): EffectPointer => ({x: 0, y: 0, pressed: 0, wheel: 0});

export const VisualEffectStage: React.FC<VisualEffectStageProps> = ({
  atoms,
  recipe,
  mode,
  frame = 0,
  fps = 60,
  audio,
  seed = 1307,
  className,
  onReady,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const compositorRef = useRef<LayerCompositor | null>(null);
  const pointerRef = useRef<EffectPointer>(neutralPointer());
  const audioRef = useRef(audio ?? SILENT_AUDIO_FRAME);
  const onReadyRef = useRef(onReady);
  audioRef.current = audio ?? SILENT_AUDIO_FRAME;
  onReadyRef.current = onReady;
  const recipeKey = useMemo(() => JSON.stringify(recipe), [recipe]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: mode === "remotion",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const compositor = new LayerCompositor({renderer, atoms, recipe, seed});
    compositorRef.current = compositor;
    let viewport = {width: 1, height: 1, pixelRatio: 1};
    let raf = 0;
    let readyTimer = 0;
    let ready = false;
    const startedAt = performance.now();
    const render = (nextFrame: number) => {
      compositor.render({
        mode,
        frame: nextFrame,
        fps,
        time: nextFrame / fps,
        delta: 1 / fps,
        viewport,
        pointer: pointerRef.current,
        audio: audioRef.current,
      });
      if (!ready) {
        ready = true;
        if (mode === "remotion") {
          readyTimer = window.setTimeout(() => onReadyRef.current?.(), 60);
        } else {
          onReadyRef.current?.();
        }
      }
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const parentRect = host.parentElement?.getBoundingClientRect();
      const width = rect.width || parentRect?.width || 0;
      const height = rect.height || parentRect?.height || 0;
      if (width < 2 || height < 2) return false;
      viewport = {
        width: Math.round(width),
        height: Math.round(height),
        pixelRatio: Math.min(2, window.devicePixelRatio || 1),
      };
      renderer.setPixelRatio(viewport.pixelRatio);
      renderer.setSize(viewport.width, viewport.height, false);
      compositor.resize(viewport);
      return true;
    };
    const observer = new ResizeObserver(() => {
      if (resize() && mode === "remotion") render(frame);
    });
    observer.observe(host);

    if (mode === "interactive") {
      resize();
      const tick = (now: number) => {
        render(Math.floor(((now - startedAt) / 1000) * fps));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else {
      const renderWhenSized = () => {
        if (resize()) render(frame);
        else raf = requestAnimationFrame(renderWhenSized);
      };
      raf = requestAnimationFrame(renderWhenSized);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(readyTimer);
      observer.disconnect();
      compositor.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      compositorRef.current = null;
    };
  }, [atoms, fps, mode, recipeKey, seed]);

  useEffect(() => {
    const compositor = compositorRef.current;
    const host = hostRef.current;
    if (mode !== "remotion" || !compositor || !host) return;
    compositor.render({
      mode,
      frame,
      fps,
      time: frame / fps,
      delta: 1 / fps,
      viewport: {width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight), pixelRatio: 1},
      pointer: neutralPointer(),
      audio: audio ?? SILENT_AUDIO_FRAME,
    });
  }, [audio, fps, frame, mode]);

  const updatePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointerRef.current.y = 1 - ((event.clientY - rect.top) / Math.max(1, rect.height)) * 2;
  };

  return (
    <div
      className={className}
      ref={hostRef}
      role="presentation"
      style={{height: "100%", overflow: "hidden", position: "relative", touchAction: "none", width: "100%"}}
      onPointerDown={(event) => {
        updatePointer(event);
        pointerRef.current.pressed = 1;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={updatePointer}
      onPointerUp={(event) => {
        pointerRef.current.pressed = 0;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerLeave={() => {
        pointerRef.current.pressed = 0;
      }}
      onWheel={(event) => {
        event.preventDefault();
        pointerRef.current.wheel = THREE.MathUtils.clamp(pointerRef.current.wheel + Math.sign(event.deltaY) * -0.18, -1, 1);
      }}
    />
  );
};
