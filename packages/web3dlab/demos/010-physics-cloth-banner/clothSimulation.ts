export type ClothSimulationParams = {
  damping: number;
  delta: number;
  drag: number;
  interactionRadius: number;
  interactionStrength: number;
  pointerSpeed: number;
  pointerVelocityX: number;
  pointerVelocityY: number;
  pointerX: number;
  pointerY: number;
  time: number;
  windStrength: number;
};

type Constraint = {
  a: number;
  b: number;
  restLength: number;
};

const CONSTRAINT_ITERATIONS = 5;
const GRAVITY = -0.0024;
const MAX_DELTA = 1 / 30;

function pointIndex(column: number, row: number, columns: number) {
  return row * columns + column;
}

function addConstraint(constraints: Constraint[], a: number, b: number, positions: Float32Array) {
  const ax = positions[a * 3];
  const ay = positions[a * 3 + 1];
  const az = positions[a * 3 + 2];
  const bx = positions[b * 3];
  const by = positions[b * 3 + 1];
  const bz = positions[b * 3 + 2];
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;

  constraints.push({
    a,
    b,
    restLength: Math.sqrt(dx * dx + dy * dy + dz * dz),
  });
}

export class ClothSimulation {
  readonly columns: number;
  readonly rows: number;
  readonly count: number;
  readonly edgeIndices: Uint16Array;
  readonly linePairs: Uint16Array;
  readonly pinned: Uint8Array;
  readonly positions: Float32Array;
  readonly previous: Float32Array;
  readonly restPositions: Float32Array;

  private readonly constraints: Constraint[];
  private rippleAge = 10;
  private rippleAmplitude = 0;
  private rippleX = 0;
  private rippleY = 0;

  constructor(columns: number, rows: number, width: number, height: number) {
    this.columns = columns;
    this.rows = rows;
    this.count = columns * rows;
    this.positions = new Float32Array(this.count * 3);
    this.previous = new Float32Array(this.count * 3);
    this.restPositions = new Float32Array(this.count * 3);
    this.pinned = new Uint8Array(this.count);

    for (let row = 0; row < rows; row += 1) {
      const v = row / (rows - 1);
      for (let column = 0; column < columns; column += 1) {
        const u = column / (columns - 1);
        const index = pointIndex(column, row, columns);
        const cursor = index * 3;
        const x = (u - 0.5) * width;
        const y = (0.5 - v) * height;
        const z = Math.sin(u * Math.PI * 2) * 0.025;

        this.positions[cursor] = x;
        this.positions[cursor + 1] = y;
        this.positions[cursor + 2] = z;
        this.previous[cursor] = x;
        this.previous[cursor + 1] = y;
        this.previous[cursor + 2] = z;
        this.restPositions[cursor] = x;
        this.restPositions[cursor + 1] = y;
        this.restPositions[cursor + 2] = z;
        this.pinned[index] = row === 0 ? 1 : 0;
      }
    }

    this.constraints = this.createConstraints();
    this.linePairs = this.createLinePairs();
    this.edgeIndices = this.createEdgeIndices();
  }

  triggerRipple(x: number, y: number, amplitude: number) {
    this.rippleX = x;
    this.rippleY = y;
    this.rippleAge = 0;
    this.rippleAmplitude = Math.max(this.rippleAmplitude, amplitude);
  }

  step(params: ClothSimulationParams) {
    const delta = Math.min(params.delta, MAX_DELTA);
    const deltaScale = delta * 60;
    const deltaSq = deltaScale * deltaScale;
    const damping = Math.min(Math.max(params.damping, 0.9), 0.999);
    const radius = Math.max(params.interactionRadius, 0.05);
    const radiusSq = radius * radius;
    const speedBoost = Math.min(params.pointerSpeed, 7);
    const dragBoost = 1 + params.drag * 2.1;

    this.rippleAge += delta;

    // Verlet integration: current and previous positions encode velocity.
    // Wind, gravity, pointer pushes, and click ripples are applied as small position accelerations.
    for (let index = 0; index < this.count; index += 1) {
      const cursor = index * 3;

      if (this.pinned[index]) {
        this.pinPoint(index);
        continue;
      }

      const x = this.positions[cursor];
      const y = this.positions[cursor + 1];
      const z = this.positions[cursor + 2];
      const velocityX = (x - this.previous[cursor]) * damping;
      const velocityY = (y - this.previous[cursor + 1]) * damping;
      const velocityZ = (z - this.previous[cursor + 2]) * damping;

      this.previous[cursor] = x;
      this.previous[cursor + 1] = y;
      this.previous[cursor + 2] = z;

      const restX = this.restPositions[cursor];
      const restY = this.restPositions[cursor + 1];
      const wind =
        Math.sin(params.time * 1.45 + restX * 1.9 + restY * 0.8) +
        Math.sin(params.time * 0.84 - restX * 2.4 + restY * 1.25) * 0.55;

      let accelerationX = 0;
      let accelerationY = GRAVITY;
      let accelerationZ = wind * params.windStrength * 0.0075;

      const dx = x - params.pointerX;
      const dy = y - params.pointerY;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq < radiusSq) {
        const distance = Math.sqrt(distanceSq);
        const falloff = 1 - distance / radius;
        const force = falloff * falloff * params.interactionStrength * dragBoost;

        accelerationX += params.pointerVelocityX * force * 0.018;
        accelerationY += params.pointerVelocityY * force * 0.018;
        accelerationZ += force * (0.022 + speedBoost * 0.01);
      }

      if (this.rippleAmplitude > 0.001 && this.rippleAge < 2.4) {
        const rippleDx = x - this.rippleX;
        const rippleDy = y - this.rippleY;
        const distance = Math.sqrt(rippleDx * rippleDx + rippleDy * rippleDy);
        const waveFront = this.rippleAge * 2.35;
        const envelope = Math.exp(-Math.abs(distance - waveFront) * 1.8) * Math.exp(-this.rippleAge * 1.45);
        const wave = Math.sin(distance * 7.2 - this.rippleAge * 11.0) * envelope;

        accelerationZ += wave * this.rippleAmplitude * 0.035;
      }

      this.positions[cursor] = x + velocityX + accelerationX * deltaSq;
      this.positions[cursor + 1] = y + velocityY + accelerationY * deltaSq;
      this.positions[cursor + 2] = Math.min(Math.max(z + velocityZ + accelerationZ * deltaSq, -1.8), 1.8);
    }

