import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type PlasmaControls = {
  flowRate: number;
  lines: number;
  ledBloom: number;
  rotation: number;
};

const fieldPoint = (orientation: 'horizontal' | 'vertical', line: number, t: number, width: number, height: number) => {
  const offset = (line - 0.5) * 0.7;
  if (orientation === 'horizontal') {
    const x = (t - 0.5) * width * 1.2;
    const bend = Math.tanh((t - 0.5) * 7);
    return {x, y: offset * height * 0.28 * (1 - Math.exp(-Math.abs(t - 0.5) * 6)) + bend * offset * -height * 0.09};
  }
  const y = (t - 0.5) * height * 1.25;
  const bend = Math.tanh((t - 0.5) * 7);
  return {x: offset * width * 0.24 * (1 - Math.exp(-Math.abs(t - 0.5) * 6)) + bend * offset * -width * 0.08, y};
};

export default function Demo053PlasmaFieldReconnection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('Plasma Field Reconnection', {
    flowRate: {value: 1.2, min: 0.1, max: 3, step: 0.01},
    lines: {value: 1, min: 0.3, max: 1.8, step: 0.01},
    ledBloom: {value: 0.6, min: 0, max: 1.6, step: 0.01},
    rotation: {value: 0.3, min: -1, max: 1, step: 0.01},
  }) as PlasmaControls;

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

    const drawCurve = (orientation: 'horizontal' | 'vertical', line: number, color: string, alpha: number) => {
      context.strokeStyle = color;
      context.globalAlpha = alpha;
      context.beginPath();
      for (let i = 0; i <= 96; i += 1) {
        const p = fieldPoint(orientation, line, i / 96, width, height);
        if (i === 0) context.moveTo(p.x, p.y);
        else context.lineTo(p.x, p.y);
      }
      context.stroke();
    };

    const drawPanel = () => {
      const panelW = Math.min(230, width * 0.24);
      const x = width - panelW - 24;
      const y = 28;
      context.fillStyle = 'rgba(12,20,28,0.82)';
      context.fillRect(x, y, panelW, 210);
      context.fillStyle = '#ff33d1';
      context.font = '700 18px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText('NEON', x + 22, y + 36);
      context.fillText('RECONNECT', x + 22, y + 58);
      const rows = [
        ['FLOW RATE', controls.flowRate / 3],
        ['LINES', controls.lines / 1.8],
        ['LED BLOOM', controls.ledBloom / 1.6],
        ['ROTATION', (controls.rotation + 1) / 2],
      ];
      context.font = '12px "SFMono-Regular", Menlo, Consolas, monospace';
      rows.forEach(([label, value], index) => {
        const yy = y + 92 + index * 32;
        context.fillStyle = '#b7d8ff';
        context.fillText(label as string, x + 22, yy);
        context.fillStyle = 'rgba(0,0,0,0.45)';
        context.fillRect(x + 104, yy - 7, panelW - 130, 4);
        context.fillStyle = '#42f5ff';
        context.fillRect(x + 104, yy - 7, (panelW - 130) * Number(value), 4);
      });
    };

    const draw = (now: number) => {
      const time = now * 0.001;
      const background = context.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, '#090610');
      background.addColorStop(0.5, '#03161d');
      background.addColorStop(1, '#050408');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
      context.fillStyle = 'rgba(255,255,255,0.035)';
      for (let i = 0; i < 32; i += 1) {
        const y = height * (0.08 + i * 0.026);
        context.fillRect(width * 0.06, y, width * 0.64, 1);
      }

      context.save();
      context.translate(width / 2, height / 2);
      context.rotate(controls.rotation * 0.12);
      context.globalCompositeOperation = 'lighter';
      context.lineWidth = 1.2;
      const count = Math.max(5, Math.floor(16 * controls.lines));
      for (let i = 0; i < count; i += 1) {
        const line = count === 1 ? 0.5 : i / (count - 1);
        drawCurve('horizontal', line, '#21edff', 0.14 + controls.ledBloom * 0.12);
        drawCurve('vertical', line, i % 2 ? '#ffb640' : '#fff7d6', 0.12 + controls.ledBloom * 0.16);
      }
      context.lineWidth = 4 + controls.ledBloom * 8;
      drawCurve('horizontal', 0.5, '#16dfff', 0.42);
      drawCurve('vertical', 0.5, '#ffb548', 0.36);
      for (let i = 0; i < count * 4; i += 1) {
        const orientation = i % 2 ? 'horizontal' : 'vertical';
        const t = (time * 0.12 * controls.flowRate + i * 0.061) % 1;
        const p = fieldPoint(orientation, (i % count) / Math.max(1, count - 1), t, width, height);
        context.fillStyle = i % 2 ? '#dfffff' : '#fff2cb';
        context.globalAlpha = 0.48 + controls.ledBloom * 0.34;
        context.beginPath();
        context.arc(p.x, p.y, 2.2 + controls.ledBloom * 2.4, 0, Math.PI * 2);
        context.fill();
      }
      const core = context.createRadialGradient(0, 0, 0, 0, 0, Math.min(width, height) * 0.18);
      core.addColorStop(0, `rgba(255,255,255,${0.4 * controls.ledBloom})`);
      core.addColorStop(0.35, 'rgba(255,90,190,0.24)');
      core.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = core;
      context.globalAlpha = 1;
      context.beginPath();
      context.arc(0, 0, Math.min(width, height) * 0.2, 0, Math.PI * 2);
      context.fill();
      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const jet = context.createLinearGradient(0, 0, Math.cos(angle) * width * 0.34, Math.sin(angle) * height * 0.34);
        jet.addColorStop(0, `rgba(255,255,255,${0.22 * controls.ledBloom})`);
        jet.addColorStop(0.45, angle % Math.PI === 0 ? 'rgba(41,238,255,0.16)' : 'rgba(255,183,64,0.16)');
        jet.addColorStop(1, 'rgba(0,0,0,0)');
        context.strokeStyle = jet;
        context.lineWidth = 12 + controls.ledBloom * 10;
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(Math.cos(angle) * width * 0.34, Math.sin(angle) * height * 0.34);
        context.stroke();
      }
      context.restore();
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
  }, [controls.flowRate, controls.ledBloom, controls.lines, controls.rotation]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />
    </div>
  );
}
