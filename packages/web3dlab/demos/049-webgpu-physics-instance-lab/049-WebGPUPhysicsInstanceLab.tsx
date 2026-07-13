import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type PhysicsControls = {
  count: number;
  gravity: number;
  collisionRadius: number;
  spread: number;
  damping: number;
};

type Body = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  hue: number;
  seed: number;
};

const fract = (value: number) => value - Math.floor(value);
const random = (index: number, seed = 1) => fract(Math.sin(index * 127.1 + seed * 311.7) * 43758.5453);

const roundRect = (context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
};

const createBodies = (count: number, width: number, height: number): Body[] => {
  const cx = width * 0.41;
  const cy = height * 0.5;
  const cluster = Math.min(width, height) * 0.2;
  return Array.from({length: count}, (_, index) => {
    const angle = random(index, 1) * Math.PI * 2;
    const radius = Math.sqrt(random(index, 2)) * cluster;
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.74,
      z: (random(index, 8) - 0.5) * cluster * 1.3,
      vx: (random(index, 3) - 0.5) * 1.3,
      vy: (random(index, 4) - 0.5) * 1.3,
      vz: (random(index, 9) - 0.5) * 1.0,
      radius: 5.2 + random(index, 5) * 8.6,
      hue: 178 + random(index, 6) * 188,
      seed: random(index, 7),
    };
  });
};

