import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type InspectorControls = {
  spin: boolean;
  speed: number;
  roughness: number;
  thickness: number;
  textGlow: number;
};

const drawRounded = (context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
};

export default function Demo054VisualInspectorControlLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('Visual Inspector Control Layer', {
    spin: true,
    speed: {value: 0.62, min: 0, max: 2, step: 0.01},
    roughness: {value: 0.5, min: 0, max: 1, step: 0.01},
    thickness: {value: 0.34, min: 0.06, max: 0.8, step: 0.01},
    textGlow: {value: 0.92, min: 0.1, max: 1.8, step: 0.01},
  }) as InspectorControls;

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

    const drawBlob = (time: number) => {
      const cx = width * 0.5;
      const cy = height * 0.54;
      const r = Math.min(width, height) * 0.22;
      context.save();
      context.translate(cx, cy);
      context.rotate((controls.spin ? time * controls.speed * 0.55 : 0) + 0.2);
      context.globalCompositeOperation = 'lighter';
      for (let lobe = 0; lobe < 4; lobe += 1) {
        context.save();
        context.rotate((Math.PI / 2) * lobe + Math.sin(time * 0.8 + lobe) * 0.1);
        const gradient = context.createRadialGradient(-r * 0.18, -r * 0.1, r * 0.02, 0, 0, r * 0.86);
        gradient.addColorStop(0, 'rgba(255,240,165,0.82)');
        gradient.addColorStop(0.36, `rgba(255,57,57,${0.82 - controls.roughness * 0.25})`);
        gradient.addColorStop(1, 'rgba(155,0,20,0.08)');
        context.fillStyle = gradient;
        context.beginPath();
        context.ellipse(0, 0, r * (1.2 + controls.thickness), r * (0.34 + controls.thickness * 0.45), 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
      context.restore();
    };

    const drawPanel = () => {
      const w = Math.min(320, width * 0.28);
      const x = width - w - 26;
      const y = 88;
      drawRounded(context, x, y, w, 250, 10);
      context.fillStyle = 'rgba(18,18,25,0.9)';
      context.fill();
      context.fillStyle = '#10455c';
      context.fillRect(x + 8, y + 12, w - 16, 28);
      context.fillStyle = '#bfeaff';
      context.font = '12px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText('- Demo', x + 20, y + 31);
      const rows = [
        ['text', 'Hello, world!'],
        ['spin', controls.spin ? 'on' : 'off'],
        ['speed', controls.speed.toFixed(3)],
        ['roughness', controls.roughness.toFixed(2)],
        ['thickness', controls.thickness.toFixed(2)],
        ['shape', 'Torus Knot'],
      ];
      rows.forEach(([label, value], index) => {
        const yy = y + 66 + index * 28;
        context.fillStyle = '#ddd';
        context.fillText(label, x + 18, yy);
        context.fillStyle = 'rgba(255,255,255,0.1)';
        context.fillRect(x + 105, yy - 14, w - 126, 20);
        context.fillStyle = '#dbeafe';
        context.fillText(value, x + 112, yy);
      });
      drawRounded(context, width - 180, 30, 126, 38, 12);
      context.fillStyle = 'rgba(12,76,98,0.9)';
      context.fill();
      context.fillStyle = '#fff';
      context.fillText('122 FPS', width - 135, 54);
    };

    const draw = (now: number) => {
      const time = now * 0.001;
      const bg = context.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);
      bg.addColorStop(0, '#301014');
      bg.addColorStop(1, '#13090b');
      context.fillStyle = bg;
      context.fillRect(0, 0, width, height);
      context.strokeStyle = 'rgba(255,120,120,0.08)';
      context.lineWidth = 1;
      for (let x = 0; x < width; x += 42) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + Math.sin(time + x) * 10, height);
        context.stroke();
      }
      context.save();
      context.font = `800 ${Math.min(width * 0.12, 128)}px Inter, ui-sans-serif, system-ui`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.shadowColor = '#ff312e';
      context.shadowBlur = 34 * controls.textGlow;
      context.fillStyle = '#fff0bb';
      context.fillText('Hello, world!', width * 0.5, height * 0.55);
      context.shadowBlur = 0;
      context.strokeStyle = 'rgba(255,255,255,0.16)';
      context.lineWidth = 1;
      context.strokeText('Hello, world!', width * 0.5, height * 0.55);
      context.restore();
      drawBlob(time);
      drawPanel();
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
  }, [controls.roughness, controls.speed, controls.spin, controls.textGlow, controls.thickness]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />
    </div>
  );
}
