import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type MetaballControls = {
  blobCount: number;
  viscosity: number;
  glow: number;
  speed: number;
  trail: number;
};

type Blob = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
};

type PhoneRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
};

const roundedRect = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
};

const randomValue = (index: number) => {
  const value = Math.sin(index * 127.1 + 19.7) * 43758.5453;
  return value - Math.floor(value);
};

const makeBlobs = (count: number, width: number, height: number): Blob[] => (
  Array.from({length: count}, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1);
    return {
      x: width * (0.3 + Math.sin(t * Math.PI * 1.25) * 0.18),
      y: height * (0.72 - t * 0.48),
      vx: 0,
      vy: 0,
      radius: width * (0.085 + (1 - t) * 0.07 + randomValue(index) * 0.018),
      phase: randomValue(index + 20) * Math.PI * 2,
    };
  })
);

const drawSourceBoard = (context: CanvasRenderingContext2D, width: number, height: number, time: number) => {
  context.save();
  context.fillStyle = '#030406';
  context.fillRect(0, 0, width, height);
  const cols = 4;
  const rows = 3;
  const tileW = width / cols;
  const tileH = height / rows;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const index = y * cols + x;
      const px = x * tileW + tileW * 0.08;
      const py = y * tileH + tileH * 0.1;
      const w = tileW * 0.78;
      const h = tileH * 0.74;
      roundedRect(context, px, py, w, h, Math.min(w, h) * 0.08);
      const bg = context.createLinearGradient(px, py, px + w, py + h);
      bg.addColorStop(0, index % 2 ? '#111227' : '#09131d');
      bg.addColorStop(1, index % 3 ? '#251126' : '#07120f');
      context.fillStyle = bg;
      context.globalAlpha = 0.32;
      context.fill();
      context.globalAlpha = 1;
      context.save();
      context.clip();
      context.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i += 1) {
        const cx = px + w * (0.22 + randomValue(index * 9 + i) * 0.58);
        const cy = py + h * (0.22 + randomValue(index * 13 + i) * 0.58);
        const r = Math.min(w, h) * (0.11 + randomValue(index * 17 + i) * 0.12);
        const g = context.createRadialGradient(cx, cy, 1, cx, cy, r);
        g.addColorStop(0, 'rgba(255,255,255,0.35)');
        g.addColorStop(0.34, index % 2 ? 'rgba(255,38,142,0.28)' : 'rgba(55,214,255,0.25)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = g;
        context.beginPath();
        context.arc(cx + Math.sin(time * 0.001 + i) * 4, cy, r, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
  }
  const shade = context.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.6);
  shade.addColorStop(0, 'rgba(0,0,0,0.02)');
  shade.addColorStop(0.58, 'rgba(0,0,0,0.38)');
  shade.addColorStop(1, 'rgba(0,0,0,0.84)');
  context.fillStyle = shade;
  context.fillRect(0, 0, width, height);
  context.restore();
};

const drawPhoneShell = (context: CanvasRenderingContext2D, phone: PhoneRect, time: number) => {
  context.save();
  context.translate(Math.sin(time * 0.0005) * 3, Math.cos(time * 0.00043) * 2);
  roundedRect(context, phone.x - 12, phone.y - 12, phone.width + 24, phone.height + 24, phone.radius + 16);
  context.shadowColor = 'rgba(0,0,0,0.9)';
  context.shadowBlur = 46;
  context.fillStyle = '#111115';
  context.fill();
  context.shadowBlur = 0;
  roundedRect(context, phone.x - 6, phone.y - 6, phone.width + 12, phone.height + 12, phone.radius + 8);
  const rim = context.createLinearGradient(phone.x, phone.y, phone.x + phone.width, phone.y + phone.height);
  rim.addColorStop(0, '#1b1b22');
  rim.addColorStop(0.45, '#050507');
  rim.addColorStop(1, '#2b2b33');
  context.fillStyle = rim;
  context.fill();
  roundedRect(context, phone.x + phone.width * 0.34, phone.y + phone.width * 0.034, phone.width * 0.32, phone.width * 0.042, phone.width * 0.02);
  context.fillStyle = '#101014';
  context.fill();
  context.restore();
};

