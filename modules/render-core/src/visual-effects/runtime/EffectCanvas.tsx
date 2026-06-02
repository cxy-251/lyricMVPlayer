import React, {useEffect, useMemo, useRef} from "react";

import {getVisualEffectDefinition} from "../registry";
import type {EffectInputState, VisualEffectConfigMap, VisualEffectId, VisualEffectScene} from "../types";

type EffectCanvasProps = {
  effectId: VisualEffectId;
  config: VisualEffectConfigMap[VisualEffectId];
  className?: string;
  seed?: number;
};

const createInitialInput = (): EffectInputState => ({
  pointerX: 0,
  pointerY: 0,
  dragTarget: 0,
  wheel: 0,
  clickCount: 0,
});

export function EffectCanvas({
  className,
  config,
  effectId,
  seed = 1307,
}: EffectCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<VisualEffectScene<VisualEffectConfigMap[VisualEffectId]> | null>(null);
  const inputRef = useRef<EffectInputState>(createInitialInput());
  const configRef = useRef(config);
  configRef.current = config;

  const definition = useMemo(() => getVisualEffectDefinition(effectId), [effectId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    const scene = definition.createScene({config: configRef.current, seed});
    sceneRef.current = scene;
    scene.mount(host);

    let animationFrame = 0;
    let previousTime = performance.now();
    const resize = () => {
      const rect = host.getBoundingClientRect();
      scene.resize({
        width: rect.width,
        height: rect.height,
        pixelRatio: window.devicePixelRatio || 1,
      });
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const tick = (now: number) => {
      const delta = Math.min(0.05, Math.max(0.001, (now - previousTime) / 1000));
      previousTime = now;
      scene.setConfig(configRef.current);
      scene.update({
        clock: {
          time: now / 1000,
          delta,
        },
        viewport: {
          width: host.clientWidth,
          height: host.clientHeight,
          pixelRatio: window.devicePixelRatio || 1,
        },
        input: inputRef.current,
      });
      inputRef.current.wheel *= Math.exp(-2.6 * delta);
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [definition, seed]);

  const updatePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    inputRef.current.pointerX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    inputRef.current.pointerY = -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
  };

  return (
    <div
      className={className}
      ref={hostRef}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        updatePointer(event);
        inputRef.current.dragTarget = 1;
      }}
      onPointerLeave={() => {
        inputRef.current.dragTarget = 0;
      }}
      onPointerMove={updatePointer}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        inputRef.current.dragTarget = 0;
        inputRef.current.clickCount += 1;
      }}
      onWheel={(event) => {
        event.preventDefault();
        const direction = event.deltaY > 0 ? -1 : 1;
        inputRef.current.wheel = Math.min(1.35, Math.max(-1.35, inputRef.current.wheel + direction * 0.22));
      }}
      role="presentation"
    />
  );
}
