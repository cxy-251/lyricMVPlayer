import {useControls} from 'leva';
import {useEffect, useRef} from 'react';

type ALifeControls = {
  startingPopulation: number;
  foodDensity: number;
  mutationRate: number;
  selectionPressure: number;
  timeScale: number;
  trail: number;
};

type Genome = {
  hue: number;
  perception: number;
  speed: number;
  turnRate: number;
};

type Organism = {
  age: number;
  energy: number;
  generation: number;
  genome: Genome;
  heading: number;
  x: number;
  y: number;
};

type Food = {energy: number; x: number; y: number};

const randomGenome = (): Genome => ({
  hue: 165 + Math.random() * 170,
  perception: 42 + Math.random() * 88,
  speed: 22 + Math.random() * 48,
  turnRate: 1.2 + Math.random() * 2.8,
});

const mutateGenome = (parent: Genome, rate: number): Genome => {
  const mutate = (value: number, amount: number) => (
    Math.random() < rate ? value + (Math.random() - 0.5) * amount : value
  );
  return {
    hue: (mutate(parent.hue, 42) + 360) % 360,
    perception: Math.max(28, Math.min(170, mutate(parent.perception, 30))),
    speed: Math.max(16, Math.min(92, mutate(parent.speed, 22))),
    turnRate: Math.max(0.7, Math.min(5.4, mutate(parent.turnRate, 1.2))),
  };
};

const createOrganism = (width: number, height: number, generation = 0, genome = randomGenome()): Organism => ({
  age: 0,
  energy: 0.55 + Math.random() * 0.35,
  generation,
  genome,
  heading: Math.random() * Math.PI * 2,
  x: Math.random() * width,
  y: Math.random() * height,
});

const createFood = (width: number, height: number, x?: number, y?: number): Food => ({
  energy: 0.22 + Math.random() * 0.16,
  x: x ?? Math.random() * width,
  y: y ?? Math.random() * height,
});

