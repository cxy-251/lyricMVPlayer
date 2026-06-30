import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type ProofControls = {
  n: number;
  phase: number;
  cubeSize: number;
  spacing: number;
};

const COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#a855f7'];

const roundRect = (context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
};

export default function Demo057SumOfSquaresProof() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('Sum Of Squares Proof', {
    n: {value: 6, min: 2, max: 9, step: 1},
    phase: {value: 0.42, min: 0, max: 1, step: 0.01},
    cubeSize: {value: 1, min: 0.55, max: 1.35, step: 0.01},
    spacing: {value: 0.78, min: 0.3, max: 1.4, step: 0.01},
  }) as ProofControls;

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

    const drawIsoCube = (x: number, y: number, size: number, color: string, alpha: number) => {
      context.save();
      context.globalAlpha = alpha;
      context.strokeStyle = 'rgba(0,0,0,0.34)';
      context.lineWidth = Math.max(0.6, size * 0.045);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + size, y + size * 0.5);
      context.lineTo(x, y + size);
      context.lineTo(x - size, y + size * 0.5);
      context.closePath();
      context.fillStyle = color;
      context.fill();
      context.stroke();
      context.fillStyle = 'rgba(0,0,0,0.2)';
      context.beginPath();
      context.moveTo(x + size, y + size * 0.5);
      context.lineTo(x + size, y + size * 1.22);
      context.lineTo(x, y + size * 1.72);
      context.lineTo(x, y + size);
      context.closePath();
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.16)';
      context.beginPath();
      context.moveTo(x - size, y + size * 0.5);
      context.lineTo(x - size, y + size * 1.22);
      context.lineTo(x, y + size * 1.72);
      context.lineTo(x, y + size);
      context.closePath();
      context.fill();
      context.restore();
    };

    const drawProofCard = (x: number, y: number, w: number, h: number, title: string, active: boolean) => {
      roundRect(context, x, y, w, h, 12);
      context.fillStyle = active ? '#fffdf8' : 'rgba(255,255,255,0.56)';
      context.fill();
      context.strokeStyle = active ? 'rgba(20,20,20,0.22)' : 'rgba(20,20,20,0.08)';
      context.stroke();
      context.fillStyle = active ? '#141414' : 'rgba(20,20,20,0.48)';
      context.font = '12px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText(title, x + 16, y + 24);
    };

    const draw = (now: number) => {
      const auto = (Math.sin(now * 0.00045) * 0.5 + 0.5) * 0.22;
      const phase = Math.min(1, controls.phase + auto);
      const bg = context.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, '#fbf7f0');
      bg.addColorStop(1, '#ece2d4');
      context.fillStyle = bg;
      context.fillRect(0, 0, width, height);
      context.fillStyle = 'rgba(48,36,24,0.035)';
      for (let i = 0; i < 420; i += 1) context.fillRect((i * 67) % width, (i * 149) % height, 1, 1);

      context.fillStyle = '#141414';
      context.font = `700 ${Math.min(32, width * 0.032)}px "SFMono-Regular", Menlo, Consolas, monospace`;
      context.textAlign = 'center';
      context.fillText('6(1^2 + 2^2 + ... + n^2) = n(n+1)(2n+1)', width / 2, height * 0.09);
      context.textAlign = 'left';

      const cardW = width * 0.24;
      const cardH = height * 0.72;
      drawProofCard(width * 0.05, height * 0.17, cardW, cardH, 'square layers', phase < 0.55);
      drawProofCard(width * 0.38, height * 0.17, width * 0.55, cardH, 'six rotated copies form one prism', phase >= 0.55);

      const baseSize = Math.min(width, height) * 0.0158 * controls.cubeSize;
      const sourceX = width * 0.13;
      const sourceY = height * 0.27;
      for (let k = 1; k <= controls.n; k += 1) {
        const color = COLORS[(k - 1) % COLORS.length];
        for (let x = 0; x < k; x += 1) {
          for (let y = 0; y < k; y += 1) {
            const px = sourceX + x * baseSize * 1.18 + (k - 1) * baseSize * 0.48;
            const py = sourceY + k * baseSize * 2.12 + y * baseSize * 0.7;
            drawIsoCube(px, py, baseSize * controls.spacing, color, 0.95);
          }
        }
        context.fillStyle = 'rgba(20,20,20,0.72)';
        context.font = `${Math.max(10, baseSize * 0.68)}px "SFMono-Regular", Menlo, Consolas, monospace`;
        context.fillText(`${k}^2`, sourceX + (k - 1) * baseSize * 1.86, sourceY + k * baseSize * 2.12 + k * baseSize * 0.82);
      }

      const prismX = width * 0.55;
      const prismY = height * 0.31;
      const copyLift = Math.sin(now * 0.001) * 0.5 + 0.5;
      for (let copy = 0; copy < 6; copy += 1) {
        const copyAngle = (copy / 6) * Math.PI * 2;
        const offsetX = Math.cos(copyAngle) * baseSize * 10 * (1 - phase);
        const offsetY = Math.sin(copyAngle) * baseSize * 6 * (1 - phase);
        context.save();
        context.translate(prismX + offsetX, prismY + offsetY);
        context.rotate((copy - 2.5) * 0.04 * (1 - phase));
        for (let k = 1; k <= controls.n; k += 1) {
          const color = COLORS[(k - 1) % COLORS.length];
          for (let x = 0; x < k; x += 1) {
            for (let y = 0; y < k; y += 1) {
              const tx = (x + (k - 1) * 0.62 + copy * 0.72) * baseSize * 1.03;
              const ty = ((controls.n - k) * 0.76 + y * 0.44 - copy * 0.36) * baseSize + copyLift * copy * 0.08;
              const alpha = 0.18 + phase * 0.72;
              drawIsoCube(tx, ty, baseSize * controls.spacing, color, alpha);
            }
          }
        }
        context.restore();
      }

      context.fillStyle = 'rgba(20,20,20,0.78)';
      context.font = `${Math.max(12, width * 0.014)}px "SFMono-Regular", Menlo, Consolas, monospace`;
      context.textAlign = 'center';
      context.fillText(`n=${controls.n}  phase=${phase.toFixed(2)}  colored square numbers become one rectangular volume`, width / 2, height * 0.92);
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
  }, [controls.cubeSize, controls.n, controls.phase, controls.spacing]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />
    </div>
  );
}
