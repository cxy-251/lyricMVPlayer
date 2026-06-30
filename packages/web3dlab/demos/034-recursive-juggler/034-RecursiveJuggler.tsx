import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type JugglerControls = {
  depth: number;
  speed: number;
  scale: number;
  ink: string;
};

const drawStickJuggler = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  phase: number,
  depth: number,
  controls: JugglerControls,
) => {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.strokeStyle = controls.ink;
  context.fillStyle = controls.ink;
  context.lineWidth = Math.max(1, 2 / Math.max(0.2, scale));
  context.lineCap = 'round';

  context.beginPath();
  context.arc(0, -42, 10, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(0, -32);
  context.lineTo(0, 12);
  context.moveTo(0, -15);
  context.lineTo(-24 + Math.sin(phase) * 6, -2);
  context.moveTo(0, -15);
  context.lineTo(24 - Math.sin(phase) * 6, -2);
  context.moveTo(0, 12);
  context.lineTo(-18, 42);
  context.moveTo(0, 12);
  context.lineTo(18, 42);
  context.stroke();

  for (let side = -1; side <= 1; side += 2) {
    const localPhase = phase + (side > 0 ? 0 : Math.PI);
    const px = side * 38 * Math.cos(localPhase);
    const py = -58 - Math.abs(Math.sin(localPhase)) * 52;
    context.beginPath();
    context.arc(px, py, 5, 0, Math.PI * 2);
    context.fill();
    if (depth > 0) {
      drawStickJuggler(context, px, py - 8, 0.43, phase * 1.25 + side * 0.9, depth - 1, controls);
    }
  }

  context.restore();
};

export default function Demo034RecursiveJuggler() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('Recursive Juggler', {
    depth: {value: 4, min: 1, max: 6, step: 1},
    speed: {value: 0.72, min: 0.15, max: 2.2, step: 0.01},
    scale: {value: 1, min: 0.65, max: 1.4, step: 0.01},
    ink: '#f5f5f5',
  }) as JugglerControls;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      const phase = now * 0.001 * controls.speed;
      context.fillStyle = '#070707';
      context.fillRect(0, 0, width, height);
      context.strokeStyle = 'rgba(255,255,255,0.08)';
      context.beginPath();
      context.arc(width / 2, height * 0.56, Math.min(width, height) * 0.28, 0, Math.PI * 2);
      context.stroke();
      drawStickJuggler(context, width / 2, height * 0.62, Math.min(width, height) * 0.0024 * controls.scale, phase, controls.depth, controls);
      animationFrame = requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    animationFrame = requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [controls]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />
    </div>
  );
}
