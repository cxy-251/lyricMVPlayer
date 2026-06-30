import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type ProbeControls = {
  baseSpacing: number;
  doorwayDensity: number;
  cornerDensity: number;
  leakView: boolean;
};

type Probe = {
  x: number;
  y: number;
  risk: number;
};

const rooms = [
  {x: 0.08, y: 0.14, w: 0.34, h: 0.68},
  {x: 0.48, y: 0.14, w: 0.38, h: 0.68},
  {x: 0.36, y: 0.39, w: 0.2, h: 0.14},
];

const makeProbes = (controls: ProbeControls, width: number, height: number): Probe[] => {
  const probes: Probe[] = [];
  const spacing = Math.max(26, controls.baseSpacing);
  for (let y = height * 0.1; y < height * 0.9; y += spacing) {
    for (let x = width * 0.06; x < width * 0.92; x += spacing) {
      const nx = x / width;
      const ny = y / height;
      const nearDoor = Math.abs(nx - 0.46) < 0.12 && Math.abs(ny - 0.46) < 0.14;
      const nearCorner = rooms.some((room) => (
        Math.min(
          Math.hypot(nx - room.x, ny - room.y),
          Math.hypot(nx - (room.x + room.w), ny - room.y),
          Math.hypot(nx - room.x, ny - (room.y + room.h)),
          Math.hypot(nx - (room.x + room.w), ny - (room.y + room.h)),
        ) < 0.08
      ));
      probes.push({x, y, risk: (nearDoor ? controls.doorwayDensity : 0) + (nearCorner ? controls.cornerDensity : 0)});
      if (nearDoor) {
        for (let i = 0; i < controls.doorwayDensity; i += 1) {
          probes.push({x: x + Math.sin(i * 2.3) * spacing * 0.35, y: y + Math.cos(i * 1.7) * spacing * 0.35, risk: 1});
        }
      }
      if (nearCorner) {
        for (let i = 0; i < controls.cornerDensity; i += 1) {
          probes.push({x: x + Math.sin(i * 1.1) * spacing * 0.28, y: y + Math.cos(i * 1.4) * spacing * 0.28, risk: 0.7});
        }
      }
    }
  }
  return probes;
};

export default function Demo042ProbeDensityVisualControl() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('Probe Density Control', {
    baseSpacing: {value: 72, min: 36, max: 130, step: 2},
    doorwayDensity: {value: 4, min: 0, max: 9, step: 1},
    cornerDensity: {value: 3, min: 0, max: 8, step: 1},
    leakView: true,
  }) as ProbeControls;

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
      const time = now * 0.001;
      const probes = makeProbes(controls, width, height);
      context.fillStyle = '#07080b';
      context.fillRect(0, 0, width, height);

      for (const room of rooms) {
        const x = room.x * width;
        const y = room.y * height;
        const w = room.w * width;
        const h = room.h * height;
        context.fillStyle = 'rgba(35,42,52,0.78)';
        context.fillRect(x, y, w, h);
        context.strokeStyle = 'rgba(220,235,255,0.52)';
        context.lineWidth = 2;
        context.strokeRect(x, y, w, h);
      }

      if (controls.leakView) {
        const leak = context.createRadialGradient(width * 0.46, height * 0.46, 0, width * 0.46, height * 0.46, width * 0.22);
        leak.addColorStop(0, 'rgba(255,70,45,0.28)');
        leak.addColorStop(1, 'rgba(255,70,45,0)');
        context.fillStyle = leak;
        context.fillRect(0, 0, width, height);
      }

      for (const probe of probes) {
        const pulse = 0.7 + Math.sin(time * 2 + probe.x * 0.01 + probe.y * 0.01) * 0.3;
        context.beginPath();
        context.fillStyle = probe.risk > 0 ? `rgba(255,84,54,${0.45 + pulse * 0.35})` : `rgba(110,190,255,${0.35 + pulse * 0.25})`;
        context.arc(probe.x, probe.y, 4 + Math.min(6, probe.risk * 1.6), 0, Math.PI * 2);
        context.fill();
      }

      context.fillStyle = '#eaf6ff';
      context.font = '13px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText(`PROBE COUNT ${probes.length} // DOORWAY DENSITY ${controls.doorwayDensity} // CORNER DENSITY ${controls.cornerDensity}`, 28, 32);
      context.fillText('manual density zones reduce thin-wall leakage and dynamic lighting jumps', 28, height - 30);
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
