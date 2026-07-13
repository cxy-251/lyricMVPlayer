import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type JellyControls = {
  points: number;
  scale: number;
  speed: number;
  brightness: number;
  trail: number;
};

export default function Demo032ParametricJellyfish() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('Parametric Jellyfish', {
    points: {value: 12000, min: 3000, max: 24000, step: 500, label: 'Point density'},
    scale: {value: 1, min: 0.55, max: 1.35, step: 0.01, label: 'Form scale'},
    speed: {value: 1, min: 0.2, max: 1.6, step: 0.01, label: 'Flow speed'},
    brightness: {value: 0.78, min: 0.2, max: 1, step: 0.01, label: 'Point brightness'},
    trail: {value: 0.28, min: 0.08, max: 0.55, step: 0.01, label: 'Trail fade'},
  }) as JellyControls;

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
      context.fillStyle = '#050505';
      context.fillRect(0, 0, width, height);
    };

    const draw = (now: number) => {
      const t = now * 0.0009 * controls.speed;
      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const s = Math.min(width, height) * 0.68 * controls.scale;

      context.fillStyle = `rgba(0, 0, 0, ${controls.trail})`;
      context.fillRect(0, 0, width, height);
      context.fillStyle = `rgba(255, 255, 255, ${controls.brightness})`;

      for (let i = controls.points; i > 0; i -= 1) {
        const x = i;
        const y = i / 235;
        const k = 4 * Math.cos(x / 21);
        const e = y / 8 - 20;
        const d = Math.hypot(k, e);
        const c = d - t * Math.PI;
        const q = 3 * Math.sin(k * 2) + 0.3 / Math.max(0.08, Math.abs(k)) + Math.sin(y / 19) * k * (9 + 2 * Math.sin(e * 14 - d * 3 + t * 2));
        const px = (q + 50 * Math.cos(c)) / 400;
        const py = (q * Math.sin(c) + d * 39 - 475) / 400;
        // The formula is centered around x=0 and y≈0.469, not around (0.5, 0.5).
        const screenX = centerX + px * s;
        const screenY = centerY + (py - 0.469) * s;
        const radius = k * k > 15 ? 1.35 : 0.7;
        context.globalAlpha = 0.26 + Math.min(0.7, Math.abs(k) / 8);
        context.beginPath();
        context.arc(screenX, screenY, radius, 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;
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
