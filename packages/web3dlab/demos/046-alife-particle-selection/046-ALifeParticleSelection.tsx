import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type ALifeControls = {
  population: number;
  speciesCount: number;
  neighborRadius: number;
  mutation: number;
  trail: number;
  speed: number;
};

type LifeParticle = {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  species: number;
  energy: number;
  seed: number;
};

type Colony = {
  x: number;
  y: number;
  radius: number;
  species: number;
  intensity: number;
};

const COLORS = ['#62ff45', '#ff38d0', '#37d8ff', '#ffec38', '#ff7a30', '#b678ff'];

const rand = (index: number, seed = 1) => {
  const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453123;
  return value - Math.floor(value);
};

const speciesForce = (a: number, b: number) => {
  const v = Math.sin((a + 1) * 12.989 + (b + 1) * 78.23);
  return v > 0.35 ? 1 : v < -0.25 ? -1 : 0.18;
};

const makeParticles = (count: number, speciesCount: number, width: number, height: number): LifeParticle[] => (
  Array.from({length: count}, (_, index) => {
    const angle = rand(index, 3) * Math.PI * 2;
    return {
      x: width * rand(index, 1),
      y: height * rand(index, 2),
      px: width * rand(index, 1),
      py: height * rand(index, 2),
      vx: Math.cos(angle) * 0.4,
      vy: Math.sin(angle) * 0.4,
      species: index % speciesCount,
      energy: 0.5 + rand(index, 4) * 0.5,
      seed: rand(index, 5),
    };
  })
);

