import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type BreathingControls = {
  nodes: number;
  speed: number;
  radius: number;
  lineWidth: number;
};

export default function Demo033GeometricBreathing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('Geometric Breathing', {
    nodes: {value: 9, min: 4, max: 16, step: 1},
    speed: {value: 0.42, min: 0.08, max: 1.4, step: 0.01},
    radius: {value: 0.72, min: 0.3, max: 1.2, step: 0.01},
    lineWidth: {value: 1.2, min: 0.4, max: 3, step: 0.1},
  }) as BreathingControls;

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
      const time = now * 0.001 * controls.speed;
      const cx = width / 2;
      const cy = height / 2;
      const base = Math.min(width, height) * 0.24 * controls.radius;

      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(0, 0, width, height);
      context.lineWidth = controls.lineWidth;
      context.strokeStyle = 'rgba(255,255,255,0.66)';
      context.fillStyle = '#ffffff';

      const points: Array<{x: number; y: number}> = [];
      for (let index = 0; index < controls.nodes; index += 1) {
        const angle = (index / controls.nodes) * Math.PI * 2;
        const breath = 0.72 + Math.sin(time * 2 + index * 0.62) * 0.18;
        const x = cx + Math.cos(angle + Math.sin(time) * 0.15) * base * 1.65 * breath;
        const y = cy + Math.sin(angle + Math.cos(time * 0.7) * 0.12) * base * 1.65 * breath;
        points.push({x, y});
      }

      for (let index = 0; index < points.length; index += 1) {
        const a = points[index];
        const b = points[(index + 2) % points.length];
        context.globalAlpha = 0.22;
        context.beginPath();
        context.arc(a.x, a.y, base * (0.72 + Math.sin(time * 1.4 + index) * 0.16), 0, Math.PI * 2);
        context.stroke();
        context.globalAlpha = 0.42;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
        context.globalAlpha = 1;
        context.beginPath();
        context.arc(a.x, a.y, 3.5, 0, Math.PI * 2);
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
