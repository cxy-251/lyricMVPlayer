import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type SeedformControls = {
  fibers: number;
  membraneInk: number;
  breath: number;
  seedDensity: number;
  paperGrain: number;
};

const seedNoise = (value: number) => {
  const x = Math.sin(value * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

export default function Demo047OrganicSeedformMotion() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('Organic Seedform Motion', {
    fibers: {value: 150, min: 48, max: 260, step: 1},
    membraneInk: {value: 0.92, min: 0.1, max: 1.8, step: 0.01},
    breath: {value: 0.78, min: 0, max: 1.8, step: 0.01},
    seedDensity: {value: 110, min: 30, max: 240, step: 1},
    paperGrain: {value: 0.55, min: 0, max: 1.2, step: 0.01},
  }) as SeedformControls;

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

    const boundaryPoint = (angle: number, time: number, cx: number, cy: number, rx: number, ry: number) => {
      const wobble = 1 + Math.sin(angle * 5.0 + time * 0.8) * 0.08 * controls.breath + Math.sin(angle * 9.0 - time * 0.5) * 0.045;
      const lobe = 1 + Math.max(0, Math.cos(angle - 0.15)) * 0.24;
      return {
        x: cx + Math.cos(angle) * rx * wobble * lobe,
        y: cy + Math.sin(angle) * ry * wobble,
      };
    };

    const draw = (now: number) => {
      const time = now * 0.001;
      const bg = context.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, '#f7d5cd');
      bg.addColorStop(0.55, '#f3c9c4');
      bg.addColorStop(1, '#f7ddd2');
      context.fillStyle = bg;
      context.fillRect(0, 0, width, height);
      const pageShade = context.createRadialGradient(width * 0.38, height * 0.52, 0, width * 0.38, height * 0.52, Math.max(width, height) * 0.58);
      pageShade.addColorStop(0, 'rgba(255,255,255,0.18)');
      pageShade.addColorStop(0.58, 'rgba(255,255,255,0)');
      pageShade.addColorStop(1, 'rgba(80,32,48,0.12)');
      context.fillStyle = pageShade;
      context.fillRect(0, 0, width, height);

      if (controls.paperGrain > 0) {
        context.fillStyle = `rgba(64,31,24,${0.018 * controls.paperGrain})`;
        for (let i = 0; i < 360; i += 1) {
          context.fillRect((i * 73) % width, (i * 151) % height, 1, 1);
        }
      }

      const cx = width * 0.39;
      const cy = height * 0.53;
      const rx = Math.min(width, height) * 0.34;
      const ry = Math.min(width, height) * 0.43;
      const start = -1.36;
      const end = 1.34;
      const points = Array.from({length: 90}, (_, index) => {
        const a = start + (index / 89) * (end - start);
        return boundaryPoint(a, time, cx, cy, rx, ry);
      });

      context.save();
      context.beginPath();
      context.moveTo(cx - rx * 0.12, cy - ry * 0.18);
      for (const point of points) context.lineTo(point.x, point.y);
      context.quadraticCurveTo(cx - rx * 0.22, cy + ry * 0.26, cx - rx * 0.12, cy - ry * 0.18);
      context.closePath();
      const membrane = context.createRadialGradient(cx, cy, rx * 0.08, cx + rx * 0.55, cy, rx * 1.08);
      membrane.addColorStop(0, 'rgba(245,247,232,0.92)');
      membrane.addColorStop(0.42, 'rgba(248,173,137,0.38)');
      membrane.addColorStop(0.72, 'rgba(42,52,106,0.42)');
      membrane.addColorStop(1, `rgba(0,10,40,${0.88 * controls.membraneInk})`);
      context.fillStyle = membrane;
      context.fill();
      context.strokeStyle = `rgba(8,16,42,${0.42 * controls.membraneInk})`;
      context.lineWidth = 2;
      context.stroke();
      context.clip();

      context.globalCompositeOperation = 'multiply';
      context.strokeStyle = `rgba(30,47,92,${0.18 * controls.membraneInk})`;
      for (let i = 0; i < 7; i += 1) {
        const p = boundaryPoint(0.35 + i * 0.26, time, cx, cy, rx, ry);
        context.beginPath();
        context.arc(p.x, p.y, rx * (0.18 + i * 0.006), 0, Math.PI * 2);
        context.stroke();
      }
      context.globalCompositeOperation = 'source-over';

      context.strokeStyle = 'rgba(64,87,128,0.42)';
      context.lineWidth = 0.7;
      for (let index = 0; index < controls.fibers; index += 1) {
        const t = index / Math.max(1, controls.fibers - 1);
        const angle = start + t * (end - start);
        const target = boundaryPoint(angle, time, cx, cy, rx * 0.96, ry * 0.96);
        const curve = Math.sin(t * Math.PI) * rx * 0.06;
        context.beginPath();
        context.moveTo(cx, cy);
        context.quadraticCurveTo(cx + curve, cy + Math.sin(angle) * ry * 0.14, target.x, target.y);
        context.stroke();
      }

      context.strokeStyle = 'rgba(218,82,33,0.62)';
      context.lineWidth = 2;
      for (const arc of [-0.38, 0.38]) {
        context.beginPath();
        context.arc(cx + rx * 0.16, cy, rx * 0.35, arc - 0.36 + Math.sin(time) * 0.04, arc + 0.36 + Math.sin(time) * 0.04);
        context.stroke();
      }
      context.restore();

      context.save();
      context.globalCompositeOperation = 'screen';
      context.fillStyle = 'rgba(246,255,248,0.7)';
      for (let i = 0; i < controls.seedDensity; i += 1) {
        const a = seedNoise(i) * Math.PI * 2;
        const r = Math.sqrt(seedNoise(i + 90)) * Math.min(width, height) * 0.055;
        context.beginPath();
        context.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.2 + seedNoise(i + 12) * 2.4, 0, Math.PI * 2);
        context.fill();
      }
      context.strokeStyle = 'rgba(255,255,255,0.42)';
      context.lineWidth = 0.8;
      for (let ring = 0; ring < 4; ring += 1) {
        context.beginPath();
        context.arc(cx, cy, Math.min(width, height) * (0.025 + ring * 0.015 + Math.sin(time + ring) * 0.002), 0, Math.PI * 2);
        context.stroke();
      }
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
  }, [controls.breath, controls.fibers, controls.membraneInk, controls.paperGrain, controls.seedDensity]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />
    </div>
  );
}
