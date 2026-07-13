import {useControls} from 'leva';
import {useEffect, useRef, useState} from 'react';

type SortMode = 'attract' | 'stack' | 'poles' | 'rings';

type SortingControls = {
  samplesPerMethod: number;
  settleTime: number;
  pointSize: number;
  trailPersistence: number;
  motionNoise: number;
};

type ColorParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
  saturation: number;
  lightness: number;
  seed: number;
  mode: SortMode;
};

const MODES: SortMode[] = ['attract', 'stack', 'poles', 'rings'];
const MODE_LABELS: Record<SortMode, string> = {
  attract: 'HUE ATTRACTORS',
  stack: 'SATURATION STACK',
  poles: 'HUE POLES',
  rings: 'CHROMA RINGS',
};

const fract = (value: number) => value - Math.floor(value);

const randomFromIndex = (index: number, seed: number) => fract(Math.sin(index * 127.1 + seed * 311.7) * 43758.5453123);

const makeParticles = (perMode: number, width: number, height: number, seed: number): ColorParticle[] => {
  const particles: ColorParticle[] = [];
  for (const mode of MODES) {
    for (let index = 0; index < perMode; index += 1) {
      // Each method receives the same color sample at the same local index.
      const a = randomFromIndex(index, seed);
      const b = randomFromIndex(index + 97, seed);
      const c = randomFromIndex(index + 211, seed);
      const box = columnBounds(mode, width, height);
      particles.push({
        x: box.left + randomFromIndex(index + 701, seed) * (box.right - box.left),
        y: box.top + randomFromIndex(index + 907, seed) * (box.bottom - box.top),
        vx: 0,
        vy: 0,
        hue: (a * 360 + seed * 23) % 360,
        saturation: 62 + b * 38,
        lightness: 42 + c * 38,
        seed: randomFromIndex(index + 509, seed),
        mode,
      });
    }
  }
  return particles;
};

const columnBounds = (mode: SortMode, width: number, height: number) => {
  const index = MODES.indexOf(mode);
  const top = height * 0.2;
  const bottom = height * 0.9;
  const columnWidth = width / MODES.length;
  const left = index * columnWidth + columnWidth * 0.08;
  const right = (index + 1) * columnWidth - columnWidth * 0.08;
  return {left, right, top, bottom, centerX: (left + right) / 2, centerY: (top + bottom) / 2, columnWidth};
};

const getTarget = (particle: ColorParticle, index: number, total: number, width: number, height: number) => {
  const box = columnBounds(particle.mode, width, height);
  const hue = particle.hue / 360;
  const saturation = particle.saturation / 100;
  const lightness = particle.lightness / 100;
  const usableWidth = Math.max(1, box.right - box.left);
  const usableHeight = Math.max(1, box.bottom - box.top);

  if (particle.mode === 'attract') {
    const anchorIndex = Math.floor(hue * 4) % 4;
    const anchors = [
      [box.left + usableWidth * 0.12, box.top + usableHeight * 0.08],
      [box.right - usableWidth * 0.12, box.top + usableHeight * 0.12],
      [box.left + usableWidth * 0.16, box.bottom - usableHeight * 0.12],
      [box.right - usableWidth * 0.16, box.bottom - usableHeight * 0.08],
    ];
    const anchor = anchors[anchorIndex];
    return {
      x: anchor[0] + (particle.seed - 0.5) * usableWidth * 0.22,
      y: anchor[1] + (saturation - 0.7) * usableHeight * 0.22,
    };
  }

  if (particle.mode === 'stack') {
    return {
      x: box.left + saturation * usableWidth + (particle.seed - 0.5) * 18,
      y: box.top + (1 - lightness) * usableHeight,
    };
  }

  if (particle.mode === 'poles') {
    const pole = Math.floor(hue * 5);
    const poleX = box.left + ((pole + 0.5) / 5) * usableWidth;
    return {
      x: poleX + Math.sin(lightness * Math.PI * 2 + particle.seed * 3) * 18,
      y: box.top + (1 - lightness) * usableHeight,
    };
  }

  const angle = hue * Math.PI * 2;
  const radius = Math.min(usableWidth, usableHeight) * (0.16 + saturation * 0.34);
  return {
    x: box.centerX + Math.cos(angle) * radius,
    y: box.centerY + Math.sin(angle) * radius * 0.78,
  };
};

