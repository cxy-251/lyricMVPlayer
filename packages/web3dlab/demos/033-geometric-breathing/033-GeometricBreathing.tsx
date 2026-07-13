import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type BreathingControls = {
  nodes: number;
  amplitude: number;
  frequency: number;
  phaseWinding: number;
  chordStep: number;
  radius: number;
};

type OscillatorPoint = {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  signal: number;
};

const TAU = Math.PI * 2;

export default function Demo033GeometricBreathing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<HTMLSpanElement>(null);
  const controls = useControls('Geometric Breathing', {
    nodes: {value: 9, min: 5, max: 16, step: 1, label: 'Oscillators N'},
    amplitude: {value: 0.24, min: 0.05, max: 0.42, step: 0.01, label: 'Amplitude A'},
    frequency: {value: 0.18, min: 0.05, max: 0.5, step: 0.01, label: 'Frequency f'},
    phaseWinding: {value: 1, min: 0, max: 4, step: 1, label: 'Phase winding m'},
    chordStep: {value: 2, min: 1, max: 7, step: 1, label: 'Chord step k'},
    radius: {value: 0.78, min: 0.48, max: 0.95, step: 0.01, label: 'Base radius R'},
  }) as BreathingControls;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 1;
    let height = 1;
    let animationFrame = 0;

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
      const current = controlsRef.current;
      const time = now / 1000;
      const temporalPhase = TAU * current.frequency * time;
      const centerX = width * 0.5;
      const centerY = height * (width < 720 ? 0.39 : 0.44);
      const baseRadius = Math.min(width, height) * 0.29 * current.radius;
      const nodeCount = Math.round(current.nodes);
      const phaseWinding = Math.round(current.phaseWinding);
      const chordStep = Math.max(1, Math.min(Math.floor(nodeCount / 2), Math.round(current.chordStep)));
      const points: OscillatorPoint[] = [];

      context.fillStyle = '#03050a';
      context.fillRect(0, 0, width, height);

      context.save();
      context.setLineDash([4, 7]);
      context.strokeStyle = 'rgba(218, 230, 248, 0.2)';
      context.lineWidth = 1;
      context.beginPath();
      context.arc(centerX, centerY, baseRadius, 0, TAU);
      context.stroke();
      context.restore();

      for (let index = 0; index < nodeCount; index++) {
        const theta = (TAU * index) / nodeCount - Math.PI / 2;
        const oscillatorPhase = temporalPhase + (TAU * phaseWinding * index) / nodeCount;
        const signal = Math.sin(oscillatorPhase);
        const radialScale = 1 + current.amplitude * signal;
        const radius = baseRadius * radialScale;
        const baseX = centerX + Math.cos(theta) * baseRadius;
        const baseY = centerY + Math.sin(theta) * baseRadius;
        points.push({
          x: centerX + Math.cos(theta) * radius,
          y: centerY + Math.sin(theta) * radius,
          baseX,
          baseY,
          signal,
        });

        context.strokeStyle = 'rgba(218, 230, 248, 0.1)';
        context.beginPath();
        context.moveTo(
          centerX + Math.cos(theta) * baseRadius * (1 - current.amplitude),
          centerY + Math.sin(theta) * baseRadius * (1 - current.amplitude),
        );
        context.lineTo(
          centerX + Math.cos(theta) * baseRadius * (1 + current.amplitude),
          centerY + Math.sin(theta) * baseRadius * (1 + current.amplitude),
        );
        context.stroke();
      }

      context.lineWidth = 1.2;
      for (let index = 0; index < points.length; index++) {
        const point = points[index];
        const target = points[(index + chordStep) % points.length];
        const energy = (Math.abs(point.signal) + Math.abs(target.signal)) * 0.5;
        context.strokeStyle = `rgba(130, 205, 255, ${0.12 + energy * 0.3})`;
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(target.x, target.y);
        context.stroke();
      }

      context.strokeStyle = 'rgba(241, 246, 255, 0.58)';
      context.lineWidth = 1.3;
      context.beginPath();
      points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.closePath();
      context.stroke();

      points.forEach((point, index) => {
        const positive = point.signal >= 0;
        context.strokeStyle = positive ? 'rgba(91, 220, 255, 0.72)' : 'rgba(255, 112, 190, 0.72)';
        context.lineWidth = 1.6;
        context.beginPath();
        context.moveTo(point.baseX, point.baseY);
        context.lineTo(point.x, point.y);
        context.stroke();

        context.fillStyle = positive ? '#5bdcff' : '#ff70be';
        context.beginPath();
        context.arc(point.x, point.y, 3.6 + Math.abs(point.signal) * 1.6, 0, TAU);
        context.fill();

        if (nodeCount <= 12) {
          context.fillStyle = 'rgba(230, 237, 249, 0.62)';
          context.font = '10px "SFMono-Regular", Menlo, Consolas, monospace';
          context.textAlign = 'center';
          context.fillText(`i${index}`, point.x, point.y - 10);
        }
      });

      if (phaseRef.current) {
        const wrappedPhase = ((temporalPhase % TAU) + TAU) % TAU;
        phaseRef.current.textContent = `2πft = ${wrappedPhase.toFixed(2)} rad · k = ${chordStep}`;
      }
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

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#03050a'}}>
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />
      <aside
        aria-label="Radial oscillator equations"
        style={{
          position: 'absolute',
          right: 18,
          bottom: 18,
          width: 'min(430px, calc(100vw - 36px))',
          padding: '13px 15px',
          border: '1px solid rgba(205,220,244,0.18)',
          borderRadius: 7,
          background: 'rgba(7,11,20,0.84)',
          color: '#dce8fa',
          fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace',
          fontSize: 11,
          lineHeight: 1.65,
          backdropFilter: 'blur(14px)',
        }}
      >
        <strong style={{display: 'block', marginBottom: 5, color: '#ffffff', fontSize: 10, letterSpacing: '0.08em'}}>
          RADIAL HARMONIC SYSTEM
        </strong>
        <code style={{display: 'block'}}>θᵢ = 2πi / N</code>
        <code style={{display: 'block'}}>rᵢ(t) = R[1 + A sin(2πft + 2πmi/N)]</code>
        <code style={{display: 'block'}}>pᵢ(t) = rᵢ(t)[cos θᵢ, sin θᵢ]</code>
        <code style={{display: 'block'}}>edge: i → (i + k) mod N</code>
        <span ref={phaseRef} style={{display: 'block', marginTop: 5, color: '#87dfff'}}>
          2πft = 0.00 rad
        </span>
      </aside>
    </div>
  );
}
