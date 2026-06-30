import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type LenticularControls = {
  parallax: number;
  foilStrength: number;
  cardTilt: number;
  expressionBlend: number;
  scanlines: number;
};

const roundRectPath = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
};

const drawFace = (context: CanvasRenderingContext2D, frame: number, size: number) => {
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.fillStyle = '#e7c3a6';
  context.strokeStyle = '#1d1715';
  context.lineWidth = size * 0.022;
  context.beginPath();
  context.ellipse(0, size * 0.02, size * 0.25, size * 0.31, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.strokeStyle = '#271b18';
  context.lineWidth = size * 0.035;
  for (let i = -4; i <= 4; i += 1) {
    context.beginPath();
    context.moveTo(i * size * 0.048, -size * 0.18);
    context.quadraticCurveTo(i * size * 0.052 + Math.sin(i) * size * 0.04, -size * 0.34, i * size * 0.075, -size * 0.22);
    context.stroke();
  }

  const surprise = Math.max(0, 1 - Math.abs(frame - 1));
  const smile = Math.max(0, 1 - Math.abs(frame - 2));
  const wink = Math.max(0, 1 - Math.abs(frame - 0));
  context.lineWidth = size * 0.012;
  context.strokeStyle = '#191515';
  context.fillStyle = '#191515';

  context.beginPath();
  context.arc(-size * 0.09, -size * 0.015, size * (0.025 + surprise * 0.012), 0, Math.PI * 2);
  context.fill();
  if (wink > 0.35) {
    context.beginPath();
    context.moveTo(size * 0.06, -size * 0.016);
    context.quadraticCurveTo(size * 0.1, -size * 0.04, size * 0.15, -size * 0.012);
    context.stroke();
  } else {
    context.beginPath();
    context.arc(size * 0.1, -size * 0.015, size * (0.025 + surprise * 0.012), 0, Math.PI * 2);
    context.fill();
  }

  context.strokeStyle = 'rgba(255,255,255,0.55)';
  context.lineWidth = size * 0.01;
  for (const x of [-size * 0.09, size * 0.1]) {
    context.beginPath();
    context.arc(x, -size * 0.015, size * 0.055, 0, Math.PI * 2);
    context.stroke();
  }

  context.strokeStyle = '#211716';
  context.lineWidth = size * 0.014;
  context.beginPath();
  if (surprise > 0.45) {
    context.ellipse(0, size * 0.13, size * 0.035, size * 0.058, 0, 0, Math.PI * 2);
  } else {
    context.moveTo(-size * 0.06, size * 0.12);
    context.quadraticCurveTo(0, size * (0.17 + smile * 0.055), size * 0.07, size * 0.12);
  }
  context.stroke();
  context.restore();
};

export default function Demo045LenticularHoloCard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({x: 0.5, active: false});
  const controls = useControls('Lenticular Holo Card', {
    parallax: {value: 0.95, min: 0, max: 1.8, step: 0.01},
    foilStrength: {value: 1.12, min: 0.1, max: 2, step: 0.01},
    cardTilt: {value: 0.78, min: 0, max: 1.6, step: 0.01},
    expressionBlend: {value: 1, min: 0, max: 1, step: 0.01},
    scanlines: {value: 0.76, min: 0, max: 1.4, step: 0.01},
  }) as LenticularControls;

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
      pointerRef.current.active = true;
    };
    const onPointerLeave = () => {
      pointerRef.current.active = false;
    };

    const draw = (now: number) => {
      const t = now * 0.001;
      const pointerX = pointerRef.current.active ? pointerRef.current.x : 0.5 + Math.sin(t * 0.45) * 0.28;
      const angle = (pointerX - 0.5) * 2 * controls.parallax;
      const bg = context.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
      bg.addColorStop(0, '#141016');
      bg.addColorStop(0.58, '#050406');
      bg.addColorStop(1, '#010102');
      context.fillStyle = bg;
      context.fillRect(0, 0, width, height);

      context.fillStyle = 'rgba(255,255,255,0.7)';
      context.textAlign = 'center';
      context.font = `${Math.max(12, Math.min(18, width * 0.017))}px "SFMono-Regular", Menlo, Consolas, monospace`;
      ['foil', 'shadow', 'blush'].forEach((label, index) => {
        const x = width / 2 - 86 + index * 86;
        if (index === Math.round((angle + 1) * 1.1)) {
          roundRectPath(context, x - 28, height * 0.11 - 13, 56, 26, 13);
          context.fillStyle = 'rgba(255,232,238,0.92)';
          context.fill();
          context.fillStyle = '#1a1113';
        } else {
          context.fillStyle = 'rgba(255,255,255,0.68)';
        }
        context.fillText(label, x, height * 0.11 - 1);
      });

      const cardW = Math.min(width * 0.44, height * 0.44, 390);
      const cardH = cardW * 1.42;
      const cx = width / 2;
      const cy = height / 2 + height * 0.04;
      context.save();
      context.translate(cx, cy);
      context.rotate(angle * 0.16 * controls.cardTilt);
      context.transform(1, angle * 0.07 * controls.cardTilt, -angle * 0.025 * controls.cardTilt, 1, 0, 0);
      context.shadowColor = 'rgba(0,0,0,0.8)';
      context.shadowBlur = 36;
      roundRectPath(context, -cardW / 2, -cardH / 2, cardW, cardH, cardW * 0.075);
      context.fillStyle = '#111';
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = 'rgba(255,255,255,0.24)';
      context.lineWidth = 1.4;
      context.stroke();
      context.clip();

      const foil = context.createLinearGradient(-cardW / 2, -cardH / 2, cardW / 2, cardH / 2);
      foil.addColorStop(0, '#ff4b7d');
      foil.addColorStop(0.18, '#ffbf3f');
      foil.addColorStop(0.36, '#55ff89');
      foil.addColorStop(0.56, '#43d8ff');
      foil.addColorStop(0.74, '#7662ff');
      foil.addColorStop(1, '#ff5fd2');
      context.fillStyle = foil;
      context.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);

      context.globalCompositeOperation = 'screen';
      context.fillStyle = `rgba(255,255,255,${0.14 * controls.foilStrength})`;
      for (let i = -20; i < 34; i += 1) {
        context.save();
        context.translate(i * cardW * 0.065 + angle * cardW * 0.14, 0);
        context.rotate(-0.58);
        context.fillRect(-cardW * 0.02, -cardH, cardW * 0.018, cardH * 2);
        context.restore();
      }
      const rainbowShift = (angle + 1) * cardW * 0.18;
      for (let band = 0; band < 8; band += 1) {
        const bandGradient = context.createLinearGradient(-cardW / 2 + rainbowShift, -cardH / 2, cardW / 2 + rainbowShift, cardH / 2);
        bandGradient.addColorStop(0, 'rgba(255,255,255,0)');
        bandGradient.addColorStop(0.42, `hsla(${band * 45}, 100%, 70%, ${0.045 * controls.foilStrength})`);
        bandGradient.addColorStop(0.7, 'rgba(255,255,255,0)');
        context.fillStyle = bandGradient;
        context.fillRect(-cardW / 2, -cardH / 2 + band * cardH * 0.11, cardW, cardH * 0.1);
      }
      context.globalCompositeOperation = 'source-over';

      context.fillStyle = 'rgba(10,18,20,0.26)';
      context.fillRect(-cardW * 0.38, cardH * 0.23, cardW * 0.76, cardH * 0.19);
      context.fillStyle = 'rgba(255,255,255,0.88)';
      context.font = `${cardW * 0.055}px "SFMono-Regular", Menlo, Consolas, monospace`;
      context.textAlign = 'left';
      context.fillText('LIKO STUDIO', -cardW * 0.38, -cardH * 0.41);
      context.textAlign = 'right';
      context.fillText('LS 90', cardW * 0.38, -cardH * 0.41);
      context.textAlign = 'left';
      context.font = `${cardW * 0.046}px Inter, ui-sans-serif, system-ui, sans-serif`;
      context.fillText('Liko Lens', -cardW * 0.35, cardH * 0.29);
      context.font = `${cardW * 0.034}px Inter, ui-sans-serif, system-ui, sans-serif`;
      context.fillText('Move around the card', -cardW * 0.35, cardH * 0.35);

      context.save();
      context.translate(angle * cardW * 0.08, -cardH * 0.04);
      drawFace(context, (angle + 1) * controls.expressionBlend + 0.55, cardW);
      context.restore();

      if (controls.scanlines > 0) {
        context.strokeStyle = `rgba(255,255,255,${0.08 * controls.scanlines})`;
        context.lineWidth = 1;
        for (let x = -cardW / 2; x < cardW / 2; x += Math.max(4, cardW * 0.022)) {
          context.beginPath();
          context.moveTo(x + angle * 12, -cardH / 2);
          context.lineTo(x - angle * 12, cardH / 2);
          context.stroke();
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
  }, [controls.cardTilt, controls.expressionBlend, controls.foilStrength, controls.parallax, controls.scanlines]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%', touchAction: 'none'}} />
    </div>
  );
}
