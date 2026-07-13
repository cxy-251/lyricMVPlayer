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
  options: FourierAnimationOptions;
  restartToken: number;
  targetPath: ComplexPoint[];
};

type AnimationRuntime = {
  lastTimestamp: number;
  phase: number;
  previousEndpoint: ComplexPoint | null;
  restartRequested: boolean;
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
    lastTimestamp: 0,
    phase: 0,
    previousEndpoint: null,
    restartRequested: true,
  });
  inputRef.current = input;

  useEffect(() => {
    runtimeRef.current.restartRequested = true;
  }, [input.coefficients, input.restartToken]);

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
      clearCanvas(trailCanvas, trailContext);
      runtimeRef.current.restartRequested = true;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const render = (timestamp: number) => {
      const currentInput = inputRef.current;
      const runtime = runtimeRef.current;

      if (runtime.restartRequested) {
        runtime.phase = 0;
        runtime.previousEndpoint = null;
        runtime.lastTimestamp = timestamp;
        runtime.restartRequested = false;
        clearCanvas(trailCanvas, trailContext);
      }

      const deltaSeconds = Math.min(
        0.05,
        Math.max(0, (timestamp - runtime.lastTimestamp) / 1000),
      );
      runtime.lastTimestamp = timestamp;

      if (!currentInput.options.paused) {
        runtime.phase += deltaSeconds * currentInput.options.speed * TAU;
        if (runtime.phase >= TAU) {
          runtime.phase %= TAU;
          runtime.previousEndpoint = null;
          clearCanvas(trailCanvas, trailContext);
        }

        const endpoint = evaluateEpicycleChain(
          currentInput.coefficients,
          runtime.phase,
        ).endpoint;
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
      const endpoint = drawEpicycleChain(
        context,
        currentInput.coefficients,
        runtime.phase,
        viewport,
        currentInput.options,
      );
      drawEndpoint(context, endpoint);

      animationFrame = window.requestAnimationFrame(render);
    };

    animationFrame = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [canvasRef]);
}
