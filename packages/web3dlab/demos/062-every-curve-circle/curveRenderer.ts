import type {
  CurveConstruction,
  Point,
  SampledCurveScene,
} from './types';

export type CurveViewport = {
  width: number;
  height: number;
  pixelRatio: number;
};

type RenderCurveFrameInput = {
  accent: string;
  construction: CurveConstruction;
  fullTrajectory: boolean;
  motionProgress: number;
  scene: SampledCurveScene;
  showGuides: boolean;
  timelineProgress: number;
  viewport: CurveViewport;
};

type SceneTransform = {
  origin: Point;
  scale: number;
};

const PAPER = '#111412';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (start: number, end: number, value: number) => {
  const progress = clamp01((value - start) / (end - start));
  return progress * progress * (3 - 2 * progress);
};

export function configureCurveCanvas(
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

const toScreen = (point: Point, transform: SceneTransform): Point => ({
  x: transform.origin.x + point.x * transform.scale,
  y: transform.origin.y + point.y * transform.scale,
});

function createSceneTransform(
  scene: SampledCurveScene,
  viewport: CurveViewport,
  timelineProgress: number,
): SceneTransform {
  const compact = viewport.width < 720;
  const topInset = compact ? 150 : 92;
  const bottomInset = compact ? 244 : 198;
  const availableHeight = Math.max(180, viewport.height - topInset - bottomInset);
  const availableWidth = Math.max(220, viewport.width - (compact ? 28 : 140));
  const baseScale = Math.min(availableWidth, availableHeight) * 0.46 / scene.extent;
  const completion = smoothstep(0.9, 1, timelineProgress);
  return {
    origin: {
      x: viewport.width / 2,
      y: topInset + availableHeight / 2 + availableHeight * 0.22 * completion,
    },
    scale: baseScale * (1 - completion * 0.32),
  };
}

function drawBackground(context: CanvasRenderingContext2D, viewport: CurveViewport) {
  context.fillStyle = PAPER;
  context.fillRect(0, 0, viewport.width, viewport.height);

  const spacing = viewport.width < 720 ? 30 : 38;
  context.beginPath();
  for (let x = 0; x <= viewport.width; x += spacing) {
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, viewport.height);
  }
  for (let y = 0; y <= viewport.height; y += spacing) {
    context.moveTo(0, y + 0.5);
    context.lineTo(viewport.width, y + 0.5);
  }
  context.strokeStyle = 'rgba(240, 236, 224, 0.045)';
  context.lineWidth = 1;
  context.stroke();
}

function drawCircle(
  context: CanvasRenderingContext2D,
  center: Point,
  radius: number,
  transform: SceneTransform,
  color: string,
  lineWidth = 1,
) {
  const screenCenter = toScreen(center, transform);
  context.beginPath();
  context.arc(screenCenter.x, screenCenter.y, radius * transform.scale, 0, Math.PI * 2);
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.stroke();
}

function drawLine(
  context: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  transform: SceneTransform,
  color: string,
  lineWidth = 1,
) {
  const screenStart = toScreen(start, transform);
  const screenEnd = toScreen(end, transform);
  context.beginPath();
  context.moveTo(screenStart.x, screenStart.y);
  context.lineTo(screenEnd.x, screenEnd.y);
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.stroke();
}

function drawDirectionArrow(
  context: CanvasRenderingContext2D,
  construction: CurveConstruction,
  transform: SceneTransform,
  alpha: number,
) {
  const center = construction.rollingCircle?.center;
  const direction = construction.motionDirection;
  if (!center || !direction) return;
  const magnitude = Math.hypot(direction.x, direction.y) || 1;
  const start = toScreen(center, transform);
  const unit = {x: direction.x / magnitude, y: direction.y / magnitude};
  const end = {x: start.x + unit.x * 25, y: start.y + unit.y * 25};

  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.strokeStyle = `rgba(230, 225, 214, ${0.62 * alpha})`;
  context.lineWidth = 1.2;
  context.stroke();

  const angle = Math.atan2(unit.y, unit.x);
  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(end.x - 7 * Math.cos(angle - 0.5), end.y - 7 * Math.sin(angle - 0.5));
  context.moveTo(end.x, end.y);
  context.lineTo(end.x - 7 * Math.cos(angle + 0.5), end.y - 7 * Math.sin(angle + 0.5));
  context.stroke();
}