export default function Demo046ALifeParticleSelection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useControls('Evolving Microbes', {
    startingPopulation: {value: 180, min: 60, max: 360, step: 20, label: 'Founding population'},
    foodDensity: {value: 0.62, min: 0.2, max: 1, step: 0.01, label: 'Food availability'},
    mutationRate: {value: 0.12, min: 0, max: 0.35, step: 0.01, label: 'Mutation probability'},
    selectionPressure: {value: 0.58, min: 0.15, max: 1, step: 0.01, label: 'Metabolic pressure'},
    timeScale: {value: 0.82, min: 0.2, max: 1.6, step: 0.01, label: 'Evolution speed'},
    trail: {value: 0.34, min: 0, max: 0.72, step: 0.01, label: 'Motion persistence'},
  }) as ALifeControls;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 1;
    let height = 1;
    let organisms: Organism[] = [];
    let food: Food[] = [];
    let animationFrame = 0;
    let previousTime = performance.now();
    let foodAccumulator = 0;
    const pointer = {x: 0, y: 0, down: false};

    const reset = () => {
      organisms = Array.from({length: controls.startingPopulation}, () => createOrganism(width, height));
      const targetFood = Math.round(55 + controls.foodDensity * 150);
      food = Array.from({length: targetFood}, () => createFood(width, height));
      context.fillStyle = '#03070a';
      context.fillRect(0, 0, width, height);
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
    const updatePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };
    const onPointerDown = (event: PointerEvent) => {
      updatePointer(event);
      pointer.down = true;
    };
    const onPointerUp = () => {
      pointer.down = false;
    };

    const update = (delta: number) => {
      const dt = delta * controls.timeScale;
      const maxPopulation = Math.round(controls.startingPopulation * 2.3);
      const targetFood = Math.round(55 + controls.foodDensity * 150);
      foodAccumulator += dt * (8 + controls.foodDensity * 22);
      while (foodAccumulator >= 1 && food.length < targetFood) {
        food.push(createFood(width, height));
        foodAccumulator -= 1;
      }
      if (pointer.down && food.length < targetFood * 1.7) {
        for (let index = 0; index < 2; index++) {
          food.push(createFood(width, height, pointer.x + (Math.random() - 0.5) * 32, pointer.y + (Math.random() - 0.5) * 32));
        }
      }

      const children: Organism[] = [];
      for (const organism of organisms) {
        organism.age += dt;
        let target: Food | null = null;
        let nearestSquared = organism.genome.perception * organism.genome.perception;
        for (const nutrient of food) {
          if (nutrient.energy <= 0) continue;
          let dx = nutrient.x - organism.x;
          let dy = nutrient.y - organism.y;
          if (Math.abs(dx) > width / 2) dx -= Math.sign(dx) * width;
          if (Math.abs(dy) > height / 2) dy -= Math.sign(dy) * height;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared < nearestSquared) {
            nearestSquared = distanceSquared;
            target = nutrient;
          }
        }

        if (target) {
          let dx = target.x - organism.x;
          let dy = target.y - organism.y;
          if (Math.abs(dx) > width / 2) dx -= Math.sign(dx) * width;
          if (Math.abs(dy) > height / 2) dy -= Math.sign(dy) * height;
          const desired = Math.atan2(dy, dx);
          let difference = ((desired - organism.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          organism.heading += Math.max(-organism.genome.turnRate * dt, Math.min(organism.genome.turnRate * dt, difference));
          if (nearestSquared < 64) {
            organism.energy = Math.min(1.45, organism.energy + target.energy);
            target.energy = 0;
          }
        } else {
          organism.heading += Math.sin(organism.age * 0.8 + organism.genome.hue) * dt * 0.7;
        }

        organism.x += Math.cos(organism.heading) * organism.genome.speed * dt;
        organism.y += Math.sin(organism.heading) * organism.genome.speed * dt;
        organism.x = (organism.x + width) % width;
        organism.y = (organism.y + height) % height;
        const traitCost = 0.006 + organism.genome.speed * 0.000055 + organism.genome.perception * 0.000022;
        organism.energy -= traitCost * controls.selectionPressure * dt;

        if (organism.energy > 1.12 && organisms.length + children.length < maxPopulation) {
          organism.energy *= 0.52;
          const child = createOrganism(
            width,
            height,
            organism.generation + 1,
            mutateGenome(organism.genome, controls.mutationRate),
          );
          child.x = organism.x + (Math.random() - 0.5) * 12;
          child.y = organism.y + (Math.random() - 0.5) * 12;
          child.energy = organism.energy;
          children.push(child);
        }
      }
      food = food.filter(item => item.energy > 0);
      organisms = organisms.filter(organism => organism.energy > 0 && organism.age < 95).concat(children);
      if (organisms.length < 12) {
        organisms.push(...Array.from({length: 18}, () => createOrganism(width, height)));
      }
    };

    const draw = (now: number) => {
      const delta = Math.min((now - previousTime) / 1000, 0.04);
      previousTime = now;
      update(delta);
      context.fillStyle = `rgba(3,7,10,${0.28 - controls.trail * 0.25})`;
      context.fillRect(0, 0, width, height);

      context.globalCompositeOperation = 'lighter';
      for (const nutrient of food) {
        context.fillStyle = 'rgba(74,255,187,0.5)';
        context.beginPath();
        context.arc(nutrient.x, nutrient.y, 1.3 + nutrient.energy * 4, 0, Math.PI * 2);
        context.fill();
      }
      for (const organism of organisms) {
        const size = 2.2 + Math.min(1, organism.energy) * 2.2;
        context.save();
        context.translate(organism.x, organism.y);
        context.rotate(organism.heading);
        context.fillStyle = `hsla(${organism.genome.hue}, 88%, 64%, ${0.48 + Math.min(1, organism.energy) * 0.42})`;
        context.shadowColor = `hsla(${organism.genome.hue}, 92%, 62%, 0.65)`;
        context.shadowBlur = 5;
        context.beginPath();
        context.moveTo(size * 1.5, 0);
        context.lineTo(-size, size * 0.72);
        context.lineTo(-size * 0.55, 0);
        context.lineTo(-size, -size * 0.72);
        context.closePath();
        context.fill();
        context.restore();
      }
      context.globalCompositeOperation = 'source-over';

      const average = organisms.reduce((sum, organism) => {
        sum.speed += organism.genome.speed;
        sum.perception += organism.genome.perception;
        sum.generation = Math.max(sum.generation, organism.generation);
        return sum;
      }, {speed: 0, perception: 0, generation: 0});
      const count = Math.max(1, organisms.length);
      context.fillStyle = 'rgba(215,243,238,0.82)';
      context.font = '11px "SFMono-Regular", Menlo, Consolas, monospace';
      context.fillText(`POP ${organisms.length}  FOOD ${food.length}  MAX GEN ${average.generation}`, 18, 26);
      context.fillStyle = 'rgba(123,174,170,0.72)';
      context.fillText(`AVG SPEED ${(average.speed / count).toFixed(1)}  SENSE ${(average.perception / count).toFixed(1)}`, 18, 44);
      animationFrame = requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', updatePointer);
    window.addEventListener('pointerup', onPointerUp);
    animationFrame = requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', updatePointer);
      window.removeEventListener('pointerup', onPointerUp);
      cancelAnimationFrame(animationFrame);
    };
  }, [controls]);

  return (
    <div className="demo-viewport" style={{background: '#03070a'}}>
      <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%', touchAction: 'none'}} />
    </div>
  );
}
