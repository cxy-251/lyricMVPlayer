import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';

type ShapeMode = 'sphere' | 'torus' | 'helix';

type AsciiPoint = {
  x: number;
  y: number;
  z: number;
  glyph: string;
  phase: number;
};

const GLYPHS = 'WEB3D LAB 0123456789 <>/*{}[]()';

const rotatePoint = (point: AsciiPoint, rx: number, ry: number, rz: number) => {
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);

  let x = point.x;
  let y = point.y * cosX - point.z * sinX;
  let z = point.y * sinX + point.z * cosX;

  const x2 = x * cosY + z * sinY;
  z = -x * sinY + z * cosY;
  x = x2;

  return {
    x: x * cosZ - y * sinZ,
    y: x * sinZ + y * cosZ,
    z,
  };
};

const makePoints = (shape: ShapeMode, density: number): AsciiPoint[] => {
  const points: AsciiPoint[] = [];
  const push = (x: number, y: number, z: number, index: number) => {
    points.push({
      x,
      y,
      z,
      glyph: GLYPHS[index % GLYPHS.length],
      phase: (index * 0.61803398875) % 1,
    });
  };

  if (shape === 'sphere') {
    let index = 0;
    const latSteps = Math.max(10, Math.round(density * 0.62));
    const lonSteps = Math.max(18, Math.round(density * 1.22));
    for (let lat = 1; lat < latSteps; lat += 1) {
      const v = lat / latSteps;
      const phi = (v - 0.5) * Math.PI;
      const ring = Math.cos(phi);
      for (let lon = 0; lon < lonSteps; lon += 1) {
        const theta = (lon / lonSteps) * Math.PI * 2;
        push(Math.cos(theta) * ring, Math.sin(phi), Math.sin(theta) * ring, index);
        index += 1;
      }
    }
    return points;
  }

  if (shape === 'torus') {
    let index = 0;
    const majorSteps = Math.max(28, Math.round(density * 1.45));
    const minorSteps = Math.max(10, Math.round(density * 0.48));
    for (let i = 0; i < majorSteps; i += 1) {
      const u = (i / majorSteps) * Math.PI * 2;
      for (let j = 0; j < minorSteps; j += 1) {
        const v = (j / minorSteps) * Math.PI * 2;
        const r = 0.38;
        const x = (1 + r * Math.cos(v)) * Math.cos(u);
        const y = r * Math.sin(v);
        const z = (1 + r * Math.cos(v)) * Math.sin(u);
        push(x * 0.78, y * 0.78, z * 0.78, index);
        index += 1;
      }
    }
    return points;
  }

  const turns = 7.2;
  const count = Math.max(260, Math.round(density * 22));
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const theta = t * Math.PI * 2 * turns;
    const radius = 0.14 + t * 0.82;
    push(
      Math.cos(theta) * radius,
      (t - 0.5) * 1.55,
      Math.sin(theta) * radius,
      i,
    );
  }
  return points;
};

export default function Demo025ASCIIShapeRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({x: 0, y: 0, pressed: false});
  const controls = useControls('ASCII Shape', {
    shape: {value: 'sphere', options: ['sphere', 'torus', 'helix']},
    density: {value: 34, min: 16, max: 64, step: 1},
    fontSize: {value: 13, min: 8, max: 22, step: 1},
    spin: {value: 0.34, min: 0, max: 1.2, step: 0.01},
    depthFade: {value: 0.66, min: 0.2, max: 1, step: 0.01},
    color: '#f4f7ff',
    accent: '#ff4fd8',
  });

  const points = useMemo(
    () => makePoints(controls.shape as ShapeMode, controls.density),
    [controls.shape, controls.density],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

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
      const t = now * 0.001;
      const pointer = pointerRef.current;
      const rx = -0.42 + pointer.y * 0.58 + Math.sin(t * 0.21) * 0.05;
      const ry = t * controls.spin + pointer.x * 0.74;
      const rz = Math.sin(t * 0.17) * 0.16;
      const scale = Math.min(width, height) * 0.36;
      const camera = 3.2;

      const gradient = context.createRadialGradient(width * 0.5, height * 0.46, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.7);
      gradient.addColorStop(0, '#151729');
      gradient.addColorStop(0.48, '#080a14');
      gradient.addColorStop(1, '#02030a');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      context.font = `${controls.fontSize}px "SFMono-Regular", Menlo, Consolas, monospace`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      const projected = points.map((point) => {
        const p = rotatePoint(point, rx, ry, rz);
        const perspective = camera / (camera - p.z);
        return {
          point,
          x: width * 0.5 + p.x * scale * perspective,
          y: height * 0.5 + p.y * scale * perspective,
          z: p.z,
          size: perspective,
        };
      }).sort((a, b) => a.z - b.z);

      for (const item of projected) {
        const fade = (item.z + 1.3) / 2.6;
        const pulse = 0.78 + Math.sin(t * 2 + item.point.phase * 12) * 0.22;
        context.globalAlpha = Math.max(0.08, Math.min(1, (0.22 + fade * controls.depthFade) * pulse));
        context.fillStyle = fade > 0.76 ? controls.accent : controls.color;
        context.fillText(item.point.glyph, item.x, item.y);
      }

      context.globalAlpha = 1;
      context.strokeStyle = 'rgba(118, 238, 255, 0.18)';
      context.lineWidth = 1;
      context.strokeRect(24, 24, width - 48, height - 48);
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
  }, [points, controls]);

  return (
    <div className="demo-viewport">
      <canvas
        ref={canvasRef}
        style={{display: 'block', width: '100%', height: '100%', touchAction: 'none'}}
        onPointerDown={() => {
          pointerRef.current.pressed = true;
        }}
        onPointerLeave={() => {
          pointerRef.current.pressed = false;
        }}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          pointerRef.current.x = (event.clientX - rect.left) / rect.width - 0.5;
          pointerRef.current.y = (event.clientY - rect.top) / rect.height - 0.5;
        }}
        onPointerUp={() => {
          pointerRef.current.pressed = false;
        }}
      />
    </div>
  );
}