function drawConstruction(
  context: CanvasRenderingContext2D,
  construction: CurveConstruction,
  transform: SceneTransform,
  alpha: number,
) {
  if (construction.fixedCircle) {
    drawCircle(
      context,
      construction.fixedCircle.center,
      construction.fixedCircle.radius,
      transform,
      `rgba(226, 222, 211, ${0.2 * alpha})`,
    );
  }
  if (construction.rollingCircle) {
    drawCircle(
      context,
      construction.rollingCircle.center,
      construction.rollingCircle.radius,
      transform,
      `rgba(238, 233, 222, ${0.56 * alpha})`,
      1.2,
    );
  }
  if (construction.radiusLine) {
    drawLine(
      context,
      construction.radiusLine.start,
      construction.radiusLine.end,
      transform,
      `rgba(238, 233, 222, ${0.56 * alpha})`,
    );
  }
  for (const arm of construction.arms ?? []) {
    if (arm.radius * transform.scale > 0.45) {
      drawCircle(
        context,
        arm.start,
        arm.radius,
        transform,
        `rgba(226, 222, 211, ${0.22 * alpha})`,
      );
    }
    drawLine(
      context,
      arm.start,
      arm.end,
      transform,
      `rgba(238, 233, 222, ${0.62 * alpha})`,
    );
  }
  drawDirectionArrow(context, construction, transform, alpha);
}

function strokeCurve(
  context: CanvasRenderingContext2D,
  points: Point[],
  endIndex: number,
  transform: SceneTransform,
  color: string,
  lineWidth: number,
) {
  if (endIndex < 2 || points.length < 2) return;
  const first = toScreen(points[0], transform);
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (let index = 1; index < Math.min(endIndex, points.length); index += 1) {
    const point = toScreen(points[index], transform);
    context.lineTo(point.x, point.y);
  }
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.stroke();
}

export function renderCurveFrame(
  context: CanvasRenderingContext2D,
  input: RenderCurveFrameInput,
) {
  const {
    accent,
    construction,
    fullTrajectory,
    motionProgress,
    scene,
    showGuides,
    timelineProgress,
    viewport,
  } = input;
  context.setTransform(viewport.pixelRatio, 0, 0, viewport.pixelRatio, 0, 0);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  drawBackground(context, viewport);

  const transform = createSceneTransform(scene, viewport, timelineProgress);
  const tracedEnd = Math.max(2, Math.ceil(motionProgress * (scene.points.length - 1)) + 1);
  if (fullTrajectory) {
    strokeCurve(
      context,
      scene.points,
      scene.points.length,
      transform,
      'rgba(236, 231, 221, 0.14)',
      1.1,
    );
  }

  const guideAlpha = showGuides ? 1 - smoothstep(0.82, 0.98, timelineProgress) : 0;
  if (guideAlpha > 0.01) {
    drawConstruction(context, construction, transform, guideAlpha);
  }

  strokeCurve(context, scene.points, tracedEnd, transform, accent, 2.15);

  const tracingPoint = toScreen(construction.tracingPoint, transform);
  context.beginPath();
  context.arc(tracingPoint.x, tracingPoint.y, 4.2, 0, Math.PI * 2);
  context.fillStyle = accent;
  context.fill();
  context.beginPath();
  context.arc(tracingPoint.x, tracingPoint.y, 7.2, 0, Math.PI * 2);
  context.strokeStyle = `${accent}55`;
  context.lineWidth = 1.6;
  context.stroke();
}
