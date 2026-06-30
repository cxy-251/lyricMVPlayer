import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type SortMode = 'attract' | 'stack' | 'poles' | 'rings';

type SortingControls = {
  particleCount: number;
  settleSpeed: number;
  pointSize: number;
  trails: number;
  labelScale: number;
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

const fract = (value: number) => value - Math.floor(value);

const randomFromIndex = (index: number, seed: number) => fract(Math.sin(index * 127.1 + seed * 311.7) * 43758.5453123);

const makeParticles = (perMode: number, width: number, height: number, seed: number): ColorParticle[] => {
  const particles: ColorParticle[] = [];
  for (const mode of MODES) {
    for (let index = 0; index < perMode; index += 1) {
      const absoluteIndex = particles.length;
      const a = randomFromIndex(absoluteIndex, seed);
      const b = randomFromIndex(absoluteIndex + 97, seed);
      const c = randomFromIndex(absoluteIndex + 211, seed);
      particles.push({
        x: width * (0.1 + a * 0.8),
        y: height * (0.2 + b * 0.7),
        vx: 0,
        vy: 0,
        hue: (a * 360 + seed * 23) % 360,
        saturation: 62 + b * 38,
        lightness: 42 + c * 38,
        seed: randomFromIndex(absoluteIndex + 509, seed),
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
  const controls = useControls('Color Sorting Particles', {
    particleCount: {value: 1200, min: 360, max: 2600, step: 40},
    settleSpeed: {value: 0.82, min: 0.08, max: 1.8, step: 0.01},
    pointSize: {value: 2.4, min: 1.1, max: 6, step: 0.1},
    trails: {value: 0.18, min: 0, max: 0.7, step: 0.01},
    labelScale: {value: 1, min: 0.7, max: 1.4, step: 0.01},
  }) as SortingControls;

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

    const resetParticles = () => {
      const perMode = Math.max(50, Math.round(controls.particleCount / MODES.length));
      particles = makeParticles(perMode, width, height, seedRef.current);
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
      context.font = `${Math.max(28, Math.min(58, width * 0.046 * controls.labelScale))}px "SFMono-Regular", Menlo, Consolas, monospace`;
      context.fillText('How to sort colors?', width / 2, height * 0.055);
      context.font = `${Math.max(15, Math.min(26, width * 0.022 * controls.labelScale))}px "SFMono-Regular", Menlo, Consolas, monospace`;
      for (const mode of MODES) {
        const box = columnBounds(mode, width, height);
        context.fillText(mode.toUpperCase(), box.centerX, height * 0.145);
      }
      context.restore();
    };

    const draw = () => {
      context.fillStyle = `rgba(1, 3, 10, ${0.22 + controls.trails * 0.58})`;
      context.fillRect(0, 0, width, height);
      context.fillStyle = 'rgba(255, 255, 255, 0.03)';
      for (const mode of MODES) {
        const box = columnBounds(mode, width, height);
        context.fillRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
      }

      const ease = controls.settleSpeed * 0.017;
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        const target = getTarget(particle, index, particles.length, width, height);
        particle.vx = (particle.vx + (target.x - particle.x) * ease) * 0.83;
        particle.vy = (particle.vy + (target.y - particle.y) * ease) * 0.83;
        particle.x += particle.vx + Math.sin(performance.now() * 0.001 + particle.seed * 9) * 0.12;
        particle.y += particle.vy;

        context.beginPath();
        context.fillStyle = `hsl(${particle.hue} ${particle.saturation}% ${particle.lightness}%)`;
        context.globalAlpha = 0.72 + particle.seed * 0.28;
        context.arc(particle.x, particle.y, controls.pointSize * (0.65 + particle.seed * 0.75), 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;
      drawLabels();
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
  }, [controls]);

  return (
    <div className="demo-viewport">
      <canvas
        ref={canvasRef}
        style={{display: 'block', width: '100%', height: '100%', touchAction: 'none'}}
        onPointerDown={() => {
          seedRef.current += 1;
          shuffleRef.current?.();
        }}
      />
    </div>
  );
}
