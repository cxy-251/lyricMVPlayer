import {useEffect, useRef, type RefObject} from 'react';

import {configureCurveCanvas, renderCurveFrame, type CurveViewport} from './curveRenderer';
import type {
  CurveDefinition,
  CurveParameters,
  SampledCurveScene,
} from './types';

type SeekRequest = {token: number; value: number};

type CurveAnimationInput = {
  definition: CurveDefinition;
  fullTrajectory: boolean;
  onComplete: () => void;
  onProgress: (progress: number) => void;
  parameters: CurveParameters;
  paused: boolean;
  restartToken: number;
  scene: SampledCurveScene;
  seekRequest: SeekRequest;
  showGuides: boolean;
  speed: number;
};

type Runtime = {
  completed: boolean;
  lastPublishedAt: number;
  lastTimestamp: number;
  pendingSeek: number | null;
  progress: number;
  restartRequested: boolean;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function useCurveAnimation(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  input: CurveAnimationInput,
) {
  const inputRef = useRef(input);
  const runtimeRef = useRef<Runtime>({
    completed: false,
    lastPublishedAt: 0,
    lastTimestamp: 0,
    pendingSeek: null,
    progress: 0,
    restartRequested: true,
  });
  inputRef.current = input;

  useEffect(() => {
    runtimeRef.current.restartRequested = true;
  }, [input.definition.id, input.restartToken, input.scene]);

  useEffect(() => {
    runtimeRef.current.pendingSeek = clamp01(input.seekRequest.value);
  }, [input.seekRequest.token, input.seekRequest.value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    let animationFrame = 0;
    let viewport: CurveViewport = {width: 1, height: 1, pixelRatio: 1};

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) return;
      viewport = {
        width: bounds.width,
        height: bounds.height,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      };
      configureCurveCanvas(canvas, viewport.width, viewport.height, viewport.pixelRatio);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const render = (timestamp: number) => {
      const currentInput = inputRef.current;
      const runtime = runtimeRef.current;

      if (runtime.restartRequested) {
        runtime.progress = 0;
        runtime.completed = false;
        runtime.lastTimestamp = timestamp;
        runtime.restartRequested = false;
        currentInput.onProgress(0);
      }
      if (runtime.pendingSeek !== null) {
        runtime.progress = runtime.pendingSeek;
        runtime.completed = runtime.progress >= 1;
        runtime.pendingSeek = null;
      }

      const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - runtime.lastTimestamp) / 1000));
      runtime.lastTimestamp = timestamp;
      if (!currentInput.paused && !runtime.completed) {
        runtime.progress = clamp01(
          runtime.progress + deltaSeconds * currentInput.speed / currentInput.definition.duration,
        );
        if (runtime.progress >= 1) {
          runtime.completed = true;
          currentInput.onProgress(1);
          runtime.lastPublishedAt = timestamp;
          currentInput.onComplete();
        }
      }

      const motionProgress = clamp01((runtime.progress - 0.08) / 0.8);
      const t = currentInput.scene.period * motionProgress;
      let frameParameters = currentInput.parameters;
      if (currentInput.definition.parameterMode === 'fourier' && runtime.progress < 0.08) {
        const revealProgress = clamp01(runtime.progress / 0.08);
        const revealedTerms = Math.max(
          3,
          Math.round(3 + (currentInput.parameters.epicycles - 3) * revealProgress),
        );
        frameParameters = {...currentInput.parameters, epicycles: revealedTerms};
      }
      const currentSample = currentInput.definition.sample(t, frameParameters);
      renderCurveFrame(context, {
        accent: currentInput.definition.accent,
        construction: currentSample.construction,
        drawTrajectory: currentInput.definition.traceCurve !== false,
        fullTrajectory: currentInput.fullTrajectory,
        motionProgress,
        scene: currentInput.scene,
        showGuides: currentInput.showGuides,
        timelineProgress: runtime.progress,
        viewport,
      });

      if (timestamp - runtime.lastPublishedAt >= 50) {
        runtime.lastPublishedAt = timestamp;
        currentInput.onProgress(runtime.progress);
      }
      animationFrame = window.requestAnimationFrame(render);
    };

    animationFrame = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [canvasRef]);
}
