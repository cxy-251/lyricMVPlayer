import {useControls} from 'leva';
import {useEffect, useMemo, useRef, useState} from 'react';

type TrajectoryControls = {
  routeCount: number;
  playbackDuration: number;
  historyWindow: number;
  glow: number;
  lineWidth: number;
};

type Route = {
  points: Array<{x: number; y: number}>;
  hue: number;
  seed: number;
};

const fract = (value: number) => value - Math.floor(value);

const makeRoutes = (count: number): Route[] =>
  Array.from({length: count}, (_, routeIndex) => {
    const seed = fract(Math.sin(routeIndex * 91.77) * 911.31);
    const startY = 0.2 + fract(Math.sin(routeIndex * 33.2) * 17.1) * 0.66;
    const channel = fract(Math.sin(routeIndex * 19.91) * 31.7);
    const points = Array.from({length: 96}, (_, pointIndex) => {
      const t = pointIndex / 95;
      const drift = Math.sin(t * Math.PI * 4 + seed * 7) * 0.035;
      return {
        x: 0.18 + t * 0.68 + drift + Math.sin(routeIndex) * 0.02,
        y: startY
          + Math.sin(t * Math.PI * 2.8 + seed * 9) * (0.04 + channel * 0.035)
          + (channel - 0.5) * 0.18 * t,
      };
    });
    return {points, hue: 178 + seed * 68, seed};
  });

const drawCoast = (context: CanvasRenderingContext2D, width: number, height: number) => {
  context.save();
  context.strokeStyle = 'rgba(180, 230, 255, 0.2)';
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(width * 0.12, height * 0.12);
  for (let index = 0; index <= 42; index++) {
    const t = index / 42;
    context.lineTo(
      width * (0.1 + t * 0.22 + Math.sin(t * 13) * 0.015),
      height * (0.15 + t * 0.72 + Math.sin(t * 8) * 0.025),
    );
  }
  context.stroke();
  context.fillStyle = 'rgba(180,230,255,0.36)';
  context.font = '11px "SFMono-Regular", Menlo, Consolas, monospace';
  context.fillText('SHANGHAI', width * 0.18, height * 0.62);
  context.fillText('EAST CHINA SEA', width * 0.56, height * 0.18);
  context.restore();
};

export default function Demo035TrajectoryDataCinema() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef(0);
  const playingRef = useRef(true);
  const [playing, setPlaying] = useState(true);
  const controls = useControls('Trajectory Data Cinema', {
    routeCount: {value: 94, min: 24, max: 160, step: 2, label: 'Vessel routes'},
    playbackDuration: {value: 16, min: 7, max: 30, step: 1, label: 'Window duration'},
    historyWindow: {value: 0.24, min: 0.06, max: 0.55, step: 0.01, label: 'Trail history'},
    glow: {value: 0.68, min: 0.15, max: 1, step: 0.01, label: 'Route glow'},
    lineWidth: {value: 1.15, min: 0.6, max: 2.2, step: 0.05, label: 'Route width'},
  }) as TrajectoryControls;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  playingRef.current = playing;
  const routes = useMemo(() => makeRoutes(controls.routeCount), [controls.routeCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 1;
    let height = 1;
    let animationFrame = 0;
    let previousTime = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawRouteSegment = (
      route: Route,
      startIndex: number,
      endIndex: number,
      alpha: number,
      current: TrajectoryControls,
    ) => {
      if (endIndex <= startIndex) return;
      context.beginPath();
      for (let index = startIndex; index <= endIndex; index++) {
        const point = route.points[index];
        const x = point.x * width;
        const y = point.y * height;
        if (index === startIndex) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.shadowColor = `hsla(${route.hue}, 100%, 72%, ${current.glow})`;
      context.shadowBlur = 11 * current.glow;
      context.strokeStyle = `hsla(${route.hue}, 100%, 68%, ${alpha})`;
      context.lineWidth = current.lineWidth * (0.8 + route.seed * 0.55);
      context.stroke();
    };

    const draw = (now: number) => {
      const delta = Math.min((now - previousTime) / 1000, 0.05);
      previousTime = now;
      const current = controlsRef.current;
      if (playingRef.current) {
        progressRef.current = (progressRef.current + delta / current.playbackDuration) % 1;
      }
      const progress = progressRef.current;

      context.fillStyle = '#02070e';
      context.fillRect(0, 0, width, height);
      drawCoast(context, width, height);

      for (const route of routes) {
        context.shadowBlur = 0;
        drawRouteSegment(route, 0, route.points.length - 1, 0.055, current);

        const routeStart = route.seed * 0.24;
        const localProgress = Math.max(0, Math.min(1, (progress - routeStart) / 0.76));
        const headIndex = Math.min(
          route.points.length - 1,
          Math.floor(localProgress * (route.points.length - 1)),
        );
        const historyPoints = Math.max(3, Math.floor(route.points.length * current.historyWindow));
        const startIndex = Math.max(0, headIndex - historyPoints);
        drawRouteSegment(route, startIndex, headIndex, 0.68, current);

        const head = route.points[headIndex];
        context.shadowBlur = 8 * current.glow;
        context.fillStyle = `hsla(${route.hue}, 100%, 82%, ${localProgress > 0 ? 0.94 : 0.14})`;
        context.beginPath();
        context.arc(head.x * width, head.y * height, 1.5 + route.seed * 1.6, 0, Math.PI * 2);
        context.fill();
      }

      context.shadowBlur = 0;
      context.fillStyle = 'rgba(225,245,255,0.76)';
      context.font = '11px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText(`AIS WINDOW · ${routes.length} VESSELS`, 27, height - 74);
      if (timelineRef.current && document.activeElement !== timelineRef.current) {
        timelineRef.current.value = String(progress);
      }
      if (outputRef.current) outputRef.current.textContent = `${Math.round(progress * 100)}%`;
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
  }, [routes]);

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#02070e'}}>
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />
      <div
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          bottom: 18,
          display: 'grid',
          gridTemplateColumns: 'auto auto minmax(120px, 1fr) 42px',
          alignItems: 'center',
          gap: 9,
          padding: '8px 10px',
          border: '1px solid rgba(155,218,255,0.18)',
          borderRadius: 7,
          background: 'rgba(4,10,19,0.86)',
          color: '#def4ff',
          fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace',
          fontSize: 11,
          backdropFilter: 'blur(14px)',
        }}
      >
        <button onClick={() => setPlaying((value) => !value)} style={timelineButtonStyle} type="button">
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={() => {
            progressRef.current = 0;
          }}
          style={timelineButtonStyle}
          type="button"
        >
          Restart
        </button>
        <input
          ref={timelineRef}
          aria-label="Trajectory time window"
          defaultValue="0"
          max="1"
          min="0"
          onChange={(event) => {
            progressRef.current = Number(event.currentTarget.value);
          }}
          step="0.001"
          type="range"
        />
        <span ref={outputRef}>0%</span>
      </div>
    </div>
  );
}

const timelineButtonStyle = {
  border: '1px solid rgba(108,219,255,0.34)',
  borderRadius: 5,
  background: 'rgba(108,219,255,0.1)',
  color: '#e6f8ff',
  cursor: 'pointer',
  padding: '7px 10px',
  font: 'inherit',
  fontWeight: 700,
} as const;
