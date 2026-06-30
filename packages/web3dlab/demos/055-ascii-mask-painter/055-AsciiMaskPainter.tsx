import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type AsciiControls = {
  density: number;
  brushSize: number;
  contrast: number;
  drift: number;
};

const CHARS = ' .:-=+*#%@';

const roundRect = (context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
};

export default function Demo055AsciiMaskPainter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<Float32Array>(new Float32Array(1));
  const pointerRef = useRef({x: 0.52, y: 0.48, active: false});
  const controls = useControls('ASCII Mask Painter', {
    density: {value: 18, min: 8, max: 36, step: 1},
    brushSize: {value: 0.16, min: 0.04, max: 0.34, step: 0.01},
    contrast: {value: 0.92, min: 0.2, max: 1.8, step: 0.01},
    drift: {value: 0.36, min: 0, max: 1.4, step: 0.01},
  }) as AsciiControls;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let frame = 0;
    let artX = 0;
    let artY = 0;
    let artW = 0;
    let artH = 0;

    const initMask = () => {
      cols = Math.max(18, Math.floor(artW / controls.density));
      rows = Math.max(14, Math.floor(artH / controls.density));
      const mask = new Float32Array(cols * rows);
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const nx = x / cols - 0.5;
          const ny = y / rows - 0.5;
          const face = Math.exp(-(nx * nx * 5.2 + ny * ny * 7.8));
          const hair = Math.exp(-((Math.abs(nx) - 0.23) ** 2 * 22 + (ny + 0.1) ** 2 * 14));
          const shoulder = Math.exp(-(nx * nx * 2.4 + (ny - 0.33) ** 2 * 22));
          mask[y * cols + x] = Math.min(1, face * 0.7 + hair * 0.65 + shoulder * 0.5);
        }
      }
      maskRef.current = mask;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      artX = width * 0.16;
      artY = height * 0.11;
      artW = width * 0.62;
      artH = height * 0.75;
      initMask();
    };

    const paint = () => {
      if (!pointerRef.current.active) return;
      const mask = maskRef.current;
      const px = pointerRef.current.x * cols;
      const py = pointerRef.current.y * rows;
      const radius = controls.brushSize * Math.min(cols, rows);
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const dist = Math.hypot(x - px, y - py);
          if (dist < radius) {
            const index = y * cols + x;
            mask[index] = Math.min(1, mask[index] + (1 - dist / radius) * 0.28);
          }
        }
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointerRef.current.x = Math.max(0, Math.min(1, (x - artX) / Math.max(1, artW)));
      pointerRef.current.y = Math.max(0, Math.min(1, (y - artY) / Math.max(1, artH)));
      pointerRef.current.active = x >= artX && x <= artX + artW && y >= artY && y <= artY + artH;
    };
    const onPointerLeave = () => {
      pointerRef.current.active = false;
    };

    const drawToolChrome = () => {
      context.fillStyle = '#111111';
      context.fillRect(0, 0, width, height);
      context.fillStyle = '#f3efe7';
      context.fillRect(width * 0.1, height * 0.06, width * 0.82, height * 0.86);
      context.fillStyle = '#1c1c1f';
      context.fillRect(width * 0.1, height * 0.06, width * 0.82, 44);
      ['mask', 'glyph', 'export'].forEach((label, index) => {
        const x = width * 0.12 + index * 76;
        roundRect(context, x, height * 0.06 + 11, 58, 22, 11);
        context.fillStyle = index === 0 ? '#f3efe7' : 'rgba(255,255,255,0.16)';
        context.fill();
        context.fillStyle = index === 0 ? '#151515' : '#e6e1d9';
        context.font = '11px "SFMono-Regular", Menlo, Consolas, monospace';
        context.textAlign = 'center';
        context.fillText(label, x + 29, height * 0.06 + 26);
      });
      context.textAlign = 'left';
      const railX = width * 0.1;
      context.fillStyle = '#202023';
      context.fillRect(railX, height * 0.06 + 44, width * 0.055, height * 0.86 - 44);
      ['+', '#', '@', '%', '*'].forEach((glyph, index) => {
        context.fillStyle = index === 1 ? '#f3efe7' : 'rgba(255,255,255,0.22)';
        context.fillRect(railX + width * 0.015, height * 0.16 + index * 54, width * 0.025, width * 0.025);
        context.fillStyle = index === 1 ? '#151515' : '#f3efe7';
        context.font = '15px "SFMono-Regular", Menlo, Consolas, monospace';
        context.textAlign = 'center';
        context.fillText(glyph, railX + width * 0.0275, height * 0.16 + index * 54 + width * 0.017);
      });
      context.textAlign = 'left';
    };

    const drawSettings = () => {
      const x = width * 0.795;
      const y = height * 0.17;
      const w = width * 0.105;
      context.fillStyle = '#242427';
      context.fillRect(x, y, w, height * 0.54);
      context.fillStyle = '#f4efe7';
      context.font = '11px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText('mask controls', x + 12, y + 24);
      const rows = [
        ['density', controls.density / 36],
        ['brush', controls.brushSize / 0.34],
        ['contrast', controls.contrast / 1.8],
        ['drift', controls.drift / 1.4],
      ];
      rows.forEach(([label, value], index) => {
        const yy = y + 64 + index * 52;
        context.fillStyle = 'rgba(255,255,255,0.64)';
        context.fillText(label as string, x + 12, yy);
        context.fillStyle = 'rgba(255,255,255,0.16)';
        context.fillRect(x + 12, yy + 12, w - 24, 7);
        context.fillStyle = '#f4efe7';
        context.fillRect(x + 12, yy + 12, (w - 24) * Number(value), 7);
      });
    };

    const draw = (now: number) => {
      paint();
      const time = now * 0.001;
      drawToolChrome();
      roundRect(context, artX, artY, artW, artH, 12);
      context.fillStyle = '#faf7f1';
      context.fill();
      context.save();
      roundRect(context, artX, artY, artW, artH, 12);
      context.clip();
      context.fillStyle = '#191819';
      context.font = `${controls.density}px "SFMono-Regular", Menlo, Consolas, monospace`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const mask = maskRef.current;
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const value = mask[y * cols + x] * controls.contrast;
          const wave = Math.sin(x * 0.28 + y * 0.21 + time * controls.drift) * 0.13;
          const v = Math.max(0, Math.min(1, value + wave));
          const char = CHARS[Math.min(CHARS.length - 1, Math.floor(v * (CHARS.length - 1)))];
          context.globalAlpha = 0.18 + v * 0.82;
          context.fillText(char, artX + (x + 0.5) * (artW / cols), artY + (y + 0.5) * (artH / rows));
          mask[y * cols + x] *= 0.998;
        }
      }
      context.globalAlpha = 1;
      const cursorX = artX + pointerRef.current.x * artW;
      const cursorY = artY + pointerRef.current.y * artH;
      context.strokeStyle = 'rgba(0,0,0,0.42)';
      context.lineWidth = 1.3;
      context.beginPath();
      context.arc(cursorX, cursorY, controls.brushSize * Math.min(artW, artH) * 0.5, 0, Math.PI * 2);
      context.stroke();
      context.restore();
      drawSettings();
      frame = requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    frame = requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      cancelAnimationFrame(frame);
    };
  }, [controls.brushSize, controls.contrast, controls.density, controls.drift]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%', touchAction: 'none'}} />
    </div>
  );
}
