import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';

type UniverseControls = {
  nodes: number;
  scanSpeed: number;
  hudOpacity: number;
  distortion: number;
};

type UniverseNode = {
  x: number;
  y: number;
  z: number;
  seed: number;
};

const fract = (value: number) => value - Math.floor(value);

const makeNodes = (count: number): UniverseNode[] => Array.from({length: count}, (_, index) => ({
  x: fract(Math.sin(index * 17.13) * 413.8) * 2 - 1,
  y: fract(Math.sin(index * 41.7) * 177.3) * 2 - 1,
  z: fract(Math.sin(index * 9.31) * 97.2),
  seed: fract(Math.sin(index * 71.1) * 117.9),
}));

export default function Demo036SimulationUniverse() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('Simulation Universe', {
    nodes: {value: 150, min: 50, max: 320, step: 5},
    scanSpeed: {value: 0.56, min: 0.05, max: 1.6, step: 0.01},
    hudOpacity: {value: 0.52, min: 0, max: 1, step: 0.01},
    distortion: {value: 0.68, min: 0, max: 1.4, step: 0.01},
  }) as UniverseControls;
  const nodes = useMemo(() => makeNodes(controls.nodes), [controls.nodes]);

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

    const project = (node: UniverseNode, time: number) => {
      const swirl = Math.sin(time * 0.3 + node.seed * 9) * controls.distortion * 0.12;
      const x = node.x * Math.cos(swirl) - node.y * Math.sin(swirl);
      const y = node.x * Math.sin(swirl) + node.y * Math.cos(swirl);
      const scale = 0.72 + node.z * 0.42;
      return {
        x: width * (0.5 + x * scale * 0.44),
        y: height * (0.5 + y * scale * 0.44),
        z: node.z,
      };
    };

    const draw = (now: number) => {
      const time = now * 0.001;
      const scan = (time * controls.scanSpeed) % 1;
      context.fillStyle = 'rgba(1, 3, 12, 0.28)';
      context.fillRect(0, 0, width, height);

      const projected = nodes.map((node) => project(node, time));
      for (let i = 0; i < projected.length; i += 1) {
        for (let j = i + 1; j < Math.min(projected.length, i + 10); j += 1) {
          const a = projected[i];
          const b = projected[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance > Math.min(width, height) * 0.16) continue;
          const pulse = Math.max(0, 1 - Math.abs(((a.z + b.z) * 0.5 - scan)) * 4);
          context.strokeStyle = `rgba(90, 220, 255, ${0.06 + pulse * 0.34})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }

      for (const point of projected) {
        const pulse = Math.max(0, 1 - Math.abs(point.z - scan) * 5);
        context.fillStyle = `rgba(${120 + pulse * 120}, ${190 + pulse * 55}, 255, ${0.48 + pulse * 0.48})`;
        context.beginPath();
        context.arc(point.x, point.y, 1.4 + pulse * 3.8, 0, Math.PI * 2);
        context.fill();
      }

      context.strokeStyle = `rgba(100,220,255,${controls.hudOpacity * 0.22})`;
      context.lineWidth = 1;
      for (let gx = 0; gx < 8; gx += 1) {
        const x = (gx / 7) * width;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let gy = 0; gy < 5; gy += 1) {
        const y = (gy / 4) * height;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
      context.fillStyle = `rgba(215,245,255,${controls.hudOpacity})`;
      context.font = '13px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText('DARK MATTER SIMULATION // OBSERVER GRID ACTIVE', 28, 32);
      context.fillText(`SCAN PHASE ${scan.toFixed(3)} // PARTICLES ${nodes.length}`, 28, height - 28);
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
  }, [controls, nodes]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />
    </div>
  );
}
