export interface DoublePendulumParameters {
  gravity: number;
  damping: number;
  length1: number;
  length2: number;
  mass1: number;
  mass2: number;
}

export interface DoublePendulumState {
  theta1: number;
  theta2: number;
  omega1: number;
  omega2: number;
}

export const MAX_TRAIL_SAMPLES = 720;

const STATE_SIZE = 4;

export class DoublePendulumSolver {
  private readonly state = new Float64Array(STATE_SIZE);
  private readonly origin = new Float64Array(STATE_SIZE);
  private readonly sample = new Float64Array(STATE_SIZE);
  private readonly k1 = new Float64Array(STATE_SIZE);
  private readonly k2 = new Float64Array(STATE_SIZE);
  private readonly k3 = new Float64Array(STATE_SIZE);
  private readonly k4 = new Float64Array(STATE_SIZE);

  constructor(initialState: DoublePendulumState) {
    this.reset(initialState);
  }

  reset(initialState: DoublePendulumState) {
    this.state[0] = initialState.theta1;
    this.state[1] = initialState.theta2;
    this.state[2] = initialState.omega1;
    this.state[3] = initialState.omega2;
  }

  private derivatives(
    source: Float64Array,
    output: Float64Array,
    parameters: DoublePendulumParameters,
  ) {
    const theta1 = source[0];
    const theta2 = source[1];
    const omega1 = source[2];
    const omega2 = source[3];
    const {gravity, length1, length2, mass1, mass2} = parameters;
    const delta = theta1 - theta2;
    const denominator = 2 * mass1 + mass2 - mass2 * Math.cos(2 * delta);
    const sinDelta = Math.sin(delta);
    const cosDelta = Math.cos(delta);

    output[0] = omega1;
    output[1] = omega2;
    output[2] = (
      -gravity * (2 * mass1 + mass2) * Math.sin(theta1)
      - mass2 * gravity * Math.sin(theta1 - 2 * theta2)
      - 2 * sinDelta * mass2 * (
        omega2 * omega2 * length2 + omega1 * omega1 * length1 * cosDelta
      )
    ) / (length1 * denominator);
    output[3] = (
      2 * sinDelta * (
        omega1 * omega1 * length1 * (mass1 + mass2)
        + gravity * (mass1 + mass2) * Math.cos(theta1)
        + omega2 * omega2 * length2 * mass2 * cosDelta
      )
    ) / (length2 * denominator);
  }

  step(deltaSeconds: number, parameters: DoublePendulumParameters) {
    this.origin.set(this.state);
    this.derivatives(this.origin, this.k1, parameters);

    for (let index = 0; index < STATE_SIZE; index++) {
      this.sample[index] = this.origin[index] + this.k1[index] * deltaSeconds * 0.5;
    }
    this.derivatives(this.sample, this.k2, parameters);

    for (let index = 0; index < STATE_SIZE; index++) {
      this.sample[index] = this.origin[index] + this.k2[index] * deltaSeconds * 0.5;
    }
    this.derivatives(this.sample, this.k3, parameters);

    for (let index = 0; index < STATE_SIZE; index++) {
      this.sample[index] = this.origin[index] + this.k3[index] * deltaSeconds;
    }
    this.derivatives(this.sample, this.k4, parameters);

    for (let index = 0; index < STATE_SIZE; index++) {
      this.state[index] = this.origin[index] + deltaSeconds * (
        this.k1[index] + 2 * this.k2[index] + 2 * this.k3[index] + this.k4[index]
      ) / 6;
    }

    const dampingFactor = Math.exp(-parameters.damping * deltaSeconds);
    this.state[2] *= dampingFactor;
    this.state[3] *= dampingFactor;
  }

  writePositions(
    parameters: DoublePendulumParameters,
    originX: number,
    originY: number,
    output: Float64Array,
  ) {
    const x1 = originX + parameters.length1 * Math.sin(this.state[0]);
    const y1 = originY - parameters.length1 * Math.cos(this.state[0]);
    output[0] = x1;
    output[1] = y1;
    output[2] = x1 + parameters.length2 * Math.sin(this.state[1]);
    output[3] = y1 - parameters.length2 * Math.cos(this.state[1]);
  }
}

export class TrailRingBuffer {
  readonly x1 = new Float32Array(MAX_TRAIL_SAMPLES);
  readonly y1 = new Float32Array(MAX_TRAIL_SAMPLES);
  readonly x2 = new Float32Array(MAX_TRAIL_SAMPLES);
  readonly y2 = new Float32Array(MAX_TRAIL_SAMPLES);
  readonly speed = new Float32Array(MAX_TRAIL_SAMPLES);
  readonly curvature = new Float32Array(MAX_TRAIL_SAMPLES);
  readonly timestamp = new Float32Array(MAX_TRAIL_SAMPLES);
  size = 0;
  private head = 0;
  private hasPrevious = false;
  private previousX = 0;
  private previousY = 0;
  private previousDirectionX = 0;
  private previousDirectionY = -1;

  clear() {
    this.size = 0;
    this.head = 0;
    this.hasPrevious = false;
  }

  push(x1: number, y1: number, x2: number, y2: number, timestamp: number) {
    let speed = 0;
    let curvature = 0;
    if (this.hasPrevious) {
      const dx = x2 - this.previousX;
      const dy = y2 - this.previousY;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.00001) {
        const directionX = dx / distance;
        const directionY = dy / distance;
        speed = distance * 60;
        curvature = Math.min(1, Math.abs(
          directionX * this.previousDirectionY - directionY * this.previousDirectionX
        ));
        this.previousDirectionX = directionX;
        this.previousDirectionY = directionY;
      }
    }

    this.x1[this.head] = x1;
    this.y1[this.head] = y1;
    this.x2[this.head] = x2;
    this.y2[this.head] = y2;
    this.speed[this.head] = speed;
    this.curvature[this.head] = curvature;
    this.timestamp[this.head] = timestamp;
    this.head = (this.head + 1) % MAX_TRAIL_SAMPLES;
    this.size = Math.min(MAX_TRAIL_SAMPLES, this.size + 1);
    this.previousX = x2;
    this.previousY = y2;
    this.hasPrevious = true;
  }

  indexAt(logicalIndex: number, visibleCount: number) {
    const visibleStart = this.size - visibleCount;
    const oldest = (this.head - this.size + MAX_TRAIL_SAMPLES) % MAX_TRAIL_SAMPLES;
    return (oldest + visibleStart + logicalIndex) % MAX_TRAIL_SAMPLES;
  }
}