export default function Demo043MetaballLiquidUI() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({x: 0, y: 0, active: false});
  const controls = useControls('Metaball Liquid UI', {
    blobCount: {value: 8, min: 3, max: 16, step: 1},
    viscosity: {value: 0.78, min: 0.1, max: 1.8, step: 0.01},
    glow: {value: 1.05, min: 0.2, max: 2.2, step: 0.01},
    speed: {value: 0.78, min: 0.1, max: 2.4, step: 0.01},
    trail: {value: 0.28, min: 0, max: 0.85, step: 0.01},
  }) as MetaballControls;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let blobs: Blob[] = [];
    let frame = 0;

    const getPhoneRect = () => {
      const phoneW = Math.min(width * 0.48, height * 0.43, 430);
      const phoneH = Math.min(height * 0.86, phoneW * 1.92);
      return {
        x: width / 2 - phoneW / 2,
        y: height / 2 - phoneH / 2,
        width: phoneW,
        height: phoneH,
        radius: phoneW * 0.12,
      };
    };

    const reset = () => {
      const phone = getPhoneRect();
      blobs = makeBlobs(controls.blobCount, phone.width, phone.height);
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
      pointerRef.current.x = event.clientX - rect.left;
      pointerRef.current.y = event.clientY - rect.top;
      pointerRef.current.active = true;
    };
    const onPointerLeave = () => {
      pointerRef.current.active = false;
    };

    const updateBlobs = (time: number) => {
      const phone = getPhoneRect();
      const pointer = pointerRef.current;
      for (let index = 0; index < blobs.length; index += 1) {
        const blob = blobs[index];
        const t = blobs.length === 1 ? 0.5 : index / (blobs.length - 1);
        const targetX = phone.width * (0.35 + Math.sin(time * 0.0007 * controls.speed + t * 2.6) * 0.16);
        const targetY = phone.height * (0.74 - t * 0.5 + Math.sin(time * 0.001 + blob.phase) * 0.025);
        let ax = (targetX - blob.x) * 0.006 * controls.viscosity;
        let ay = (targetY - blob.y) * 0.006 * controls.viscosity;

        if (pointer.active) {
          const localX = pointer.x - phone.x;
          const localY = pointer.y - phone.y;
          const dx = localX - blob.x;
          const dy = localY - blob.y;
          const distance = Math.hypot(dx, dy) + 0.001;
          const pull = Math.max(0, 1 - distance / (phone.width * 0.72));
          ax += (dx / distance) * pull * 0.52;
          ay += (dy / distance) * pull * 0.52;
        }

        blob.vx = (blob.vx + ax) * (0.83 + controls.viscosity * 0.045);
        blob.vy = (blob.vy + ay) * (0.83 + controls.viscosity * 0.045);
        blob.x += blob.vx;
        blob.y += blob.vy;
      }
    };

    const draw = (time: number) => {
      updateBlobs(time);
      drawSourceBoard(context, width, height, time);

      const phone = getPhoneRect();
      drawPhoneShell(context, phone, time);

      context.save();
      roundedRect(context, phone.x, phone.y, phone.width, phone.height, phone.radius);
      const screen = context.createLinearGradient(phone.x, phone.y, phone.x, phone.y + phone.height);
      screen.addColorStop(0, '#030308');
      screen.addColorStop(0.55, '#010105');
      screen.addColorStop(1, '#07070f');
      context.fillStyle = screen;
      context.fill();
      context.clip();

      context.save();
      context.filter = `blur(${phone.width * 0.042}px) contrast(22) saturate(1.95)`;
      context.globalCompositeOperation = 'lighter';
      for (const blob of blobs) {
        const gradient = context.createRadialGradient(
          phone.x + blob.x - blob.radius * 0.28,
          phone.y + blob.y - blob.radius * 0.22,
          1,
          phone.x + blob.x,
          phone.y + blob.y,
          blob.radius * 1.15,
        );
        gradient.addColorStop(0, `rgba(255,255,255,${0.9 * controls.glow})`);
        gradient.addColorStop(0.22, `rgba(255,54,126,${0.8 * controls.glow})`);
        gradient.addColorStop(0.58, `rgba(176,36,255,${0.72 * controls.glow})`);
        gradient.addColorStop(1, 'rgba(28,190,255,0.26)');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(phone.x + blob.x, phone.y + blob.y, blob.radius, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();

      context.globalCompositeOperation = 'lighter';
      for (let pass = 0; pass < 3; pass += 1) {
        context.strokeStyle = pass === 0 ? `rgba(255,72,160,${0.2 * controls.glow})` : pass === 1 ? `rgba(58,205,255,${0.2 * controls.glow})` : `rgba(255,255,255,${0.18 * controls.glow})`;
        context.lineWidth = 1.2 + pass * 2.2;
        context.beginPath();
        for (let index = 0; index < blobs.length; index += 1) {
          const blob = blobs[index];
          const offset = (pass - 1) * phone.width * 0.012;
          if (index === 0) context.moveTo(phone.x + blob.x + offset, phone.y + blob.y);
          else context.lineTo(phone.x + blob.x + offset, phone.y + blob.y);
        }
        context.stroke();
      }

      for (const blob of blobs) {
        context.fillStyle = 'rgba(255,255,255,0.64)';
        context.beginPath();
        context.arc(phone.x + blob.x - blob.radius * 0.32, phone.y + blob.y - blob.radius * 0.42, Math.max(3, blob.radius * 0.11), 0, Math.PI * 2);
        context.fill();
      }
      context.globalCompositeOperation = 'source-over';

      const glass = context.createLinearGradient(phone.x, phone.y, phone.x + phone.width, phone.y + phone.height);
      glass.addColorStop(0, 'rgba(255,255,255,0.16)');
      glass.addColorStop(0.24, 'rgba(255,255,255,0)');
      glass.addColorStop(0.68, 'rgba(0,0,0,0)');
      glass.addColorStop(1, 'rgba(255,255,255,0.08)');
      context.fillStyle = glass;
      context.fillRect(phone.x, phone.y, phone.width, phone.height);
      context.strokeStyle = 'rgba(255,255,255,0.16)';
      context.lineWidth = 1;
      roundedRect(context, phone.x + 1, phone.y + 1, phone.width - 2, phone.height - 2, phone.radius);
      context.stroke();

      context.fillStyle = 'rgba(255,255,255,0.75)';
      context.font = `${Math.max(12, phone.width * 0.038)}px "SFMono-Regular", Menlo, Consolas, monospace`;
      context.textAlign = 'center';
      context.fillText('metaball liquid ui', phone.x + phone.width / 2, phone.y + phone.height - phone.width * 0.08);
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
  }, [controls.blobCount, controls.glow, controls.speed, controls.trail, controls.viscosity]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%', touchAction: 'none'}} />
    </div>
  );
}