const drawMicrobeBackdrop = (context: CanvasRenderingContext2D, width: number, height: number, time: number) => {
  const glow = context.createRadialGradient(width * 0.48, height * 0.5, 0, width * 0.48, height * 0.5, Math.max(width, height) * 0.72);
  glow.addColorStop(0, '#04110b');
  glow.addColorStop(0.52, '#020505');
  glow.addColorStop(1, '#000');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 28; i += 1) {
    const x = width * (0.04 + rand(i, 11) * 0.92);
    const y = height * (0.08 + rand(i, 12) * 0.84);
    const r = Math.min(width, height) * (0.018 + rand(i, 13) * 0.028);
    const color = COLORS[i % COLORS.length];
    context.strokeStyle = color;
    context.globalAlpha = 0.05 + rand(i, 14) * 0.08;
    context.lineWidth = 1.2;
    context.beginPath();
    for (let a = 0; a <= 48; a += 1) {
      const angle = (a / 48) * Math.PI * 2;
      const wobble = 1 + Math.sin(angle * (3 + (i % 4)) + time * 0.001 + i) * 0.18;
      const px = x + Math.cos(angle) * r * wobble;
      const py = y + Math.sin(angle) * r * wobble;
      if (a === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.stroke();
  }
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
};

export default function Demo046ALifeParticleSelection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({x: 0, y: 0, active: false});
  const controls = useControls('ALife Particle Selection', {
    population: {value: 920, min: 260, max: 1800, step: 20},
    speciesCount: {value: 5, min: 2, max: 6, step: 1},
    neighborRadius: {value: 46, min: 18, max: 92, step: 1},
    mutation: {value: 0.42, min: 0, max: 1.6, step: 0.01},
    trail: {value: 0.18, min: 0.04, max: 0.68, step: 0.01},
    speed: {value: 0.85, min: 0.15, max: 2.2, step: 0.01},
  }) as ALifeControls;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let particles: LifeParticle[] = [];
    let frame = 0;
    let tick = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = makeParticles(controls.population, controls.speciesCount, width, height);
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

    const buildGrid = () => {
      const cell = Math.max(12, controls.neighborRadius);
      const grid = new Map<string, LifeParticle[]>();
      for (const particle of particles) {
        const cx = Math.floor(particle.x / cell);
        const cy = Math.floor(particle.y / cell);
        const key = `${cx}:${cy}`;
        const bucket = grid.get(key);
        if (bucket) bucket.push(particle);
        else grid.set(key, [particle]);
      }
      return {grid, cell};
    };

    const step = () => {
      tick += 1;
      const {grid, cell} = buildGrid();
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        particle.px = particle.x;
        particle.py = particle.y;
        const cx = Math.floor(particle.x / cell);
        const cy = Math.floor(particle.y / cell);
        let fx = 0;
        let fy = 0;
        let closeCount = 0;
        const speciesHits = new Array(controls.speciesCount).fill(0) as number[];

        for (let gx = cx - 1; gx <= cx + 1; gx += 1) {
          for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
            const bucket = grid.get(`${gx}:${gy}`);
            if (!bucket) continue;
            for (const other of bucket) {
              if (other === particle) continue;
              const dx = other.x - particle.x;
              const dy = other.y - particle.y;
              const distance = Math.hypot(dx, dy);
              if (distance <= 0 || distance > controls.neighborRadius) continue;
              const normalized = distance / controls.neighborRadius;
              const force = speciesForce(particle.species, other.species) * (1 - normalized);
              const separation = distance < controls.neighborRadius * 0.24 ? -1.8 * (1 - normalized) : 0;
              fx += (dx / distance) * (force + separation);
              fy += (dy / distance) * (force + separation);
              closeCount += 1;
              speciesHits[other.species] += 1;
            }
          }
        }

        if (pointerRef.current.active) {
          const dx = pointerRef.current.x - particle.x;
          const dy = pointerRef.current.y - particle.y;
          const distance = Math.hypot(dx, dy) + 0.001;
          const pull = Math.max(0, 1 - distance / 240);
          fx += (dx / distance) * pull * 0.8;
          fy += (dy / distance) * pull * 0.8;
        }

        particle.energy += (closeCount - 5) * 0.003;
        particle.energy = Math.max(0.08, Math.min(1.8, particle.energy));
        const mutationGate = rand(index + tick * 13, 9);
        if (mutationGate < controls.mutation * 0.0025 * (closeCount > 9 ? 1.8 : 0.7)) {
          const bestSpecies = speciesHits.indexOf(Math.max(...speciesHits));
          particle.species = closeCount > 4 && bestSpecies >= 0 ? bestSpecies : (particle.species + 1 + Math.floor(rand(index + tick, 7) * (controls.speciesCount - 1))) % controls.speciesCount;
        }

        particle.vx = (particle.vx + fx * 0.035 * controls.speed) * 0.92;
        particle.vy = (particle.vy + fy * 0.035 * controls.speed) * 0.92;
        const swim = particle.seed * Math.PI * 2 + tick * 0.03 * controls.speed;
        particle.vx += Math.cos(swim) * 0.018;
        particle.vy += Math.sin(swim * 1.17) * 0.018;
        particle.x = (particle.x + particle.vx + width) % width;
        particle.y = (particle.y + particle.vy + height) % height;
      }
    };

    const sampleColonies = (): Colony[] => {
      const cols = 18;
      const rows = 12;
      const buckets = Array.from({length: cols * rows}, () => ({count: 0, species: new Array(controls.speciesCount).fill(0) as number[], energy: 0}));
      for (const particle of particles) {
        const x = Math.min(cols - 1, Math.max(0, Math.floor((particle.x / width) * cols)));
        const y = Math.min(rows - 1, Math.max(0, Math.floor((particle.y / height) * rows)));
        const bucket = buckets[y * cols + x];
        bucket.count += 1;
        bucket.species[particle.species] += 1;
        bucket.energy += particle.energy;
      }
      return buckets.flatMap((bucket, index) => {
        if (bucket.count < 5) return [];
        const gx = index % cols;
        const gy = Math.floor(index / cols);
        const species = bucket.species.indexOf(Math.max(...bucket.species));
        return [{
          x: (gx + 0.5) * (width / cols),
          y: (gy + 0.5) * (height / rows),
          radius: Math.min(width / cols, height / rows) * (0.7 + Math.min(2.1, bucket.count / 13)),
          species,
          intensity: Math.min(1, bucket.energy / Math.max(1, bucket.count)),
        }];
      });
    };

    const draw = (now: number) => {
      step();
      context.fillStyle = `rgba(0,0,0,${controls.trail * 0.72})`;
      context.fillRect(0, 0, width, height);
      if (tick < 2) drawMicrobeBackdrop(context, width, height, now);
      const colonies = sampleColonies();
      context.save();
      context.globalCompositeOperation = 'lighter';
      for (const colony of colonies) {
        const color = COLORS[colony.species % COLORS.length];
        const gradient = context.createRadialGradient(colony.x, colony.y, 0, colony.x, colony.y, colony.radius * 1.45);
        gradient.addColorStop(0, `${color}44`);
        gradient.addColorStop(0.45, `${color}18`);
        gradient.addColorStop(1, `${color}00`);
        context.globalAlpha = 0.5 + colony.intensity * 0.35;
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(colony.x, colony.y, colony.radius * 1.45, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = color;
        context.globalAlpha = 0.22 + colony.intensity * 0.22;
        context.lineWidth = 1.4;
        context.beginPath();
        for (let i = 0; i <= 36; i += 1) {
          const angle = (i / 36) * Math.PI * 2;
          const wobble = 1 + Math.sin(angle * 5 + tick * 0.04 + colony.x * 0.01) * 0.16;
          const px = colony.x + Math.cos(angle) * colony.radius * wobble;
          const py = colony.y + Math.sin(angle) * colony.radius * wobble;
          if (i === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.stroke();
      }
      context.lineWidth = 1.1;
      for (const particle of particles) {
        const color = COLORS[particle.species % COLORS.length];
        context.strokeStyle = color;
        context.globalAlpha = 0.1 + particle.energy * 0.16;
        context.beginPath();
        context.moveTo(particle.px, particle.py);
        context.lineTo(particle.x, particle.y);
        context.stroke();
        context.fillStyle = color;
        context.globalAlpha = 0.22 + particle.energy * 0.48;
        context.beginPath();
        context.arc(particle.x, particle.y, 1.1 + particle.energy * 1.4, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();

      context.fillStyle = 'rgba(210,255,218,0.72)';
      context.font = `${Math.max(11, width * 0.012)}px "SFMono-Regular", Menlo, Consolas, monospace`;
      context.textAlign = 'left';
      context.fillText(`natural selection field  particles=${particles.length}  colonies=${colonies.length}`, 18, 24);
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
  }, [controls.mutation, controls.neighborRadius, controls.population, controls.speciesCount, controls.speed, controls.trail]);

  return (
    <div className="demo-viewport">
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%', touchAction: 'none'}} />
    </div>
  );
}
