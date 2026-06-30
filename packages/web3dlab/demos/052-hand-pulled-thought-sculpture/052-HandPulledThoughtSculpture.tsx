import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type ThoughtControls = {
  particlesPerSide: number;
  ribbonLength: number;
  handPull: number;
  swirl: number;
  shadow: number;
};

type Hair = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  length: number;
  seed: number;
};

const randomUnit = (index: number) => {
  const x = Math.sin(index * 91.7 + 17.3) * 43758.5453;
  return x - Math.floor(x);
};

const makeHairs = (count: number): Hair[] => (
  Array.from({length: count}, (_, index) => {
    const angle = randomUnit(index) * Math.PI * 2;
    const radius = Math.sqrt(randomUnit(index + 20)) * 0.54;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.62,
      z: randomUnit(index + 60) * 0.08,
      vx: 0,
      vy: 0,
      vz: 0,
      length: 0.035 + randomUnit(index + 40) * 0.08,
      seed: randomUnit(index + 80),
    };
  })
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

export default function Demo052HandPulledThoughtSculpture() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({x: 0, y: 0, active: false});
  const controls = useControls('Hand-Pulled Thought Sculpture', {
    particlesPerSide: {value: 56, min: 20, max: 92, step: 1},
    ribbonLength: {value: 10, min: 2, max: 24, step: 1},
    handPull: {value: 0.82, min: 0, max: 1.8, step: 0.01},
    swirl: {value: 0.75, min: 0, max: 1.8, step: 0.01},
    shadow: {value: 0.72, min: 0, max: 1.2, step: 0.01},
  }) as ThoughtControls;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let hairs: Hair[] = [];
    let frame = 0;

    const reset = () => {
      hairs = makeHairs(Math.max(120, Math.floor(controls.particlesPerSide * controls.particlesPerSide * 0.74)));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      reset();
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current.x = (event.clientX - rect.left - width / 2) / Math.min(width, height);
      pointerRef.current.y = (event.clientY - rect.top - height * 0.48) / Math.min(width, height);
      pointerRef.current.active = true;
    };
    const onPointerLeave = () => {
      pointerRef.current.active = false;
    };

    const drawCameraInset = (time: number) => {
      const w = Math.min(220, width * 0.22);
      const h = w * 0.62;
      const x = 26;
      const y = 24;
      roundRect(context, x, y, w, h, 10);
      context.fillStyle = 'rgba(18,18,18,0.92)';
      context.fill();
      context.save();
      roundRect(context, x, y, w, h, 10);
      context.clip();
      context.fillStyle = '#d7d1c8';
      context.fillRect(x, y, w, h);
      context.strokeStyle = 'rgba(0,0,0,0.16)';
      for (let i = 0; i < 5; i += 1) {
        context.beginPath();
        context.moveTo(x, y + i * h * 0.22);
        context.lineTo(x + w, y + i * h * 0.22 + Math.sin(time + i) * 3);
        context.stroke();
      }
      context.strokeStyle = '#302b25';
      context.lineWidth = 10;
      context.lineCap = 'round';
      const hx = x + w * (0.52 + Math.sin(time * 0.8) * 0.12);
      const hy = y + h * 0.44;
      for (let f = 0; f < 5; f += 1) {
        context.beginPath();
        context.moveTo(hx, hy + f * 6);
        context.quadraticCurveTo(hx + 34 + f * 8, hy - 26 + f * 4, hx + 64 + f * 6, hy - 12 + f * 12);
        context.stroke();
      }
      context.restore();
      context.fillStyle = '#f8f8f2';
      context.font = '11px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText('hand proxy', x + 12, y + h - 12);
    };

    const drawPanel = () => {
      const w = Math.min(310, width * 0.28);
      roundRect(context, width - w - 24, 24, w, 112, 8);
      context.fillStyle = 'rgba(0,0,0,0.84)';
      context.fill();
      context.fillStyle = '#f8f8f2';
      context.font = '13px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText(`Particles Per Side    ${controls.particlesPerSide}`, width - w, 52);
      context.fillText(`Ribbon length         ${controls.ribbonLength}`, width - w, 80);
      context.fillText(`Use Hand Detection    ${pointerRef.current.active ? 'mouse proxy' : 'auto'}`, width - w, 108);
    };

    const draw = (now: number) => {
      const time = now * 0.001;
      const paper = context.createLinearGradient(0, 0, width, height);
      paper.addColorStop(0, '#d6d0c6');
      paper.addColorStop(0.5, '#c5beb3');
      paper.addColorStop(1, '#b9b0a6');
      context.fillStyle = paper;
      context.fillRect(0, 0, width, height);
      context.fillStyle = 'rgba(72,64,52,0.035)';
      for (let i = 0; i < 520; i += 1) {
        context.fillRect((i * 73) % width, (i * 151) % height, 1, 1);
      }

      const size = Math.min(width, height) * 0.38;
      const cx = width * 0.5;
      const cy = height * 0.51;
      const target = pointerRef.current.active ? pointerRef.current : {x: Math.sin(time * 0.6) * 0.28, y: -0.14 + Math.cos(time * 0.47) * 0.1, active: true};
      const pullHeight = Math.max(0, 1 - Math.hypot(target.x, target.y) / 0.86) * controls.handPull;

      context.save();
      context.translate(cx, cy + size * 0.68);
      context.scale(1, 0.22);
      const shadow = context.createRadialGradient(0, 0, 0, 0, 0, size * (0.44 + pullHeight * 0.16));
      shadow.addColorStop(0, `rgba(56,54,51,${0.32 * controls.shadow})`);
      shadow.addColorStop(1, 'rgba(56,54,51,0)');
      context.fillStyle = shadow;
      context.beginPath();
      context.arc(0, 0, size * (0.48 + pullHeight * 0.12), 0, Math.PI * 2);
      context.fill();
      context.restore();

      context.save();
      context.translate(cx, cy);
      context.globalCompositeOperation = 'multiply';
      for (const hair of hairs) {
        const orbit = hair.seed * Math.PI * 2;
        const baseX = Math.cos(orbit + Math.sin(time * 0.2 + hair.seed) * 0.08) * 0.44 * Math.sqrt(hair.seed + 0.08);
        const baseY = Math.sin(orbit * 1.2) * 0.3;
        const dx = target.x - hair.x;
        const dy = target.y - hair.y;
        const dist = Math.hypot(dx, dy) + 0.001;
        const pull = Math.max(0, 1 - dist / 0.76) * controls.handPull;
        hair.vx = (hair.vx + (baseX - hair.x) * 0.012 + (dx / dist) * pull * 0.011) * 0.9;
        hair.vy = (hair.vy + (baseY - hair.y) * 0.012 + (dy / dist) * pull * 0.011) * 0.9;
        hair.vz = (hair.vz + (pull * 0.44 - hair.z) * 0.018 + Math.sin(time * controls.swirl + hair.seed * 9) * 0.001) * 0.9;
        hair.x += hair.vx;
        hair.y += hair.vy;
        hair.z += hair.vz;
        const px = hair.x * size + hair.z * size * 0.26;
        const py = hair.y * size - hair.z * size * 0.9;
        const angle = Math.atan2(hair.vy - hair.z * 0.1 + Math.sin(time + hair.seed) * 0.02, hair.vx + 0.02) + Math.PI * 0.5;
        const len = size * hair.length * controls.ribbonLength * (0.28 + pull + hair.z * 0.6);
        context.strokeStyle = `rgba(34,32,29,${0.18 + hair.z * 0.32})`;
        context.lineWidth = 0.55 + hair.z * 1.2;
        context.beginPath();
        context.moveTo(px, py);
        context.quadraticCurveTo(px + Math.cos(angle) * len * 0.34, py + Math.sin(angle) * len * 0.34 - hair.z * size * 0.22, px + Math.cos(angle) * len, py + Math.sin(angle) * len);
        context.stroke();
      }
      context.restore();

      context.fillStyle = 'rgba(30,28,25,0.14)';
      context.beginPath();
      context.arc(cx + target.x * size, cy + target.y * size - pullHeight * size * 0.46, 7 + pullHeight * 16, 0, Math.PI * 2);
      context.fill();
      drawCameraInset(time);
      drawPanel();
      frame = requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    frame = requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      cancelAnimationFrame(frame);
    };
  }, [controls.handPull, controls.particlesPerSide, controls.ribbonLength, controls.shadow, controls.swirl]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%', touchAction: 'none'}} />
    </div>
  );
}
