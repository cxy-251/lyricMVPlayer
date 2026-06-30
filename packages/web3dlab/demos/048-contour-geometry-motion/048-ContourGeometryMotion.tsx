import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type ContourControls = {
  lineCount: number;
  breathing: number;
  speed: number;
  compositionScale: number;
  lineAlpha: number;
};

type ShapeSpec = {
  type: 'round' | 'tri' | 'capsule' | 'diamond';
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
};

const SHAPES: ShapeSpec[] = [
  {type: 'tri', x: -0.34, y: -0.33, w: 0.28, h: 0.25, r: -0.16},
  {type: 'round', x: 0, y: -0.35, w: 0.19, h: 0.34, r: 0},
  {type: 'tri', x: 0.33, y: -0.32, w: 0.28, h: 0.25, r: 0.16},
  {type: 'round', x: -0.34, y: 0.02, w: 0.34, h: 0.42, r: 0},
  {type: 'capsule', x: -0.08, y: 0.02, w: 0.09, h: 0.44, r: 0},
  {type: 'capsule', x: 0.08, y: 0.02, w: 0.09, h: 0.44, r: 0},
  {type: 'round', x: 0.34, y: 0.02, w: 0.34, h: 0.42, r: 0},
  {type: 'tri', x: -0.32, y: 0.36, w: 0.26, h: 0.22, r: 0.12},
  {type: 'round', x: 0, y: 0.36, w: 0.21, h: 0.3, r: 0},
  {type: 'tri', x: 0.32, y: 0.36, w: 0.26, h: 0.22, r: -0.12},
  {type: 'capsule', x: -0.52, y: 0.02, w: 0.055, h: 0.67, r: 0},
  {type: 'capsule', x: 0.52, y: 0.02, w: 0.055, h: 0.67, r: 0},
  {type: 'diamond', x: 0, y: -0.08, w: 0.08, h: 0.08, r: 0},
  {type: 'diamond', x: 0, y: 0.18, w: 0.08, h: 0.08, r: 0},
];

const smallShapes = Array.from({length: 16}, (_, index): ShapeSpec => {
  const side = index % 2 ? -1 : 1;
  const row = Math.floor(index / 4);
  return {
    type: index % 3 === 0 ? 'tri' : 'capsule',
    x: side * (0.08 + (index % 4) * 0.16),
    y: -0.52 + row * 0.18,
    w: 0.12,
    h: 0.045,
    r: (index % 5) * 0.28,
  };
});

const roundedRect = (context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) => {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
};

const drawNestedShape = (context: CanvasRenderingContext2D, shape: ShapeSpec, size: number, lineCount: number, phase: number) => {
  context.save();
  context.translate(shape.x * size, shape.y * size);
  context.rotate(shape.r);
  const maxInset = Math.min(shape.w, shape.h) * size * 0.44;
  for (let line = 0; line < lineCount; line += 1) {
    const t = (line + phase) / lineCount;
    const inset = t * maxInset;
    const w = shape.w * size - inset * 2;
    const h = shape.h * size - inset * 2;
    if (w <= 3 || h <= 3) continue;
    if (shape.type === 'round') {
      roundedRect(context, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.18);
    } else if (shape.type === 'capsule') {
      roundedRect(context, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.48);
    } else if (shape.type === 'diamond') {
      context.beginPath();
      context.moveTo(0, -h / 2);
      context.lineTo(w / 2, 0);
      context.lineTo(0, h / 2);
      context.lineTo(-w / 2, 0);
      context.closePath();
    } else {
      context.beginPath();
      context.moveTo(0, -h / 2);
      context.lineTo(w / 2, h / 2);
      context.lineTo(-w / 2, h / 2);
      context.closePath();
    }
    context.stroke();
  }
  context.restore();
};

export default function Demo048ContourGeometryMotion() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('Contour Geometry Motion', {
    lineCount: {value: 22, min: 6, max: 42, step: 1},
    breathing: {value: 0.64, min: 0, max: 1.6, step: 0.01},
    speed: {value: 0.5, min: 0, max: 1.8, step: 0.01},
    compositionScale: {value: 0.92, min: 0.55, max: 1.18, step: 0.01},
    lineAlpha: {value: 0.9, min: 0.2, max: 1, step: 0.01},
  }) as ContourControls;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let frame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      const time = now * 0.001 * controls.speed;
      const bg = context.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
      bg.addColorStop(0, '#050505');
      bg.addColorStop(1, '#000');
      context.fillStyle = bg;
      context.fillRect(0, 0, width, height);
      const size = Math.min(width, height) * 0.82 * controls.compositionScale * (1 + Math.sin(time * 1.2) * 0.025 * controls.breathing);
      context.save();
      context.translate(width / 2, height / 2);
      context.strokeStyle = 'rgba(255,255,255,0.08)';
      context.lineWidth = 1;
      context.strokeRect(-size * 0.61, -size * 0.61, size * 1.22, size * 1.22);
      context.strokeStyle = `rgba(255,255,255,${controls.lineAlpha})`;
      context.lineWidth = Math.max(1, size * 0.0016);
      context.lineJoin = 'round';
      context.lineCap = 'round';
      const phase = (Math.sin(time * 1.7) * 0.5 + 0.5) * controls.breathing;
      for (const shape of SHAPES) drawNestedShape(context, shape, size, controls.lineCount, phase);
      context.strokeStyle = `rgba(255,255,255,${controls.lineAlpha * 0.82})`;
      for (const shape of smallShapes) drawNestedShape(context, shape, size, Math.max(3, Math.floor(controls.lineCount * 0.38)), phase * 1.7);
      context.restore();
      frame = requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    frame = requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [controls.breathing, controls.compositionScale, controls.lineAlpha, controls.lineCount, controls.speed]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />
    </div>
  );
}
