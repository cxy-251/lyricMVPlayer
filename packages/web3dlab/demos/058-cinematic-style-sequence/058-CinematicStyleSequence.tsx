import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type SequenceControls = {
  speed: number;
  grain: number;
  lightTrails: number;
  fire: number;
  panels: number;
};

const roundRect = (context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
};

export default function Demo058CinematicStyleSequence() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('Cinematic Style Sequence', {
    speed: {value: 0.54, min: 0.05, max: 2, step: 0.01},
    grain: {value: 0.56, min: 0, max: 1.4, step: 0.01},
    lightTrails: {value: 0.84, min: 0, max: 1.8, step: 0.01},
    fire: {value: 0.86, min: 0.1, max: 1.6, step: 0.01},
    panels: {value: 5, min: 3, max: 7, step: 1},
  }) as SequenceControls;

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

    const drawFerris = (cx: number, cy: number, radius: number, phase: number, alpha: number) => {
      context.save();
      context.globalAlpha = alpha;
      context.translate(cx, cy);
      context.rotate(phase * Math.PI * 2);
      context.strokeStyle = `rgba(250,224,178,${0.48 + controls.fire * 0.22})`;
      context.lineWidth = Math.max(1, radius * 0.017);
      context.beginPath();
      context.arc(0, 0, radius, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.arc(0, 0, radius * 0.24, 0, Math.PI * 2);
      context.stroke();
      for (let i = 0; i < 16; i += 1) {
        const a = (i / 16) * Math.PI * 2;
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
        context.stroke();
        const gx = Math.cos(a) * radius;
        const gy = Math.sin(a) * radius;
        context.fillStyle = '#151515';
        context.fillRect(gx - radius * 0.035, gy - radius * 0.025, radius * 0.07, radius * 0.05);
      }
      context.restore();
    };

    const drawShot = (x: number, y: number, w: number, h: number, time: number, index: number, featured: boolean) => {
      roundRect(context, x, y, w, h, featured ? 18 : 8);
      const g = context.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, index % 2 ? '#141626' : '#101722');
      g.addColorStop(0.56, '#28120d');
      g.addColorStop(1, '#050405');
      context.fillStyle = g;
      context.fill();
      context.save();
      roundRect(context, x, y, w, h, featured ? 18 : 8);
      context.clip();
      const phase = (time + index * 0.17) % 1;
      const cx = x + w * (0.5 + Math.sin(phase * Math.PI * 2) * 0.05);
      const cy = y + h * (featured ? 0.48 : 0.5);
      const radius = Math.min(w, h) * (featured ? 0.31 : 0.28);
      const haze = context.createRadialGradient(cx, cy + radius * 0.18, 0, cx, cy, radius * 1.65);
      haze.addColorStop(0, `rgba(255,210,92,${0.28 * controls.fire})`);
      haze.addColorStop(0.32, `rgba(255,74,30,${0.23 * controls.fire})`);
      haze.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = haze;
      context.fillRect(x, y, w, h);
      drawFerris(cx, cy, radius, phase * 0.23, 0.96);
      context.globalCompositeOperation = 'lighter';
      for (let trail = 0; trail < 12; trail += 1) {
        const a = phase * Math.PI * 2 + trail * 0.55;
        context.strokeStyle = `rgba(255,${88 + trail * 12},28,${0.05 + controls.lightTrails * 0.038})`;
        context.lineWidth = (featured ? 2.4 : 1.3) + trail * 0.18;
        context.beginPath();
        context.arc(cx, cy, radius * (1.02 + trail * 0.012), a, a + (featured ? 1.1 : 0.82));
        context.stroke();
      }
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = 'rgba(0,0,0,0.48)';
      context.fillRect(x, y + h * 0.74, w, h * 0.26);
      context.fillStyle = 'rgba(255,240,220,0.78)';
      context.font = `${featured ? 13 : 10}px "SFMono-Regular", Menlo, Consolas, monospace`;
      context.fillText(`sref keyframe ${index + 1}`, x + 14, y + h - 18);
      context.restore();
    };

    const draw = (now: number) => {
      const time = now * 0.001 * controls.speed;
      const bg = context.createRadialGradient(width * 0.48, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
      bg.addColorStop(0, '#211014');
      bg.addColorStop(0.54, '#0c0809');
      bg.addColorStop(1, '#030203');
      context.fillStyle = bg;
      context.fillRect(0, 0, width, height);

      const mainW = width * 0.66;
      const mainH = height * 0.66;
      drawShot(width * 0.06, height * 0.13, mainW, mainH, time, Math.floor(time * 3) % controls.panels, true);

      const stripX = width * 0.76;
      const stripY = height * 0.13;
      const stripW = width * 0.18;
      const count = controls.panels;
      const gap = height * 0.018;
      const shotH = (mainH - gap * (count - 1)) / count;
      for (let i = 0; i < count; i += 1) {
        drawShot(stripX, stripY + i * (shotH + gap), stripW, shotH, time * 0.74, i, false);
      }

      context.fillStyle = 'rgba(255,255,255,0.08)';
      for (let i = 0; i < 22; i += 1) {
        const y = height * 0.1 + i * height * 0.035;
        context.fillRect(width * 0.04, y, width * 0.91, 1);
      }
      if (controls.grain > 0) {
        context.fillStyle = `rgba(255,255,255,${0.03 * controls.grain})`;
        for (let i = 0; i < 900; i += 1) {
          context.fillRect((i * 61) % width, (i * 113) % height, 1, 1);
        }
      }
      context.fillStyle = '#f1e8d9';
      context.font = `${Math.max(12, width * 0.014)}px "SFMono-Regular", Menlo, Consolas, monospace`;
      context.textAlign = 'center';
      context.fillText('style reference -> keyframes -> animated cinematic sequence', width / 2, height * 0.9);
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
  }, [controls.fire, controls.grain, controls.lightTrails, controls.panels, controls.speed]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />
    </div>
  );
}
