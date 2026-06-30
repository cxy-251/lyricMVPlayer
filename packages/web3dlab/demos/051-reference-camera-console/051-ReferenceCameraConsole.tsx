import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type CameraControls = {
  referenceStrength: number;
  maskStability: number;
  latency: number;
  gridCount: number;
  liveBlend: number;
};

const roundRect = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
};

const drawAvatar = (context: CanvasRenderingContext2D, x: number, y: number, scale: number, tint: string, alpha = 1) => {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.globalAlpha = alpha;
  context.fillStyle = '#f0d4be';
  context.beginPath();
  context.arc(0, -82, 26, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#241a18';
  context.beginPath();
  context.arc(-5, -91, 31, Math.PI * 0.94, Math.PI * 2.08);
  context.fill();
  context.fillStyle = tint;
  context.beginPath();
  context.moveTo(-50, -42);
  context.quadraticCurveTo(0, -70, 55, -42);
  context.lineTo(72, 80);
  context.quadraticCurveTo(0, 112, -72, 80);
  context.closePath();
  context.fill();
  context.fillStyle = 'rgba(0,0,0,0.34)';
  context.fillRect(-48, -2, 96, 11);
  context.restore();
};

const drawBrowserBar = (context: CanvasRenderingContext2D, width: number) => {
  context.fillStyle = '#17131d';
  context.fillRect(0, 0, width, 46);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((color, index) => {
    context.fillStyle = color;
    context.beginPath();
    context.arc(22 + index * 18, 23, 5.5, 0, Math.PI * 2);
    context.fill();
  });
  roundRect(context, 92, 12, Math.min(330, width * 0.34), 22, 11);
  context.fillStyle = '#231d2b';
  context.fill();
  context.fillStyle = '#9b91a7';
  context.font = '11px "SFMono-Regular", Menlo, Consolas, monospace';
  context.fillText('visual reference camera console', 108, 27);
};

export default function Demo051ReferenceCameraConsole() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('Reference Camera Console', {
    referenceStrength: {value: 0.74, min: 0, max: 1.4, step: 0.01},
    maskStability: {value: 0.82, min: 0.1, max: 1, step: 0.01},
    latency: {value: 0.38, min: 0, max: 1, step: 0.01},
    gridCount: {value: 14, min: 4, max: 24, step: 1},
    liveBlend: {value: 0.62, min: 0, max: 1, step: 0.01},
  }) as CameraControls;

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

    const drawReferenceSearch = (x: number, y: number, w: number, h: number) => {
      context.fillStyle = '#f4f4f8';
      context.fillRect(x, y, w, h);
      roundRect(context, x + 22, y + 22, w - 44, 38, 19);
      context.fillStyle = '#fff';
      context.fill();
      context.fillStyle = '#343a40';
      context.font = `${Math.max(12, w * 0.034)}px Inter, ui-sans-serif, system-ui`;
      context.fillText('reference outfit search', x + 46, y + 46);
      const cellW = (w - 54) / 3;
      const cellH = (h - 108) / 4;
      for (let i = 0; i < 12; i += 1) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const cx = x + 18 + col * cellW;
        const cy = y + 84 + row * cellH;
        roundRect(context, cx, cy, cellW - 12, cellH - 10, 10);
        const thumb = context.createLinearGradient(cx, cy, cx + cellW, cy + cellH);
        thumb.addColorStop(0, `hsl(${210 + i * 18}, 64%, 76%)`);
        thumb.addColorStop(1, `hsl(${300 + i * 13}, 58%, 50%)`);
        context.fillStyle = thumb;
        context.fill();
        drawAvatar(context, cx + (cellW - 12) * 0.5, cy + (cellH - 10) * 0.72, Math.min(cellW, cellH) / 300, i === 0 ? '#ff6fa6' : '#e8e8f0', 0.75);
      }
    };

    const drawTray = (x: number, y: number, w: number, h: number) => {
      context.fillStyle = '#0f0d17';
      context.fillRect(x, y, w, h);
      for (let i = 0; i < controls.gridCount; i += 1) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cellW = (w - 28) / 2;
        const cellH = Math.min(76, (h - 38) / 7);
        const cx = x + 10 + col * (cellW + 8);
        const cy = y + 12 + row * (cellH + 8);
        if (cy + cellH > y + h - 8) continue;
        roundRect(context, cx, cy, cellW, cellH, 8);
        context.fillStyle = i === 0 ? '#ff7aa8' : `hsl(${260 + i * 18}, 56%, ${44 + (i % 3) * 12}%)`;
        context.fill();
        context.fillStyle = 'rgba(255,255,255,0.72)';
        context.fillRect(cx + 6, cy + 7, 26, 5);
        context.fillStyle = 'rgba(0,0,0,0.22)';
        context.fillRect(cx + cellW - 24, cy + 8, 12, cellH - 16);
      }
    };

    const drawControls = (x: number, y: number, w: number, h: number) => {
      context.fillStyle = '#12101b';
      context.fillRect(x, y, w, h);
      context.fillStyle = '#f062aa';
      context.font = '12px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText('STEP 2 - reference-guided edit', x + 18, y + 34);
      const rows = [
        ['reference', controls.referenceStrength / 1.4],
        ['mask', controls.maskStability],
        ['latency', controls.latency],
        ['live blend', controls.liveBlend],
      ];
      rows.forEach(([label, value], index) => {
        const yy = y + 76 + index * 54;
        context.fillStyle = 'rgba(255,255,255,0.72)';
        context.fillText(label as string, x + 18, yy);
        context.fillStyle = 'rgba(255,255,255,0.12)';
        context.fillRect(x + 18, yy + 12, w - 36, 8);
        context.fillStyle = '#d9468d';
        context.fillRect(x + 18, yy + 12, (w - 36) * Number(value), 8);
      });
      roundRect(context, x + 18, y + h - 78, w - 36, 46, 12);
      context.fillStyle = '#c73372';
      context.fill();
      context.fillStyle = '#fff';
      context.textAlign = 'center';
      context.fillText('generate frame', x + w / 2, y + h - 51);
      context.textAlign = 'left';
    };

    const drawLiveStage = (x: number, y: number, w: number, h: number, time: number) => {
      context.fillStyle = '#050506';
      context.fillRect(x, y, w, h);
      const liveW = w * 0.78;
      const liveH = h * 0.46;
      const liveX = x + w * 0.11;
      const liveY = y + h * 0.2;
      roundRect(context, liveX, liveY, liveW, liveH, 12);
      const cameraGradient = context.createLinearGradient(liveX, liveY, liveX, liveY + liveH);
      cameraGradient.addColorStop(0, '#2a2521');
      cameraGradient.addColorStop(1, '#121417');
      context.fillStyle = cameraGradient;
      context.fill();
      context.save();
      roundRect(context, liveX, liveY, liveW, liveH, 12);
      context.clip();
      for (let i = 0; i < 7; i += 1) {
        context.strokeStyle = `rgba(255,255,255,${0.04 + i * 0.01})`;
        context.beginPath();
        context.moveTo(liveX, liveY + i * liveH * 0.15);
        context.lineTo(liveX + liveW, liveY + i * liveH * 0.15 + Math.sin(time + i) * 4);
        context.stroke();
      }
      drawAvatar(context, liveX + liveW * 0.5, liveY + liveH * 0.64, Math.min(liveW, liveH) / 250, '#20252d', 0.92);
      drawAvatar(
        context,
        liveX + liveW * (0.5 + Math.sin(time) * 0.012),
        liveY + liveH * 0.64,
        Math.min(liveW, liveH) / 250,
        '#ff6fa6',
        controls.referenceStrength * 0.42,
      );
      context.restore();

      roundRect(context, liveX + liveW * 0.37, liveY + liveH * 0.08, liveW * 0.25, 28, 14);
      context.fillStyle = `rgba(255,255,255,${0.12 + controls.liveBlend * 0.16})`;
      context.fill();
      context.fillStyle = '#fff';
      context.font = '12px "SFMono-Regular", Menlo, Consolas, monospace';
      context.textAlign = 'center';
      context.fillText('AI Generated', liveX + liveW * 0.495, liveY + liveH * 0.08 + 18);
      context.textAlign = 'left';

      const previewW = liveW * 0.34;
      const previewH = liveH * 0.56;
      roundRect(context, liveX + liveW * 0.55, liveY + liveH + 20, previewW, previewH, 10);
      context.fillStyle = '#171721';
      context.fill();
      drawAvatar(context, liveX + liveW * 0.72, liveY + liveH + 20 + previewH * 0.66, Math.min(previewW, previewH) / 220, '#e8e8f0', 0.95);
      context.fillStyle = 'rgba(240,80,150,0.96)';
      context.beginPath();
      context.arc(x + 54, y + 42, 7 + Math.sin(time * 3) * 2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff';
      context.font = '11px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText('LIVE CAMERA', x + 68, y + 46);
    };

    const draw = (now: number) => {
      const time = now * 0.001;
      context.fillStyle = '#0d0b12';
      context.fillRect(0, 0, width, height);
      drawBrowserBar(context, width);
      const top = 46;
      const leftW = width * 0.31;
      const trayW = width * 0.13;
      const rightW = width * 0.24;
      drawReferenceSearch(0, top, leftW, height - top);
      drawTray(leftW, top, trayW, height - top);
      drawControls(width - rightW, top, rightW, height - top);
      drawLiveStage(leftW + trayW, top, width - leftW - trayW - rightW, height - top, time);
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
  }, [controls.gridCount, controls.latency, controls.liveBlend, controls.maskStability, controls.referenceStrength]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />
    </div>
  );
}
