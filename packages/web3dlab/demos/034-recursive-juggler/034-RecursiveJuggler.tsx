import {useControls} from 'leva';
import {useEffect, useRef, useState} from 'react';

type JugglerControls = {
  depth: number;
  speed: number;
  childScale: number;
  tossSpread: number;
  recursiveDelay: number;
  lineWeight: number;
  ink: string;
};

const TAU = Math.PI * 2;

function drawRecursiveJuggler(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  phase: number,
  depth: number,
  controls: JugglerControls,
  accumulatedScale: number,
) {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.strokeStyle = controls.ink;
  context.fillStyle = controls.ink;
  context.lineWidth = controls.lineWeight / Math.max(0.015, accumulatedScale);
  context.lineCap = 'round';
  context.lineJoin = 'round';

  const leftHand = {x: -24 + Math.sin(phase) * 5, y: -4};
  const rightHand = {x: 24 - Math.sin(phase) * 5, y: -4};
  context.beginPath();
  context.arc(0, -42, 9, 0, TAU);
  context.moveTo(0, -33);
  context.lineTo(0, 13);
  context.moveTo(0, -16);
  context.lineTo(leftHand.x, leftHand.y);
  context.moveTo(0, -16);
  context.lineTo(rightHand.x, rightHand.y);
  context.moveTo(0, 13);
  context.lineTo(-17, 42);
  context.moveTo(0, 13);
  context.lineTo(17, 42);
  context.stroke();

  if (depth > 0 && scale > 0.012) {
    for (let childIndex = 0; childIndex < 3; childIndex++) {
      const tossPhase = phase + (childIndex / 3) * TAU;
      const childX = Math.sin(tossPhase) * controls.tossSpread;
      const childY = -58 - Math.abs(Math.cos(tossPhase)) * 62;
      drawRecursiveJuggler(
        context,
        childX,
        childY,
        controls.childScale,
        phase + controls.recursiveDelay * (childIndex + 1),
        depth - 1,
        controls,
        accumulatedScale * controls.childScale,
      );
    }
  }

  context.restore();
}

export default function Demo034RecursiveJuggler() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(0);
  const controls = useControls('Recursive Juggler', {
    depth: {value: 3, min: 0, max: 5, step: 1, label: 'Recursion depth'},
    speed: {value: 0.68, min: 0.15, max: 1.4, step: 0.01, label: 'Juggle speed'},
    childScale: {value: 0.58, min: 0.46, max: 0.68, step: 0.01, label: 'Nested figure scale'},
    tossSpread: {value: 48, min: 34, max: 62, step: 1, label: 'Toss width'},
    recursiveDelay: {value: 0.42, min: 0, max: 1.2, step: 0.01, label: 'Recursive phase delay'},
    lineWeight: {value: 1.35, min: 0.7, max: 2.2, step: 0.05, label: 'Line weight'},
    ink: {value: '#eef5ff', label: 'Figure ink'},
  }) as JugglerControls;
  const controlsRef = useRef(controls);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  controlsRef.current = controls;
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 1;
    let height = 1;
    let animationFrame = 0;
    let previousTime = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      const delta = Math.min((now - previousTime) / 1000, 0.04);
      previousTime = now;
      const current = controlsRef.current;
      if (!pausedRef.current) elapsedRef.current += delta * current.speed;

      const gradient = context.createRadialGradient(
        width / 2,
        height * 0.5,
        0,
        width / 2,
        height * 0.5,
        Math.min(width, height) * 0.5,
      );
      gradient.addColorStop(0, '#101521');
      gradient.addColorStop(1, '#05070b');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      drawRecursiveJuggler(
        context,
        width / 2,
        height * 0.62,
        Math.min(width, height) * 0.0023,
        elapsedRef.current * TAU,
        Math.round(current.depth),
        current,
        Math.min(width, height) * 0.0023,
      );
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
  }, []);

  const instanceCount = (Math.pow(3, Math.round(controls.depth) + 1) - 1) / 2;

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#05070b'}}>
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          transform: 'translateX(-50%)',
          padding: 7,
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 7,
          background: 'rgba(7,10,17,0.86)',
          color: '#e8f3ff',
          fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace',
          fontSize: 11,
        }}
      >
        <button onClick={() => setPaused((value) => !value)} style={buttonStyle} type="button">
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          onClick={() => {
            elapsedRef.current = 0;
          }}
          style={buttonStyle}
          type="button"
        >
          Restart
        </button>
        <span>{instanceCount} nested jugglers</span>
      </div>
    </div>
  );
}

const buttonStyle = {
  border: '1px solid rgba(88,216,255,0.42)',
  borderRadius: 5,
  background: 'rgba(88,216,255,0.12)',
  color: '#e8f8ff',
  cursor: 'pointer',
  padding: '7px 10px',
  font: 'inherit',
  fontWeight: 700,
} as const;
