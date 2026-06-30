import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type CardControls = {
  density: number;
  drift: number;
  ink: string;
  accent: string;
};

const GLYPHS = '010101010101001101010111000101';

const drawCorner = (context: CanvasRenderingContext2D, x: number, y: number, sx: number, sy: number) => {
  context.beginPath();
  context.moveTo(x + sx * 18, y);
  context.lineTo(x, y);
  context.lineTo(x, y + sy * 18);
  context.stroke();
};

const shapeField = (x: number, y: number, variant: number, time: number) => {
  const nx = x * 2 - 1;
  const ny = y * 2 - 1;
  if (variant === 0) {
    const lobeA = Math.hypot(nx + 0.25 + Math.sin(time) * 0.04, ny * 1.25 + 0.1);
    const lobeB = Math.hypot(nx - 0.18, ny * 1.05 - 0.1);
    const cut = Math.hypot(nx * 1.2 + 0.03, ny * 1.3 + 0.02);
    return Math.max(0, 1 - Math.min(lobeA, lobeB) * 1.3) * (cut > 0.34 ? 1 : 0.22);
  }
  const body = 1 - Math.hypot(nx * 0.9 - 0.12, ny * 1.65) * 1.45;
  const tail = 1 - Math.hypot(nx * 1.8 + 0.58, ny * 3.2 - Math.sin(nx * 5 + time) * 0.12) * 1.1;
  return Math.max(0, Math.max(body, tail * 0.82));
};

const drawAsciiShape = (
  context: CanvasRenderingContext2D,
  cardX: number,
  cardY: number,
  cardW: number,
  cardH: number,
  variant: number,
  controls: CardControls,
  time: number,
) => {
  const cols = Math.max(30, controls.density);
  const rows = Math.round(cols * 0.62);
  const areaX = cardX + cardW * 0.16;
  const areaY = cardY + cardH * 0.08;
  const areaW = cardW * 0.68;
  const areaH = cardH * 0.48;

  context.save();
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `${Math.max(7, cardW / 64)}px "SFMono-Regular", Menlo, Consolas, monospace`;

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const u = x / (cols - 1);
      const v = y / (rows - 1);
      const signal = shapeField(u, v, variant, time);
      const noise = Math.sin(x * 0.51 + y * 0.31 + time * 1.5) * 0.12;
      if (signal + noise < 0.18) continue;
      const fade = Math.min(1, Math.max(0, signal + noise));
      const drift = Math.sin(time * controls.drift + x * 0.16 + y * 0.08) * 2.2;
      context.globalAlpha = fade * 0.86;
      context.fillStyle = variant === 0 ? controls.ink : controls.accent;
      context.fillText(GLYPHS[(x + y * 7 + variant * 13) % GLYPHS.length], areaX + u * areaW + drift, areaY + v * areaH);
    }
  }
  context.restore();
};

export default function Demo031AsciiMotionCards() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('ASCII Motion Cards', {
    density: {value: 58, min: 30, max: 96, step: 1},
    drift: {value: 0.74, min: 0, max: 2, step: 0.01},
    ink: '#5964bd',
    accent: '#9678d9',
  }) as CardControls;

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

    const drawCard = (x: number, y: number, w: number, h: number, variant: number, time: number) => {
      context.fillStyle = '#ffffff';
      context.fillRect(x, y, w, h);
      context.strokeStyle = '#1c1c1c';
      context.lineWidth = 1;
      drawCorner(context, x, y, 1, 1);
      drawCorner(context, x + w, y, -1, 1);
      drawCorner(context, x, y + h, 1, -1);
      drawCorner(context, x + w, y + h, -1, -1);
      drawAsciiShape(context, x, y, w, h, variant, controls, time);

      context.fillStyle = '#0b0b0b';
      context.font = `${Math.max(16, w * 0.04)}px Georgia, "Times New Roman", serif`;
      context.textAlign = 'left';
      context.fillText(variant === 0 ? 'Turn Analysis Into Authority.' : 'Share The Narrative', x + w * 0.03, y + h * 0.76);
      context.font = `${Math.max(8, w * 0.017)}px Arial, sans-serif`;
      context.fillStyle = 'rgba(0,0,0,0.48)';
      context.fillText('Generate watermarked, high-fidelity snapshots from data products.', x + w * 0.03, y + h * 0.815);
      context.fillStyle = '#0a0a0a';
      context.fillRect(x + w * 0.88, y + h * 0.75, 18, 18);
      context.fillStyle = '#ffffff';
      context.font = '12px Arial, sans-serif';
      context.fillText('↗', x + w * 0.885, y + h * 0.779);
    };

    const draw = (now: number) => {
      const time = now * 0.001;
      context.fillStyle = '#f2f2f2';
      context.fillRect(0, 0, width, height);
      const cardW = Math.min(width * 0.34, height * 0.54);
      const cardH = cardW * 1.43;
      const gap = Math.min(width * 0.1, 120);
      const startX = (width - cardW * 2 - gap) / 2;
      const y = (height - cardH) / 2;
      drawCard(startX, y, cardW, cardH, 0, time);
      drawCard(startX + cardW + gap, y, cardW, cardH, 1, time + 1.7);
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
