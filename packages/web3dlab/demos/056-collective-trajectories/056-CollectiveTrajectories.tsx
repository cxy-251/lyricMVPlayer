import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type TrajectoryControls = {
  agents: number;
  trailFade: number;
  symmetry: number;
  speed: number;
  curvature: number;
};

type Agent = {
  x: number;
  y: number;
  px: number;
  py: number;
  phase: number;
  radius: number;
  hue: number;
  band: number;
};

const random01 = (index: number) => {
  const x = Math.sin(index * 126.17 + 40.31) * 43758.5453;
  return x - Math.floor(x);
};

const makeAgents = (count: number): Agent[] => (
  Array.from({length: count}, (_, index) => ({
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    phase: random01(index) * Math.PI * 2,
    radius: 0.12 + random01(index + 20) * 0.74,
    hue: 185 + random01(index + 30) * 170,
    band: Math.floor(random01(index + 40) * 5),
  }))
);

const roundRect = (context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
};

export default function Demo056CollectiveTrajectories() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('Collective Trajectories', {
    agents: {value: 180, min: 40, max: 420, step: 10},
    trailFade: {value: 0.08, min: 0.015, max: 0.25, step: 0.005},
    symmetry: {value: 4, min: 1, max: 8, step: 1},
    speed: {value: 0.8, min: 0.1, max: 2.2, step: 0.01},
    curvature: {value: 0.64, min: 0, max: 1.6, step: 0.01},
  }) as TrajectoryControls;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let agents = makeAgents(controls.agents);
    let frame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      agents = makeAgents(controls.agents);
      const bg = context.createRadialGradient(width * 0.45, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
      bg.addColorStop(0, '#061018');
      bg.addColorStop(1, '#010207');
      context.fillStyle = bg;
      context.fillRect(0, 0, width, height);
    };

    const drawFrame = () => {
      roundRect(context, width * 0.055, height * 0.08, width * 0.73, height * 0.8, 16);
      context.strokeStyle = 'rgba(255,255,255,0.13)';
      context.lineWidth = 1;
      context.stroke();
      context.fillStyle = 'rgba(255,255,255,0.06)';
      context.font = '12px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText('collective trajectories / accumulated motion field', width * 0.08, height * 0.12);
      const panelX = width * 0.82;
      roundRect(context, panelX, height * 0.16, width * 0.13, height * 0.48, 10);
      context.fillStyle = 'rgba(8,12,18,0.74)';
      context.fill();
      const rows = [
        ['agents', controls.agents / 420],
        ['fade', controls.trailFade / 0.25],
        ['sym', controls.symmetry / 8],
        ['curve', controls.curvature / 1.6],
      ];
      context.fillStyle = '#dbf7ff';
      context.font = '11px "SFMono-Regular", Menlo, Consolas, monospace';
      rows.forEach(([label, value], index) => {
        const y = height * 0.21 + index * 48;
        context.fillStyle = 'rgba(219,247,255,0.76)';
        context.fillText(label as string, panelX + 14, y);
        context.fillStyle = 'rgba(219,247,255,0.14)';
        context.fillRect(panelX + 14, y + 12, width * 0.09, 5);
        context.fillStyle = '#48d7ff';
        context.fillRect(panelX + 14, y + 12, width * 0.09 * Number(value), 5);
      });
    };

    const draw = (now: number) => {
      const time = now * 0.001 * controls.speed;
      context.fillStyle = `rgba(1,2,7,${controls.trailFade})`;
      context.fillRect(0, 0, width, height);
      context.save();
      context.translate(width * 0.42, height * 0.5);
      context.globalCompositeOperation = 'lighter';
      const scale = Math.min(width, height) * 0.42;
      for (let index = 0; index < agents.length; index += 1) {
        const agent = agents[index];
        agent.px = agent.x;
        agent.py = agent.y;
        const t = time * (0.22 + agent.radius) + agent.phase;
        const flower = Math.sin(t * (2.1 + agent.band * 0.27)) * controls.curvature;
        const r = agent.radius + Math.sin(t * 1.7 + index) * 0.08 * controls.curvature;
        agent.x = Math.cos(t + flower * 0.32) * r;
        agent.y = Math.sin(t * (1.18 + (index % 7) * 0.036)) * r * (0.64 + agent.band * 0.05);
        const alpha = 0.11 + (agent.band / 5) * 0.07;
        context.strokeStyle = `hsla(${agent.hue}, 90%, ${58 + agent.band * 6}%, ${alpha})`;
        context.lineWidth = 0.55 + agent.band * 0.16;
        for (let copy = 0; copy < controls.symmetry; copy += 1) {
          context.save();
          context.rotate((Math.PI * 2 * copy) / controls.symmetry);
          context.beginPath();
          context.moveTo(agent.px * scale, agent.py * scale);
          context.bezierCurveTo(
            agent.px * scale * 0.72,
            agent.py * scale * 1.14,
            agent.x * scale * 1.16,
            agent.y * scale * 0.74,
            agent.x * scale,
            agent.y * scale,
          );
          context.stroke();
          context.restore();
        }
      }
      context.restore();
      drawFrame();
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
  }, [controls.agents, controls.curvature, controls.speed, controls.symmetry, controls.trailFade]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />
    </div>
  );
}
