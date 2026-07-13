import {evaluateEpicycleChain} from './fourier';
import type {
  ComplexPoint,
  FourierCoefficient,
  FourierSceneOptions,
} from './types';

export type FourierViewport = {
  width: number;
  height: number;
  pixelRatio: number;
  scale: number;
  origin: ComplexPoint;
};

const BACKGROUND = '#56615e';
const TRAIL_COLOR = '#251b28';

export function configureCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  pixelRatio: number,
) {
  const physicalWidth = Math.max(1, Math.round(width * pixelRatio));
  const physicalHeight = Math.max(1, Math.round(height * pixelRatio));
  if (canvas.width !== physicalWidth) canvas.width = physicalWidth;
  if (canvas.height !== physicalHeight) canvas.height = physicalHeight;
}

export function createFourierViewport(
  width: number,
  height: number,
  pixelRatio: number,
): FourierViewport {
  return {
    width,
    height,
    pixelRatio,
    scale: Math.min(width, height) * 0.27,
    origin: {x: width / 2, y: height / 2},
  };
}

export function prepareContext(context: CanvasRenderingContext2D, viewport: FourierViewport) {
  context.setTransform(viewport.pixelRatio, 0, 0, viewport.pixelRatio, 0, 0);
  context.lineCap = 'round';
  context.lineJoin = 'round';
}

export function modelToScreen(point: ComplexPoint, viewport: FourierViewport): ComplexPoint {
  return {
    x: viewport.origin.x + point.x * viewport.scale,
    y: viewport.origin.y + point.y * viewport.scale,
  };
}

export function drawMathematicalPaper(
  context: CanvasRenderingContext2D,
  viewport: FourierViewport,
) {
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, viewport.width, viewport.height);

  const gridSize = viewport.width < 680 ? 24 : 32;
  context.beginPath();
  for (let x = 0; x <= viewport.width; x += gridSize) {
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, viewport.height);
  }
  for (let y = 0; y <= viewport.height; y += gridSize) {
    context.moveTo(0, y + 0.5);
    context.lineTo(viewport.width, y + 0.5);
  }
  context.strokeStyle = 'rgba(247, 244, 238, 0.07)';
  context.lineWidth = 1;
  context.stroke();

  context.beginPath();
  context.moveTo(viewport.origin.x + 0.5, 0);
  context.lineTo(viewport.origin.x + 0.5, viewport.height);
  context.moveTo(0, viewport.origin.y + 0.5);
  context.lineTo(viewport.width, viewport.origin.y + 0.5);
  context.strokeStyle = 'rgba(247, 244, 238, 0.12)';
  context.stroke();
}

export function drawTargetPath(
  context: CanvasRenderingContext2D,
  targetPath: ComplexPoint[],
  viewport: FourierViewport,
) {
  if (targetPath.length < 2) return;
  const first = modelToScreen(targetPath[0], viewport);

  context.save();
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (let index = 1; index < targetPath.length; index += 1) {
    const point = modelToScreen(targetPath[index], viewport);
    context.lineTo(point.x, point.y);
  }
  context.closePath();
  context.setLineDash([5, 8]);
  context.strokeStyle = 'rgba(248, 236, 241, 0.24)';
  context.lineWidth = 1;
  context.stroke();
  context.restore();
}

export function drawEpicycleChain(
  context: CanvasRenderingContext2D,
  coefficients: FourierCoefficient[],
  timeAngle: number,
  viewport: FourierViewport,
  options: FourierSceneOptions,
): ComplexPoint {
  const {segments, endpoint} = evaluateEpicycleChain(coefficients, timeAngle);

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const center = modelToScreen(segment.center, viewport);
    const end = modelToScreen(segment.end, viewport);
    const radius = segment.coefficient.amplitude * viewport.scale;
    const inspected = options.inspectedIndex === index;

    if (options.showCircles && radius >= 0.45) {
      context.beginPath();
      context.arc(center.x, center.y, radius, 0, Math.PI * 2);
      context.strokeStyle = inspected
        ? 'rgba(255, 105, 94, 0.82)'
        : 'rgba(249, 246, 239, 0.3)';
      context.lineWidth = inspected ? 1.5 : 0.9;
      context.stroke();
    }

    if (options.showVectors) {
      context.beginPath();
      context.moveTo(center.x, center.y);
      context.lineTo(end.x, end.y);
      context.strokeStyle = inspected
        ? 'rgba(255, 105, 94, 0.94)'
        : 'rgba(249, 246, 239, 0.62)';
      context.lineWidth = inspected ? 1.6 : 1;
      context.stroke();
    }
  }

  return modelToScreen(endpoint, viewport);
}

export function drawEndpoint(context: CanvasRenderingContext2D, endpoint: ComplexPoint) {
  context.beginPath();
  context.arc(endpoint.x, endpoint.y, 4.5, 0, Math.PI * 2);
  context.fillStyle = '#ff695e';
  context.fill();
  context.beginPath();
  context.arc(endpoint.x, endpoint.y, 7.5, 0, Math.PI * 2);
  context.strokeStyle = 'rgba(255, 105, 94, 0.3)';
  context.lineWidth = 2;
  context.stroke();
}

export function drawTrailSegment(
  context: CanvasRenderingContext2D,
  from: ComplexPoint,
  to: ComplexPoint,
) {
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.strokeStyle = TRAIL_COLOR;
  context.lineWidth = 2.15;
  context.stroke();
}