    // Constraint relaxation keeps spring lengths close to their rest values and prevents runaway motion.
    for (let iteration = 0; iteration < CONSTRAINT_ITERATIONS; iteration += 1) {
      this.pinTopEdge();
      this.relaxConstraints();
    }

    this.pinTopEdge();
    this.rippleAmplitude *= Math.exp(-delta * 1.2);
  }

  private createConstraints() {
    const constraints: Constraint[] = [];

    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        const current = pointIndex(column, row, this.columns);

        if (column < this.columns - 1) {
          addConstraint(constraints, current, pointIndex(column + 1, row, this.columns), this.positions);
        }

        if (row < this.rows - 1) {
          addConstraint(constraints, current, pointIndex(column, row + 1, this.columns), this.positions);
        }

        if (column < this.columns - 1 && row < this.rows - 1) {
          addConstraint(constraints, current, pointIndex(column + 1, row + 1, this.columns), this.positions);
          addConstraint(constraints, pointIndex(column + 1, row, this.columns), pointIndex(column, row + 1, this.columns), this.positions);
        }
      }
    }

    return constraints;
  }

  private createLinePairs() {
    const pairs: number[] = [];

    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        const current = pointIndex(column, row, this.columns);

        if (column < this.columns - 1) {
          pairs.push(current, pointIndex(column + 1, row, this.columns));
        }

        if (row < this.rows - 1) {
          pairs.push(current, pointIndex(column, row + 1, this.columns));
        }
      }
    }

    return Uint16Array.from(pairs);
  }

  private createEdgeIndices() {
    const indices: number[] = [];

    for (let column = 0; column < this.columns; column += 1) {
      indices.push(pointIndex(column, this.rows - 1, this.columns));
    }

    for (let row = 1; row < this.rows; row += 1) {
      indices.push(pointIndex(0, row, this.columns));
      indices.push(pointIndex(this.columns - 1, row, this.columns));
    }

    return Uint16Array.from(indices);
  }

  private pinPoint(index: number) {
    const cursor = index * 3;

    this.positions[cursor] = this.restPositions[cursor];
    this.positions[cursor + 1] = this.restPositions[cursor + 1];
    this.positions[cursor + 2] = this.restPositions[cursor + 2];
    this.previous[cursor] = this.restPositions[cursor];
    this.previous[cursor + 1] = this.restPositions[cursor + 1];
    this.previous[cursor + 2] = this.restPositions[cursor + 2];
  }

  private pinTopEdge() {
    for (let column = 0; column < this.columns; column += 1) {
      this.pinPoint(column);
    }
  }

  private relaxConstraints() {
    for (const constraint of this.constraints) {
      const a = constraint.a * 3;
      const b = constraint.b * 3;
      const dx = this.positions[b] - this.positions[a];
      const dy = this.positions[b + 1] - this.positions[a + 1];
      const dz = this.positions[b + 2] - this.positions[a + 2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < 0.00001) {
        continue;
      }

      const difference = (distance - constraint.restLength) / distance;
      const aPinned = this.pinned[constraint.a] === 1;
      const bPinned = this.pinned[constraint.b] === 1;
      const aWeight = aPinned ? 0 : bPinned ? 1 : 0.5;
      const bWeight = bPinned ? 0 : aPinned ? 1 : 0.5;

      this.positions[a] += dx * difference * aWeight;
      this.positions[a + 1] += dy * difference * aWeight;
      this.positions[a + 2] += dz * difference * aWeight;
      this.positions[b] -= dx * difference * bWeight;
      this.positions[b + 1] -= dy * difference * bWeight;
      this.positions[b + 2] -= dz * difference * bWeight;
    }
  }
}

export function createClothIndices(columns: number, rows: number) {
  const indices: number[] = [];

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = pointIndex(column, row, columns);
      const b = pointIndex(column + 1, row, columns);
      const c = pointIndex(column, row + 1, columns);
      const d = pointIndex(column + 1, row + 1, columns);

      indices.push(a, c, b, b, c, d);
    }
  }

  return indices;
}

export function createClothUvs(columns: number, rows: number) {
  const uvs = new Float32Array(columns * rows * 2);
  let cursor = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      uvs[cursor++] = column / (columns - 1);
      uvs[cursor++] = 1 - row / (rows - 1);
    }
  }

  return uvs;
}
