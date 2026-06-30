import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';

type TrajectoryControls = {
  routeCount: number;
  speed: number;
  glow: number;
  tail: number;
};

type Route = {
  points: Array<{x: number; y: number}>;
  hue: number;
  seed: number;
};

const fract = (value: number) => value - Math.floor(value);

const makeRoutes = (count: number): Route[] => Array.from({length: count}, (_, routeIndex) => {
  const seed = fract(Math.sin(routeIndex * 91.77) * 911.31);
  const startY = 0.2 + fract(Math.sin(routeIndex * 33.2) * 17.1) * 0.66;
  const channel = fract(Math.sin(routeIndex * 19.91) * 31.7);
  const points = Array.from({length: 80}, (_, pointIndex) => {
    const t = pointIndex / 79;
    const drift = Math.sin(t * Math.PI * 4 + seed * 7) * 0.035;
    const x = 0.18 + t * 0.68 + drift + Math.sin(routeIndex) * 0.02;
    const y = startY + Math.sin(t * Math.PI * 2.8 + seed * 9) * (0.04 + channel * 0.035) + (channel - 0.5) * 0.18 * t;
    return {x, y};
  });
  return {
    points,
    hue: 178 + seed * 68,
    seed,
  };
});

const drawCoast = (context: CanvasRenderingContext2D, width: number, height: number) => {
  context.save();
  context.strokeStyle = 'rgba(180, 230, 255, 0.22)';
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(width * 0.12, height * 0.12);
  for (let i = 0; i <= 36; i += 1) {
    const t = i / 36;
    const x = width * (0.1 + t * 0.22 + Math.sin(t * 13) * 0.015);
    const y = height * (0.15 + t * 0.72 + Math.sin(t * 8) * 0.025);
    context.lineTo(x, y);
  }
  context.stroke();
  context.fillStyle = 'rgba(180,230,255,0.42)';
  context.font = '12px "SFMono-Regular", Menlo, Consolas, monospace';
  context.fillText('SHANGHAI', width * 0.18, height * 0.62);
  context.fillText('EAST CHINA SEA', width * 0.56, height * 0.18);
  context.restore();
};

export default function Demo035TrajectoryDataCinema() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('Trajectory Data Cinema', {
    routeCount: {value: 94, min: 20, max: 180, step: 2},
    speed: {value: 0.48, min: 0.08, max: 1.5, step: 0.01},
    glow: {value: 0.72, min: 0.1, max: 1.4, step: 0.01},
    tail: {value: 0.2, min: 0.05, max: 0.6, step: 0.01},
  }) as TrajectoryControls;
  const routes = useMemo(() => makeRoutes(controls.routeCount), [controls.routeCount]);

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
      const progress = (now * 0.00006 * controls.speed) % 1;
      context.fillStyle = `rgba(2, 7, 14, ${controls.tail})`;
      context.fillRect(0, 0, width, height);
      drawCoast(context, width, height);

      for (const route of routes) {
        const reveal = (progress + route.seed * 0.72) % 1;
        const visible = Math.max(2, Math.floor(route.points.length * reveal));
        context.beginPath();
        for (let index = 0; index < visible; index += 1) {
          const point = route.points[index];
          const x = point.x * width;
          const y = point.y * height;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.shadowColor = `hsla(${route.hue}, 100%, 72%, ${controls.glow})`;
        context.shadowBlur = 12 * controls.glow;
        context.strokeStyle = `hsla(${route.hue}, 100%, 68%, 0.48)`;
        context.lineWidth = 1 + route.seed * 1.4;
        context.stroke();

        const head = route.points[Math.min(visible - 1, route.points.length - 1)];
        context.beginPath();
        context.fillStyle = `hsla(${route.hue}, 100%, 78%, 0.92)`;
        context.arc(head.x * width, head.y * height, 1.6 + route.seed * 1.8, 0, Math.PI * 2);
        context.fill();
      }

      context.shadowBlur = 0;
      context.fillStyle = 'rgba(225,245,255,0.82)';
      context.font = '13px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText(`AIS TRAJECTORY WINDOW // 02-22 MAR // ${Math.round(progress * 100)}%`, 28, height - 28);
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
  }, [controls, routes]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />
    </div>
  );
}
