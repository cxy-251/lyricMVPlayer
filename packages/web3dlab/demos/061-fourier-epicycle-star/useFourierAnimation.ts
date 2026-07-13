import {useEffect, useRef, type RefObject} from 'react';

import {
  configureCanvas,
  createFourierViewport,
  drawEndpoint,
  drawEpicycleChain,
  drawMathematicalPaper,
  drawTargetPath,
  drawTrailSegment,
  modelToScreen,
  prepareContext,
  type FourierViewport,
} from './fourierCanvas';
import {evaluateEpicycleChain} from './fourier';
import type {
  ComplexPoint,
  FourierCoefficient,
  FourierSceneOptions,
} from './types';

const TAU = Math.PI * 2;

type FourierAnimationOptions = FourierSceneOptions & {
  paused: boolean;
  speed: number;
  trailLength: number;
};

type FourierAnimationInput = {
  coefficients: FourierCoefficient[];
  onComplete: () => void;
  onProgress: (progress: number) => void;
  options: FourierAnimationOptions;
  restartToken: number;
  seekRequest: {token: number; value: number};
  targetPath: ComplexPoint[];
};

type AnimationRuntime = {
  completed: boolean;
  lastPublishedAt: number;
  lastTimestamp: number;
  pendingSeek: number | null;
  previousEndpoint: ComplexPoint | null;
  progress: number;
  rebuildTrailRequested: boolean;
  restartRequested: boolean;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (start: number, end: number, value: number) => {
  const progress = clamp01((value - start) / (end - start));
  return progress * progress * (3 - 2 * progress);
};

const clearCanvas = (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.restore();
};

function fadeTrail(
  context: CanvasRenderingContext2D,
  viewport: FourierViewport,
  deltaSeconds: number,
  speed: number,
  trailLength: number,
) {
  if (trailLength >= 99.5) return;
  const persistenceSeconds = Math.max(0.18, trailLength / 100 / Math.max(speed, 0.01));
  const fadeAlpha = 1 - Math.exp(-3 * deltaSeconds / persistenceSeconds);
  context.save();
  context.globalCompositeOperation = 'destination-out';
  context.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
  context.fillRect(0, 0, viewport.width, viewport.height);
  context.restore();
}

export function useFourierAnimation(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  input: FourierAnimationInput,
) {
  const inputRef = useRef(input);
  const runtimeRef = useRef<AnimationRuntime>({
    completed: false,
    lastPublishedAt: 0,
    lastTimestamp: 0,
    pendingSeek: null,
    previousEndpoint: null,
    progress: 0,
    rebuildTrailRequested: false,
    restartRequested: true,
  });
  inputRef.current = input;

  useEffect(() => {
    runtimeRef.current.restartRequested = true;
  }, [input.coefficients, input.restartToken]);

  useEffect(() => {
    runtimeRef.current.pendingSeek = clamp01(input.seekRequest.value);
  }, [input.seekRequest.token, input.seekRequest.value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const trailCanvas = document.createElement('canvas');
    const trailContext = trailCanvas.getContext('2d');
    if (!trailContext) return;

    let animationFrame = 0;
    let viewport = createFourierViewport(1, 1, 1);

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      viewport = createFourierViewport(bounds.width, bounds.height, pixelRatio);
      configureCanvas(canvas, viewport.width, viewport.height, pixelRatio);
      configureCanvas(trailCanvas, viewport.width, viewport.height, pixelRatio);
      prepareContext(context, viewport);
      prepareContext(trailContext, viewport);
      runtimeRef.current.rebuildTrailRequested = true;
    };

    const rebuildTrail = (timelineProgress: number) => {
      clearCanvas(trailCanvas, trailContext);
      const currentInput = inputRef.current;
      const motionProgress = clamp01((timelineProgress - 0.08) / 0.8);
      const retainedFraction = currentInput.options.trailLength / 100;
      const startProgress = retainedFraction >= 0.995
        ? 0
        : Math.max(0, motionProgress - retainedFraction);
      const stepCount = Math.max(2, Math.ceil((motionProgress - startProgress) * 900));
      let previousPoint: ComplexPoint | null = null;

      for (let step = 0; step <= stepCount; step += 1) {
        const progress = startProgress + (motionProgress - startProgress) * step / stepCount;
        const endpoint = evaluateEpicycleChain(currentInput.coefficients, progress * TAU).endpoint;
        const screenEndpoint = modelToScreen(endpoint, viewport);
        if (previousPoint) drawTrailSegment(trailContext, previousPoint, screenEndpoint);
        previousPoint = screenEndpoint;
      }
      runtimeRef.current.previousEndpoint = previousPoint;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const render = (timestamp: number) => {
      const currentInput = inputRef.current;
      const runtime = runtimeRef.current;

      if (runtime.restartRequested) {
        runtime.completed = false;
        runtime.progress = 0;
        runtime.previousEndpoint = null;
        runtime.lastTimestamp = timestamp;
        runtime.restartRequested = false;
        runtime.rebuildTrailRequested = false;
        clearCanvas(trailCanvas, trailContext);
        currentInput.onProgress(0);
      }
      if (runtime.pendingSeek !== null) {
        runtime.progress = runtime.pendingSeek;
        runtime.completed = runtime.progress >= 1;
        runtime.pendingSeek = null;
        runtime.rebuildTrailRequested = true;
      }
      if (runtime.rebuildTrailRequested) {
        rebuildTrail(runtime.progress);
        runtime.rebuildTrailRequested = false;
      }

      const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - runtime.lastTimestamp) / 1000));
      runtime.lastTimestamp = timestamp;
      const previousProgress = runtime.progress;
      if (!currentInput.options.paused && !runtime.completed) {
        runtime.progress = clamp01(runtime.progress + deltaSeconds * currentInput.options.speed);
        if (runtime.progress >= 1) {
          runtime.completed = true;
          currentInput.onProgress(1);
          runtime.lastPublishedAt = timestamp;
          currentInput.onComplete();
        }
      }

      const previousMotion = clamp01((previousProgress - 0.08) / 0.8);
      const motionProgress = clamp01((runtime.progress - 0.08) / 0.8);
      const phase = motionProgress * TAU;
      if (motionProgress > previousMotion) {
        const endpoint = evaluateEpicycleChain(currentInput.coefficients, phase).endpoint;
        const screenEndpoint = modelToScreen(endpoint, viewport);
        if (runtime.previousEndpoint) {
          fadeTrail(
            trailContext,
            viewport,
            deltaSeconds,
            currentInput.options.speed,
            currentInput.options.trailLength,
          );
          drawTrailSegment(trailContext, runtime.previousEndpoint, screenEndpoint);
        }
        runtime.previousEndpoint = screenEndpoint;
      }

      prepareContext(context, viewport);
      drawMathematicalPaper(context, viewport);
      if (currentInput.options.showTarget) {
        drawTargetPath(context, currentInput.targetPath, viewport);
      }
      context.drawImage(
        trailCanvas,
        0,
        0,
        trailCanvas.width,
        trailCanvas.height,
        0,
        0,
        viewport.width,
        viewport.height,
      );
      const guideAlpha = 1 - smoothstep(0.82, 0.98, runtime.progress);
      context.save();
      context.globalAlpha = guideAlpha;
      const endpoint = drawEpicycleChain(
        context,
        currentInput.coefficients,
        phase,
        viewport,
        currentInput.options,
      );
      context.restore();
      drawEndpoint(context, endpoint);

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