export default function Demo030ColorSortingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const seedRef = useRef(1);
  const shuffleRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(false);
  const statusRef = useRef<HTMLSpanElement>(null);
  const [paused, setPaused] = useState(false);
  const controls = useControls('Color Sorting Particles', {
    samplesPerMethod: {value: 320, min: 120, max: 720, step: 40, label: 'Samples per method'},
    settleTime: {value: 1.8, min: 0.7, max: 4, step: 0.1, label: 'Sorting time'},
    pointSize: {value: 2.4, min: 1.2, max: 4.8, step: 0.1, label: 'Sample size'},
    trailPersistence: {value: 0.32, min: 0, max: 0.72, step: 0.01, label: 'Trail persistence'},
    motionNoise: {value: 0.18, min: 0, max: 0.5, step: 0.01, label: 'Motion noise'},
  }) as SortingControls;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrame = 0;
    let particles: ColorParticle[] = [];
    let previousTime = performance.now();
    let statusFrame = 0;

    const resetParticles = () => {
      const perMode = controlsRef.current.samplesPerMethod;
      particles = makeParticles(perMode, width, height, seedRef.current);
      if (statusRef.current) statusRef.current.textContent = 'Sorting 0%';
    };
    shuffleRef.current = resetParticles;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      resetParticles();
    };

    const drawLabels = () => {
      context.save();
      context.fillStyle = '#f4f4f4';
      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.font = '700 11px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillStyle = 'rgba(242, 247, 255, 0.66)';
      context.fillText('SAME COLOR SET · FOUR SORTING RULES', width / 2, height * 0.055);
      context.font = `${width < 720 ? 8 : 10}px "SFMono-Regular", Menlo, Consolas, monospace`;
      for (const mode of MODES) {
        const box = columnBounds(mode, width, height);
        context.fillText(width < 720 ? mode.toUpperCase() : MODE_LABELS[mode], box.centerX, height * 0.13);
      }
      context.restore();
    };

    const draw = (now: number) => {
      const delta = Math.min((now - previousTime) / 1000, 0.04);
      previousTime = now;
      const current = controlsRef.current;
      context.fillStyle = `rgba(1, 3, 10, ${1 - current.trailPersistence * 0.82})`;
      context.fillRect(0, 0, width, height);
      context.fillStyle = 'rgba(255, 255, 255, 0.03)';
      for (const mode of MODES) {
        const box = columnBounds(mode, width, height);
        context.fillRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
      }

      const omega = 5 / Math.max(0.2, current.settleTime);
      const damping = Math.exp(-omega * 2 * delta);
      let totalDistance = 0;
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        const target = getTarget(particle, index, particles.length, width, height);
        if (!pausedRef.current) {
          particle.vx += (target.x - particle.x) * omega * omega * delta;
          particle.vy += (target.y - particle.y) * omega * omega * delta;
          particle.vx += Math.sin(now * 0.0013 + particle.seed * 19) * current.motionNoise;
          particle.vy += Math.cos(now * 0.0011 + particle.seed * 23) * current.motionNoise;
          particle.vx *= damping;
          particle.vy *= damping;
          particle.x += particle.vx * delta;
          particle.y += particle.vy * delta;
        }
        totalDistance += Math.hypot(target.x - particle.x, target.y - particle.y);

        context.beginPath();
        context.fillStyle = `hsl(${particle.hue} ${particle.saturation}% ${particle.lightness}%)`;
        context.globalAlpha = 0.72 + particle.seed * 0.28;
        context.arc(particle.x, particle.y, current.pointSize * (0.65 + particle.seed * 0.75), 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;
      drawLabels();
      statusFrame += 1;
      if (statusFrame % 8 === 0 && statusRef.current && particles.length > 0) {
        const averageDistance = totalDistance / particles.length;
        const progress = Math.round((1 - Math.min(1, averageDistance / (width * 0.12))) * 100);
        statusRef.current.textContent = pausedRef.current ? `Paused · ${progress}%` : `Sorting ${progress}%`;
      }
      animationFrame = requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    animationFrame = requestAnimationFrame(draw);
    return () => {
      shuffleRef.current = null;
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [controls.samplesPerMethod]);

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#02050d'}}>
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 22,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          transform: 'translateX(-50%)',
          padding: '8px 10px',
          border: '1px solid rgba(255,255,255,0.16)',
          borderRadius: 7,
          background: 'rgba(5,9,20,0.82)',
          color: '#eef5ff',
          fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace',
          backdropFilter: 'blur(14px)',
        }}
      >
        <button
          onClick={() => {
            seedRef.current += 1;
            shuffleRef.current?.();
          }}
          style={{
            border: '1px solid rgba(101,242,213,0.46)',
            borderRadius: 5,
            background: 'rgba(101,242,213,0.14)',
            color: '#d9fff7',
            cursor: 'pointer',
            padding: '7px 11px',
            font: 'inherit',
            fontWeight: 700,
          }}
          type="button"
        >
          Shuffle input
        </button>
        <button
          onClick={() => setPaused((value) => !value)}
          style={{
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 5,
            background: 'rgba(255,255,255,0.08)',
            color: '#f7f9ff',
            cursor: 'pointer',
            padding: '7px 11px',
            font: 'inherit',
            fontWeight: 700,
          }}
          type="button"
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
        <span ref={statusRef} aria-live="polite" style={{minWidth: 88, fontSize: 11, opacity: 0.72}}>
          Sorting 0%
        </span>
      </div>
    </div>
  );
}
