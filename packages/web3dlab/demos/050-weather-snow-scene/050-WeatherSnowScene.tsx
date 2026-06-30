import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type SnowControls = {
  flakes: number;
  wind: number;
  accumulation: number;
  sparkle: number;
  exposure: number;
};

type Flake = {
  x: number;
  y: number;
  z: number;
  speed: number;
  drift: number;
  size: number;
};

const noise = (value: number) => {
  const x = Math.sin(value * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const roundedRect = (context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
};

const makeFlakes = (count: number, width: number, height: number): Flake[] => (
  Array.from({length: count}, (_, index) => ({
    x: noise(index) * width,
    y: noise(index + 40) * height,
    z: noise(index + 70),
    speed: 0.3 + noise(index + 100) * 1.8,
    drift: -0.5 + noise(index + 130),
    size: 1 + noise(index + 170) * 3,
  }))
);

export default function Demo050WeatherSnowScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('Weather Snow Scene', {
    flakes: {value: 820, min: 160, max: 1800, step: 20},
    wind: {value: 0.28, min: -1.2, max: 1.2, step: 0.01},
    accumulation: {value: 0.76, min: 0, max: 1.5, step: 0.01},
    sparkle: {value: 0.7, min: 0, max: 1.8, step: 0.01},
    exposure: {value: 0.8, min: 0.25, max: 1.4, step: 0.01},
  }) as SnowControls;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let flakes: Flake[] = [];
    let animationFrame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      flakes = makeFlakes(controls.flakes, width, height);
    };

    const drawBrowser = () => {
      context.fillStyle = '#05080b';
      context.fillRect(0, 0, width, height);
      const margin = Math.min(20, width * 0.02);
      roundedRect(context, margin, margin, width - margin * 2, height - margin * 2, 14);
      context.fillStyle = '#0b1016';
      context.fill();
      context.strokeStyle = 'rgba(128,174,205,0.12)';
      context.stroke();
      context.fillStyle = '#111923';
      context.fillRect(margin, margin, width - margin * 2, 42);
      ['#ff605c', '#ffbd44', '#00ca4e'].forEach((color, index) => {
        context.fillStyle = color;
        context.beginPath();
        context.arc(margin + 20 + index * 18, margin + 21, 5.5, 0, Math.PI * 2);
        context.fill();
      });
      roundedRect(context, margin + 92, margin + 11, Math.min(330, width * 0.34), 20, 10);
      context.fillStyle = '#0a0f16';
      context.fill();
      context.fillStyle = '#6f8da4';
      context.font = '11px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText('weather-snow-system.local', margin + 106, margin + 25);
    };

    const drawCar = (x: number, baseY: number, scale: number) => {
      context.save();
      context.translate(x, baseY);
      context.scale(scale, scale);
      context.rotate(-0.04);
      context.fillStyle = 'rgba(0,0,0,0.28)';
      context.beginPath();
      context.ellipse(0, 10, 320, 52, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#8f4b3f';
      context.strokeStyle = '#2d2528';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-230, -48);
      context.lineTo(-120, -92);
      context.lineTo(86, -92);
      context.lineTo(225, -45);
      context.lineTo(242, -8);
      context.lineTo(-250, -2);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = 'rgba(185,210,225,0.42)';
      context.fillRect(-84, -82, 72, 36);
      context.fillRect(2, -82, 78, 36);
      context.fillStyle = '#3d2b28';
      context.fillRect(-232, -20, 470, 18);
      for (const wheelX of [-150, 142]) {
        context.fillStyle = '#151414';
        context.beginPath();
        context.arc(wheelX, -7, 45, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#444';
        context.beginPath();
        context.arc(wheelX, -7, 18, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = `rgba(245,248,250,${0.66 + controls.accumulation * 0.16})`;
      context.beginPath();
      context.moveTo(-202, -54);
      context.quadraticCurveTo(-50, -126, 190, -48);
      context.lineTo(210, -30);
      context.quadraticCurveTo(-10, -78, -220, -25);
      context.closePath();
      context.fill();
      context.fillStyle = `rgba(242,248,250,${0.5 + controls.accumulation * 0.2})`;
      context.beginPath();
      context.moveTo(-260, -10);
      context.quadraticCurveTo(-80, -42, 250, -14);
      context.lineTo(270, 16);
      context.quadraticCurveTo(-60, 46, -280, 18);
      context.closePath();
      context.fill();
      context.restore();
    };

    const drawPanel = () => {
      const panelW = Math.min(230, width * 0.26);
      const x = width - panelW - 26;
      roundedRect(context, x, 76, panelW, 258, 8);
      context.fillStyle = 'rgba(8,15,25,0.92)';
      context.fill();
      context.strokeStyle = 'rgba(113,191,255,0.18)';
      context.stroke();
      context.fillStyle = '#a7d6ff';
      context.font = '12px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText('SNOW STUDIO', x + 16, 102);
      const rows = [
        ['snow', controls.flakes / 1800],
        ['wind', (controls.wind + 1.2) / 2.4],
        ['accum', controls.accumulation / 1.5],
        ['sparkle', controls.sparkle / 1.8],
        ['exposure', controls.exposure / 1.4],
      ];
      rows.forEach(([label, value], index) => {
        const y = 138 + index * 32;
        context.fillStyle = 'rgba(255,255,255,0.72)';
        context.fillText(label as string, x + 16, y);
        context.fillStyle = 'rgba(178,211,236,0.24)';
        context.fillRect(x + 98, y - 11, panelW - 122, 8);
        context.fillStyle = '#bce3ff';
        context.fillRect(x + 98, y - 11, (panelW - 122) * Number(value), 8);
      });
      context.fillStyle = 'rgba(167,214,255,0.14)';
      context.fillRect(x + 16, 304, panelW - 32, 1);
    };

    const drawScene = (now: number) => {
      const stageX = width * 0.08;
      const stageY = height * 0.15;
      const stageW = width * 0.67;
      const stageH = height * 0.7;
      const groundY = stageY + stageH * 0.72;
      roundedRect(context, stageX, stageY, stageW, stageH, 8);
      const scene = context.createLinearGradient(stageX, stageY, stageX + stageW, stageY + stageH);
      scene.addColorStop(0, '#182635');
      scene.addColorStop(0.45, '#0e1720');
      scene.addColorStop(1, '#111820');
      context.fillStyle = scene;
      context.fill();
      context.save();
      roundedRect(context, stageX, stageY, stageW, stageH, 8);
      context.clip();

      const moon = context.createRadialGradient(stageX + stageW * 0.32, stageY + stageH * 0.22, 0, stageX + stageW * 0.32, stageY + stageH * 0.22, stageW * 0.34);
      moon.addColorStop(0, `rgba(180,220,255,${0.18 * controls.exposure})`);
      moon.addColorStop(1, 'rgba(180,220,255,0)');
      context.fillStyle = moon;
      context.fillRect(stageX, stageY, stageW, stageH);

      const terrain = context.createLinearGradient(stageX, groundY - 160, stageX + stageW, stageY + stageH);
      terrain.addColorStop(0, '#f3f7f6');
      terrain.addColorStop(0.62, '#d6dde1');
      terrain.addColorStop(1, '#9fa9b0');
      context.fillStyle = terrain;
      context.beginPath();
      context.moveTo(stageX, groundY - 16);
      for (let i = 0; i <= 48; i += 1) {
        const x = stageX + (i / 48) * stageW;
        const y = groundY + Math.sin(i * 0.7 + now * 0.0004) * 12 * controls.accumulation + noise(i) * 38 * controls.accumulation;
        context.lineTo(x, y);
      }
      context.lineTo(stageX + stageW, stageY + stageH);
      context.lineTo(stageX, stageY + stageH);
      context.closePath();
      context.fill();

      context.strokeStyle = 'rgba(255,255,255,0.25)';
      context.lineWidth = 1;
      for (let i = 0; i < 17; i += 1) {
        const y = groundY + i * 12;
        context.beginPath();
        context.moveTo(stageX + 28, y + Math.sin(i) * 10);
        context.quadraticCurveTo(stageX + stageW * 0.5, y - 34, stageX + stageW - 36, y + Math.cos(i) * 12);
        context.stroke();
      }
      drawCar(stageX + stageW * 0.52, groundY - 18, Math.min(width, height) / 860);

      context.globalCompositeOperation = 'screen';
      for (const flake of flakes) {
        flake.y += flake.speed * (0.45 + flake.z) * controls.exposure;
        flake.x += (flake.drift + controls.wind * 1.7) * (0.45 + flake.z);
        if (flake.y > height + 20) flake.y = -20;
        if (flake.x < -20) flake.x = width + 20;
        if (flake.x > width + 20) flake.x = -20;
        if (flake.x < stageX || flake.x > stageX + stageW || flake.y < stageY || flake.y > stageY + stageH) continue;
        const alpha = 0.22 + flake.z * 0.66;
        context.fillStyle = `rgba(235,248,255,${alpha})`;
        context.beginPath();
        context.arc(flake.x, flake.y, flake.size * (0.45 + flake.z), 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = `rgba(180,220,255,${0.07 * controls.sparkle})`;
      for (let i = 0; i < 90; i += 1) {
        const x = stageX + ((i * 83 + now * 0.012) % stageW);
        const y = stageY + stageH * (0.58 + noise(i) * 0.25);
        context.fillRect(x, y, 2, 2);
      }
      context.restore();
    };

    const draw = (now: number) => {
      drawBrowser();
      drawScene(now);
      drawPanel();
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
  }, [controls.accumulation, controls.exposure, controls.flakes, controls.sparkle, controls.wind]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />
    </div>
  );
}
