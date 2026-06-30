import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type PrismControls = {
  dispersion: number;
  beamWidth: number;
  textSplit: number;
  pulse: number;
  grain: number;
};

const drawRoundRect = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
};

const drawChromaticText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  split: number,
) => {
  context.font = `800 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const offsets = [
    {color: 'rgba(255,55,90,0.72)', dx: -split, dy: split * 0.25},
    {color: 'rgba(42,238,255,0.7)', dx: split, dy: -split * 0.18},
    {color: 'rgba(255,255,255,0.94)', dx: 0, dy: 0},
  ];
  for (const item of offsets) {
    context.fillStyle = item.color;
    context.fillText(text, x + item.dx, y + item.dy);
  }
};

export default function Demo044PrismAlbumMotion() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({x: 0, y: 0, active: false});
  const controls = useControls('Prism Album Motion', {
    dispersion: {value: 0.82, min: 0, max: 1.8, step: 0.01},
    beamWidth: {value: 0.7, min: 0.2, max: 1.8, step: 0.01},
    textSplit: {value: 0.72, min: 0, max: 1.8, step: 0.01},
    pulse: {value: 0.65, min: 0, max: 1.8, step: 0.01},
    grain: {value: 0.42, min: 0, max: 1, step: 0.01},
  }) as PrismControls;

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

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current.x = (event.clientX - rect.left) / Math.max(1, width);
      pointerRef.current.y = (event.clientY - rect.top) / Math.max(1, height);
      pointerRef.current.active = true;
    };
    const onPointerLeave = () => {
      pointerRef.current.active = false;
    };

    const drawBeam = (points: Array<[number, number]>, color: string, lineWidth: number, alpha: number) => {
      context.save();
      context.globalCompositeOperation = 'lighter';
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.globalAlpha = alpha;
      context.lineJoin = 'round';
      context.beginPath();
      context.moveTo(points[0][0], points[0][1]);
      for (const point of points.slice(1)) context.lineTo(point[0], point[1]);
      context.stroke();
      context.restore();
    };

    const draw = (now: number) => {
      const t = now * 0.001;
      const pointerTilt = pointerRef.current.active ? (pointerRef.current.x - 0.5) : Math.sin(t * 0.42) * 0.24;
      context.fillStyle = '#010105';
      context.fillRect(0, 0, width, height);
      const stageGlow = context.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.7);
      stageGlow.addColorStop(0, 'rgba(64,72,110,0.16)');
      stageGlow.addColorStop(0.5, 'rgba(13,16,32,0.16)');
      stageGlow.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = stageGlow;
      context.fillRect(0, 0, width, height);

      const panelW = Math.min(width * 0.58, height * 0.66, 620);
      const panelH = panelW * 1.28;
      const px = width / 2 - panelW / 2;
      const py = height / 2 - panelH / 2;
      drawRoundRect(context, px - panelW * 0.045, py - panelW * 0.045, panelW * 1.09, panelH * 1.09, panelW * 0.08);
      context.fillStyle = '#0c0c12';
      context.shadowColor = 'rgba(0,0,0,0.9)';
      context.shadowBlur = 46;
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = 'rgba(255,255,255,0.12)';
      context.lineWidth = 1;
      context.stroke();
      drawRoundRect(context, px, py, panelW, panelH, panelW * 0.06);
      context.fillStyle = '#050509';
      context.shadowColor = 'rgba(0,0,0,0.8)';
      context.shadowBlur = 30;
      context.fill();
      context.shadowBlur = 0;
      context.save();
      drawRoundRect(context, px, py, panelW, panelH, panelW * 0.06);
      context.clip();

      const pulse = 1 + Math.sin(t * 1.7) * 0.09 * controls.pulse;
      const cx = px + panelW * (0.5 + pointerTilt * 0.08);
      const cy = py + panelH * 0.42;
      const prism = panelW * 0.19 * pulse;
      const left = px + panelW * 0.1;
      const whiteY = cy - panelH * 0.05 + pointerTilt * panelH * 0.06;
      drawBeam([[left, whiteY], [cx - prism * 0.52, cy]], 'rgba(255,255,255,0.25)', panelW * 0.08 * controls.beamWidth, 0.46);
      drawBeam([[left, whiteY], [cx - prism * 0.52, cy]], 'rgba(255,255,255,0.95)', panelW * 0.014 * controls.beamWidth, 0.9);

      const colors = ['#ff235d', '#ff8a20', '#ffd64a', '#55ff77', '#38ddff', '#5578ff', '#ca52ff'];
      colors.forEach((color, index) => {
        const spread = (index - (colors.length - 1) / 2) * panelH * 0.022 * controls.dispersion;
        drawBeam(
          [[cx + prism * 0.48, cy], [px + panelW * 0.92, cy + spread + Math.sin(t * 1.1 + index) * 6 * controls.pulse]],
          color,
          panelW * 0.034,
          0.62,
        );
      });

      context.save();
      context.translate(cx, cy);
      context.rotate(pointerTilt * 0.16);
      context.strokeStyle = 'rgba(255,255,255,0.86)';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(0, -prism * 0.84);
      context.lineTo(prism * 0.78, prism * 0.64);
      context.lineTo(-prism * 0.82, prism * 0.64);
      context.closePath();
      context.stroke();
      const prismGradient = context.createLinearGradient(-prism, -prism, prism, prism);
      prismGradient.addColorStop(0, 'rgba(255,255,255,0.08)');
      prismGradient.addColorStop(0.55, 'rgba(255,255,255,0.32)');
      prismGradient.addColorStop(1, 'rgba(100,210,255,0.08)');
      context.fillStyle = prismGradient;
      context.fill();
      context.restore();

      drawChromaticText(context, 'DARK', cx - panelW * 0.1, cy - panelH * 0.08, panelW * 0.12, controls.textSplit * panelW * 0.016);
      drawChromaticText(context, 'SIDE', cx + panelW * 0.09, cy + panelH * 0.09, panelW * 0.12, controls.textSplit * panelW * 0.016);

      context.fillStyle = 'rgba(255,255,255,0.82)';
      context.font = `${panelW * 0.031}px "SFMono-Regular", Menlo, Consolas, monospace`;
      context.textAlign = 'left';
      context.fillText('text', px + panelW * 0.14, py + panelH * 0.72);
      context.fillText('light', px + panelW * 0.54, py + panelH * 0.72);
      for (let i = 0; i < 2; i += 1) {
        drawRoundRect(context, px + panelW * (0.28 + i * 0.36), py + panelH * 0.695, panelW * 0.13, panelH * 0.028, panelH * 0.014);
        context.fillStyle = 'rgba(255,255,255,0.9)';
        context.fill();
      }
      context.strokeStyle = 'rgba(255,255,255,0.72)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(px + panelW * 0.16, py + panelH * 0.81);
      context.lineTo(px + panelW * 0.82, py + panelH * 0.81);
      context.stroke();
      context.fillStyle = 'rgba(255,255,255,0.94)';
      context.beginPath();
      context.arc(px + panelW * (0.2 + controls.dispersion * 0.22), py + panelH * 0.81, panelW * 0.025, 0, Math.PI * 2);
      context.fill();

      context.globalCompositeOperation = 'screen';
      const flare = context.createLinearGradient(px + panelW * 0.12, py, px + panelW * 0.84, py + panelH);
      flare.addColorStop(0, 'rgba(255,255,255,0.16)');
      flare.addColorStop(0.22, 'rgba(255,255,255,0)');
      flare.addColorStop(0.68, 'rgba(58,214,255,0)');
      flare.addColorStop(1, 'rgba(58,214,255,0.12)');
      context.fillStyle = flare;
      context.fillRect(px, py, panelW, panelH);
      context.globalCompositeOperation = 'source-over';

      if (controls.grain > 0) {
        context.fillStyle = `rgba(255,255,255,${0.02 * controls.grain})`;
        for (let i = 0; i < 240; i += 1) {
          const gx = px + ((i * 47) % 997) / 997 * panelW;
          const gy = py + ((i * 89) % 997) / 997 * panelH;
          context.fillRect(gx, gy, 1, 1);
        }
      }
      context.restore();

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
  }, [controls.beamWidth, controls.dispersion, controls.grain, controls.pulse, controls.textSplit]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%', touchAction: 'none'}} />
    </div>
  );
}