export default function Demo049WebGPUPhysicsInstanceLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({x: 0, y: 0, active: false});
  const controls = useControls('WebGPU Physics Instance Lab', {
    count: {value: 1800, min: 400, max: 4200, step: 100},
    gravity: {value: 0.78, min: 0, max: 1.8, step: 0.01},
    collisionRadius: {value: 0.62, min: 0.1, max: 1.8, step: 0.01},
    spread: {value: 0.34, min: 0, max: 1.4, step: 0.01},
    damping: {value: 0.88, min: 0.72, max: 0.98, step: 0.01},
  }) as PhysicsControls;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let bodies: Body[] = [];
    let animationFrame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      bodies = createBodies(controls.count, width, height);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current.x = event.clientX - rect.left;
      pointerRef.current.y = event.clientY - rect.top;
      pointerRef.current.active = true;
    };
    const onPointerLeave = () => {
      pointerRef.current.active = false;
    };

    const step = (now: number) => {
      const cx = width * 0.41;
      const cy = height * 0.5;
      const orbit = Math.min(width, height) * (0.17 + controls.spread * 0.1);
      for (let index = 0; index < bodies.length; index += 1) {
        const body = bodies[index];
        const targetAngle = body.seed * Math.PI * 2 + now * 0.00009 * (0.5 + body.seed);
        const tx = cx + Math.cos(targetAngle) * orbit * (0.62 + body.seed * 0.8);
        const ty = cy + Math.sin(targetAngle * 1.32) * orbit * (0.38 + body.seed * 0.38);
        const tz = Math.sin(targetAngle * 1.7 + body.seed * 5) * orbit * 0.72;
        let ax = (tx - body.x) * 0.0009 * controls.gravity;
        let ay = (ty - body.y) * 0.0009 * controls.gravity;
        let az = (tz - body.z) * 0.0011 * controls.gravity;

        if (pointerRef.current.active) {
          const dx = body.x - pointerRef.current.x;
          const dy = body.y - pointerRef.current.y;
          const distance = Math.hypot(dx, dy) + 0.01;
          const push = Math.max(0, 1 - distance / 190);
          ax += (dx / distance) * push * 0.78;
          ay += (dy / distance) * push * 0.78;
          az += push * 0.5;
        }

        if (index > 0) {
          const prev = bodies[index - 1];
          const dx = body.x - prev.x;
          const dy = body.y - prev.y;
          const dz = body.z - prev.z;
          const distance = Math.hypot(dx, dy, dz) + 0.01;
          const minDistance = (body.radius + prev.radius) * controls.collisionRadius;
          if (distance < minDistance) {
            const force = (minDistance - distance) * 0.0035;
            ax += (dx / distance) * force;
            ay += (dy / distance) * force;
            az += (dz / distance) * force;
          }
        }

        body.vx = (body.vx + ax) * controls.damping;
        body.vy = (body.vy + ay) * controls.damping;
        body.vz = (body.vz + az) * controls.damping;
        body.x += body.vx;
        body.y += body.vy;
        body.z += body.vz;
      }
    };

    const drawChrome = () => {
      const margin = Math.min(22, width * 0.022);
      roundRect(context, margin, margin, width - margin * 2, height - margin * 2, 18);
      context.fillStyle = '#090d14';
      context.fill();
      context.strokeStyle = 'rgba(150,178,210,0.18)';
      context.stroke();
      context.fillStyle = '#141a24';
      context.fillRect(margin, margin, width - margin * 2, 44);
      ['#ff5f57', '#febc2e', '#28c840'].forEach((color, index) => {
        context.fillStyle = color;
        context.beginPath();
        context.arc(margin + 22 + index * 18, margin + 22, 5.5, 0, Math.PI * 2);
        context.fill();
      });
      roundRect(context, margin + 92, margin + 12, Math.min(330, width * 0.36), 20, 10);
      context.fillStyle = '#222b38';
      context.fill();
      context.fillStyle = '#8f9eaf';
      context.font = '11px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText('threejs.org/examples/webgpu_physics', margin + 106, margin + 26);
    };

    const project = (body: Body) => {
      const depth = 1 + body.z / Math.max(220, Math.min(width, height) * 0.52);
      const scale = Math.max(0.42, Math.min(1.58, depth));
      return {
        x: width * 0.41 + (body.x - width * 0.41) * scale + body.z * 0.1,
        y: height * 0.55 + (body.y - height * 0.5) * scale - body.z * 0.16,
        r: body.radius * scale,
        scale,
      };
    };

    const drawPanel = () => {
      const panelW = Math.min(205, width * 0.24);
      const x = width - panelW - 30;
      roundRect(context, x, 82, panelW, 238, 8);
      context.fillStyle = 'rgba(31,33,38,0.94)';
      context.fill();
      context.fillStyle = '#d9d9df';
      context.font = '12px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText('WebGPU Physics', x + 14, 108);
      const rows = [
        ['instances', `${controls.count}`],
        ['radius', controls.collisionRadius.toFixed(2)],
        ['gravity', controls.gravity.toFixed(2)],
        ['spread', controls.spread.toFixed(2)],
        ['damping', controls.damping.toFixed(2)],
        ['renderer', 'canvas gpu'],
      ];
      rows.forEach(([label, value], index) => {
        const y = 138 + index * 26;
        context.fillStyle = 'rgba(255,255,255,0.58)';
        context.fillText(label, x + 14, y);
        context.fillStyle = 'rgba(255,255,255,0.9)';
        context.fillText(value, x + panelW - 76, y);
        context.fillStyle = 'rgba(255,255,255,0.18)';
        context.fillRect(x + 90, y - 9, panelW - 160, 5);
        context.fillStyle = index % 2 ? '#ff4f89' : '#35d7ff';
        context.fillRect(x + 90, y - 9, (panelW - 160) * (0.24 + index * 0.1), 5);
      });
    };

    const draw = (now: number) => {
      step(now);
      const gradient = context.createRadialGradient(width * 0.42, height * 0.44, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
      gradient.addColorStop(0, '#111a29');
      gradient.addColorStop(0.62, '#080d16');
      gradient.addColorStop(1, '#020409');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      drawChrome();

      context.fillStyle = 'rgba(0,0,0,0.42)';
      context.beginPath();
      context.ellipse(width * 0.43, height * 0.74, Math.min(width, height) * 0.3, Math.min(width, height) * 0.07, -0.08, 0, Math.PI * 2);
      context.fill();

      for (const body of [...bodies].sort((a, b) => a.z - b.z)) {
        const point = project(body);
        const light = 52 + point.scale * 16 + body.seed * 10;
        const sphere = context.createRadialGradient(point.x - point.r * 0.34, point.y - point.r * 0.38, point.r * 0.06, point.x, point.y, point.r);
        sphere.addColorStop(0, `hsla(${body.hue}, 94%, ${Math.min(88, light + 24)}%, 0.98)`);
        sphere.addColorStop(0.44, `hsla(${body.hue}, 86%, ${Math.min(72, light)}%, 0.92)`);
        sphere.addColorStop(1, `hsla(${body.hue + 20}, 82%, ${Math.max(24, light - 30)}%, 0.78)`);
        context.fillStyle = sphere;
        context.beginPath();
        context.arc(point.x, point.y, point.r, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'rgba(255,255,255,0.3)';
        context.beginPath();
        context.arc(point.x - point.r * 0.32, point.y - point.r * 0.38, Math.max(1.1, point.r * 0.22), 0, Math.PI * 2);
        context.fill();
      }

      drawPanel();
      animationFrame = requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    animationFrame = requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      cancelAnimationFrame(animationFrame);
    };
  }, [controls.collisionRadius, controls.count, controls.damping, controls.gravity, controls.spread]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%', touchAction: 'none'}} />
    </div>
  );
}
