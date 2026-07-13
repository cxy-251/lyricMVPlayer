export const TAU = Math.PI * 2;

export type SeedMode =
  | 'uniform-volume'
  | 'surface-shells'
  | 'cross-section-grid'
  | 'focused-core'
  | 'random-seeded';

export type TorusPresetName =
  | 'Balanced Flow'
  | 'Closed Resonance'
  | 'Quasi-Periodic Fill'
  | 'Braided Knot'
  | 'Pinched Hourglass'
  | 'Perturbed Flow';

export type TorusState = {
  rho: number;
  u: number;
  v: number;
};

export type Point3 = {x: number; y: number; z: number};

export type TorusSimulationParameters = {
  integrationStep: number;
  majorRadius: number;
  minorRadius: number;
  perturbationStrength: number;
  phase: number;
  poloidalSpeed: number;
  radialFrequencyU: number;
  radialFrequencyV: number;
  radialOscillation: number;
  radialPinch: number;
  randomSeed: number;
  resonanceP: number;
  resonanceQ: number;
  resonanceStrength: number;
  rhoMin: number;
  samplesPerLine: number;
  seedMode: SeedMode;
  shearStrength: number;
  streamlineCount: number;
  timeModulation: number;
  toroidalSpeed: number;
};

export type StreamlineStats = {
  averageSpeed: number;
  closureError: number;
  computeMs: number;
  invalidTrajectories: number;
  maxSpeed: number;
  pointCount: number;
  segmentCount: number;
  streamlineCount: number;
};

export type StreamlineData = {
  intensities: Float32Array;
  pathPositions: Float32Array;
  positions: Float32Array;
  radii: Float32Array;
  seeds: Float32Array;
  speeds: Float32Array;
  stats: StreamlineStats;
};

export type TorusWorkerRequest = {
  parameters: TorusSimulationParameters;
  requestId: number;
};

export type TorusWorkerResponse = {
  data: StreamlineData;
  requestId: number;
};

export const DEFAULT_SIMULATION_PARAMETERS: TorusSimulationParameters = {
  integrationStep: 0.026,
  majorRadius: 2.45,
  minorRadius: 1.15,
  perturbationStrength: 0.07,
  phase: 0.35,
  poloidalSpeed: 1.48,
  radialFrequencyU: 2,
  radialFrequencyV: 3,
  radialOscillation: 0.2,
  radialPinch: 1.15,
  randomSeed: 19019,
  resonanceP: 3,
  resonanceQ: 2,
  resonanceStrength: 0.32,
  rhoMin: 0.055,
  samplesPerLine: 240,
  seedMode: 'surface-shells',
  shearStrength: 0.5,
  streamlineCount: 720,
  timeModulation: 0.08,
  toroidalSpeed: 0.86,
};

export const TORUS_PRESETS: Record<TorusPresetName, Partial<TorusSimulationParameters>> = {
  'Balanced Flow': {
    poloidalSpeed: 1.48,
    perturbationStrength: 0.07,
    radialOscillation: 0.2,
    radialPinch: 1.15,
    resonanceP: 3,
    resonanceQ: 2,
    resonanceStrength: 0.32,
    seedMode: 'surface-shells',
    shearStrength: 0.5,
    toroidalSpeed: 0.86,
  },
  'Closed Resonance': {
    poloidalSpeed: 1.2,
    perturbationStrength: 0,
    radialOscillation: 0.08,
    radialPinch: 0.72,
    resonanceP: 2,
    resonanceQ: 3,
    resonanceStrength: 0.52,
    seedMode: 'surface-shells',
    shearStrength: 0.18,
    toroidalSpeed: 0.8,
  },
  'Quasi-Periodic Fill': {
    poloidalSpeed: 1.63,
    perturbationStrength: 0.025,
    radialOscillation: 0.17,
    radialPinch: 0.48,
    resonanceP: 5,
    resonanceQ: 3,
    resonanceStrength: 0.14,
    seedMode: 'uniform-volume',
    shearStrength: 0.72,
    toroidalSpeed: 0.93,
  },
  'Braided Knot': {
    poloidalSpeed: 1.88,
    perturbationStrength: 0.035,
    radialOscillation: 0.26,
    radialPinch: 0.9,
    resonanceP: 5,
    resonanceQ: 2,
    resonanceStrength: 0.65,
    seedMode: 'surface-shells',
    shearStrength: 0.42,
    toroidalSpeed: 0.72,
  },
  'Pinched Hourglass': {
    poloidalSpeed: 1.36,
    perturbationStrength: 0.04,
    radialOscillation: 0.3,
    radialPinch: 2.35,
    resonanceP: 3,
    resonanceQ: 1,
    resonanceStrength: 0.4,
    seedMode: 'focused-core',
    shearStrength: 0.58,
    toroidalSpeed: 0.82,
  },
  'Perturbed Flow': {
    poloidalSpeed: 1.56,
    perturbationStrength: 0.32,
    radialOscillation: 0.24,
    radialPinch: 0.84,
    resonanceP: 4,
    resonanceQ: 3,
    resonanceStrength: 0.48,
    seedMode: 'random-seeded',
    shearStrength: 0.68,
    toroidalSpeed: 0.9,
  },
};

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
);

const finiteNumber = (value: number, fallback: number) => (
  Number.isFinite(value) ? value : fallback
);

export function wrapAngle(value: number) {
  return ((value % TAU) + TAU) % TAU;
}

export function sanitizeSimulationParameters(
  input: Partial<TorusSimulationParameters>,
): TorusSimulationParameters {
  const parameters = {...DEFAULT_SIMULATION_PARAMETERS, ...input};
  const minorRadius = clamp(
    finiteNumber(parameters.minorRadius, DEFAULT_SIMULATION_PARAMETERS.minorRadius),
    0.55,
    1.8,
  );
  const seedMode: SeedMode = [
    'uniform-volume',
    'surface-shells',
    'cross-section-grid',
    'focused-core',
    'random-seeded',
  ].includes(parameters.seedMode)
    ? parameters.seedMode
    : DEFAULT_SIMULATION_PARAMETERS.seedMode;
  return {
    integrationStep: clamp(finiteNumber(parameters.integrationStep, DEFAULT_SIMULATION_PARAMETERS.integrationStep), 0.008, 0.06),
    majorRadius: clamp(finiteNumber(parameters.majorRadius, DEFAULT_SIMULATION_PARAMETERS.majorRadius), 1.8, 3.5),
    minorRadius,
    perturbationStrength: clamp(finiteNumber(parameters.perturbationStrength, DEFAULT_SIMULATION_PARAMETERS.perturbationStrength), 0, 0.45),
    phase: clamp(finiteNumber(parameters.phase, DEFAULT_SIMULATION_PARAMETERS.phase), 0, TAU),
    poloidalSpeed: clamp(finiteNumber(parameters.poloidalSpeed, DEFAULT_SIMULATION_PARAMETERS.poloidalSpeed), 0.2, 2.8),
    radialFrequencyU: Math.round(clamp(finiteNumber(parameters.radialFrequencyU, DEFAULT_SIMULATION_PARAMETERS.radialFrequencyU), 1, 6)),
    radialFrequencyV: Math.round(clamp(finiteNumber(parameters.radialFrequencyV, DEFAULT_SIMULATION_PARAMETERS.radialFrequencyV), 1, 7)),
    radialOscillation: clamp(finiteNumber(parameters.radialOscillation, DEFAULT_SIMULATION_PARAMETERS.radialOscillation), 0, 0.42),
    radialPinch: clamp(finiteNumber(parameters.radialPinch, DEFAULT_SIMULATION_PARAMETERS.radialPinch), 0, 2.8),
    randomSeed: Math.round(clamp(finiteNumber(parameters.randomSeed, DEFAULT_SIMULATION_PARAMETERS.randomSeed), 1, 999999)),
    resonanceP: Math.round(clamp(finiteNumber(parameters.resonanceP, DEFAULT_SIMULATION_PARAMETERS.resonanceP), 1, 8)),
    resonanceQ: Math.round(clamp(finiteNumber(parameters.resonanceQ, DEFAULT_SIMULATION_PARAMETERS.resonanceQ), 1, 8)),
    resonanceStrength: clamp(finiteNumber(parameters.resonanceStrength, DEFAULT_SIMULATION_PARAMETERS.resonanceStrength), 0, 0.8),
    rhoMin: clamp(finiteNumber(parameters.rhoMin, DEFAULT_SIMULATION_PARAMETERS.rhoMin), 0.01, minorRadius * 0.42),
    samplesPerLine: Math.round(clamp(finiteNumber(parameters.samplesPerLine, DEFAULT_SIMULATION_PARAMETERS.samplesPerLine), 96, 384)),
    seedMode,
    shearStrength: clamp(finiteNumber(parameters.shearStrength, DEFAULT_SIMULATION_PARAMETERS.shearStrength), 0, 1.1),
    streamlineCount: Math.round(clamp(finiteNumber(parameters.streamlineCount, DEFAULT_SIMULATION_PARAMETERS.streamlineCount), 180, 1200)),
    timeModulation: clamp(finiteNumber(parameters.timeModulation, DEFAULT_SIMULATION_PARAMETERS.timeModulation), 0, 0.3),
    toroidalSpeed: clamp(finiteNumber(parameters.toroidalSpeed, DEFAULT_SIMULATION_PARAMETERS.toroidalSpeed), 0.2, 1.8),
  };
}

export function torusToCartesian(
  state: TorusState,
  majorRadius: number,
): Point3 {
  const ringRadius = majorRadius + state.rho * Math.cos(state.v);
  return {
    x: ringRadius * Math.cos(state.u),
    y: state.rho * Math.sin(state.v),
    z: ringRadius * Math.sin(state.u),
  };
}

export function evaluateTorusField(
  state: TorusState,
  parameters: TorusSimulationParameters,
  time: number,
): TorusState {
  const radiusRatio = clamp(state.rho / parameters.minorRadius, 0, 1);
  const resonancePhase = parameters.resonanceP * state.v
    - parameters.resonanceQ * state.u
    + parameters.phase
    + time * parameters.timeModulation;
  const radialPhase = parameters.radialFrequencyU * state.u
    - parameters.radialFrequencyV * state.v
    + parameters.phase
    + time * parameters.timeModulation;
  const equilibriumRadius = parameters.minorRadius * (
    0.52 - 0.36 * Math.cos(radialPhase)
  );
  const deterministicPerturbation = parameters.perturbationStrength * (
    Math.sin(state.u * 5 + state.v * 3 + parameters.phase)
    + Math.sin(state.u * 2 - state.v * 7 - parameters.phase) * 0.45
  );

  return {
    u: parameters.toroidalSpeed
      + parameters.shearStrength * radiusRatio * radiusRatio
      + parameters.resonanceStrength * Math.sin(resonancePhase)
      + deterministicPerturbation * 0.11,
    v: parameters.poloidalSpeed
      + parameters.resonanceStrength * Math.cos(
        parameters.resonanceQ * state.u - parameters.resonanceP * state.v + parameters.phase,
      )
      + parameters.shearStrength * (1 - radiusRatio * radiusRatio) * 0.32
      + deterministicPerturbation * 0.18,
    rho: -parameters.radialPinch * (state.rho - equilibriumRadius)
      + parameters.minorRadius * parameters.radialOscillation * Math.sin(radialPhase)
      + parameters.minorRadius * deterministicPerturbation * 0.055,
  };
}

export function rk4Step(
  state: TorusState,
  time: number,
  step: number,
  derivative: (value: TorusState, atTime: number) => TorusState,
): TorusState {
  const k1 = derivative(state, time);
  const state2 = {
    u: state.u + k1.u * step * 0.5,
    v: state.v + k1.v * step * 0.5,
    rho: state.rho + k1.rho * step * 0.5,
  };
  const k2 = derivative(state2, time + step * 0.5);
  const state3 = {
    u: state.u + k2.u * step * 0.5,
    v: state.v + k2.v * step * 0.5,
    rho: state.rho + k2.rho * step * 0.5,
  };
  const k3 = derivative(state3, time + step * 0.5);
  const state4 = {
    u: state.u + k3.u * step,
    v: state.v + k3.v * step,
    rho: state.rho + k3.rho * step,
  };
  const k4 = derivative(state4, time + step);
  return {
    u: state.u + step / 6 * (k1.u + 2 * k2.u + 2 * k3.u + k4.u),
    v: state.v + step / 6 * (k1.v + 2 * k2.v + 2 * k3.v + k4.v),
    rho: state.rho + step / 6 * (k1.rho + 2 * k2.rho + 2 * k3.rho + k4.rho),
  };
}

function constrainState(
  state: TorusState,
  parameters: TorusSimulationParameters,
): TorusState {
  let rho = state.rho;
  if (rho < parameters.rhoMin) rho = parameters.rhoMin + (parameters.rhoMin - rho);
  if (rho > parameters.minorRadius) {
    rho = parameters.minorRadius - (rho - parameters.minorRadius);
  }
  return {
    u: wrapAngle(state.u),
    v: wrapAngle(state.v),
    rho: clamp(rho, parameters.rhoMin, parameters.minorRadius),
  };
}

export function torusVelocityToCartesian(
  state: TorusState,
  derivative: TorusState,
  majorRadius: number,
): Point3 {
  const cosU = Math.cos(state.u);
  const sinU = Math.sin(state.u);
  const cosV = Math.cos(state.v);
  const sinV = Math.sin(state.v);
  const ringRadius = majorRadius + state.rho * cosV;
  return {
    x: -ringRadius * sinU * derivative.u
      - state.rho * sinV * cosU * derivative.v
      + cosV * cosU * derivative.rho,
    y: state.rho * cosV * derivative.v + sinV * derivative.rho,
    z: ringRadius * cosU * derivative.u
      - state.rho * sinV * sinU * derivative.v
      + cosV * sinU * derivative.rho,
  };
}

function createRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function createSeedState(
  index: number,
  parameters: TorusSimulationParameters,
  random: () => number,
): TorusState {
  const golden = 0.6180339887498948;
  const u = wrapAngle(TAU * ((index * golden + random() * 0.08) % 1));
  const v = wrapAngle(TAU * ((index * golden * golden + random() * 0.12) % 1));
  const minimum = parameters.rhoMin;
  const span = parameters.minorRadius - minimum;

  if (parameters.seedMode === 'surface-shells') {
    const shells = [0.16, 0.34, 0.55, 0.74, 0.92];
    return {u, v, rho: minimum + span * shells[index % shells.length]};
  }
  if (parameters.seedMode === 'cross-section-grid') {
    const side = Math.max(2, Math.ceil(Math.sqrt(parameters.streamlineCount)));
    const row = Math.floor(index / side);
    const column = index % side;
    return {
      u: parameters.phase + (random() - 0.5) * 0.06,
      v: TAU * column / side,
      rho: minimum + span * row / Math.max(1, side - 1),
    };
  }
  if (parameters.seedMode === 'focused-core') {
    return {u, v, rho: minimum + span * (0.08 + Math.pow(random(), 2.2) * 0.5)};
  }
  const radialSample = parameters.seedMode === 'uniform-volume'
    ? Math.sqrt(random())
    : random();
  return {u, v, rho: minimum + span * radialSample};
}

const finiteState = (state: TorusState) => (
  Number.isFinite(state.u) && Number.isFinite(state.v) && Number.isFinite(state.rho)
);

function writePoint(
  target: Float32Array,
  vertexIndex: number,
  point: Point3,
) {
  const offset = vertexIndex * 3;
  target[offset] = point.x;
  target[offset + 1] = point.y;
  target[offset + 2] = point.z;
}

export function generateStreamlineData(
  rawParameters: TorusSimulationParameters,
): StreamlineData {
  const startedAt = performance.now();
  const parameters = sanitizeSimulationParameters(rawParameters);
  const segmentCount = parameters.streamlineCount * (parameters.samplesPerLine - 1);
  const vertexCount = segmentCount * 2;
  const positions = new Float32Array(vertexCount * 3);
  const pathPositions = new Float32Array(vertexCount);
  const seeds = new Float32Array(vertexCount);
  const speeds = new Float32Array(vertexCount);
  const radii = new Float32Array(vertexCount);
  const intensities = new Float32Array(vertexCount);
  const random = createRandom(parameters.randomSeed);
  let vertexCursor = 0;
  let speedTotal = 0;
  let speedSamples = 0;
  let maxSpeed = 0;
  let closureTotal = 0;
  let invalidTrajectories = 0;

  const derivative = (state: TorusState, time: number) => (
    evaluateTorusField(state, parameters, time)
  );

  for (let lineIndex = 0; lineIndex < parameters.streamlineCount; lineIndex += 1) {
    let state = createSeedState(lineIndex, parameters, random);
    const firstPoint = torusToCartesian(state, parameters.majorRadius);
    let previousPoint = firstPoint;
    let previousDerivative = derivative(state, 0);
    let previousVelocity = torusVelocityToCartesian(state, previousDerivative, parameters.majorRadius);
    let previousSpeed = Math.hypot(previousVelocity.x, previousVelocity.y, previousVelocity.z);
    const lineSeed = random();
    const lineIntensity = 0.68 + random() * 0.32;

    for (let sampleIndex = 1; sampleIndex < parameters.samplesPerLine; sampleIndex += 1) {
      const time = (sampleIndex - 1) * parameters.integrationStep;
      let nextState = rk4Step(state, time, parameters.integrationStep, derivative);
      if (!finiteState(nextState)) {
        invalidTrajectories += 1;
        nextState = createSeedState(lineIndex + sampleIndex * 17, parameters, random);
      }
      nextState = constrainState(nextState, parameters);
      const nextPoint = torusToCartesian(nextState, parameters.majorRadius);
      const nextDerivative = derivative(nextState, time + parameters.integrationStep);
      const nextVelocity = torusVelocityToCartesian(nextState, nextDerivative, parameters.majorRadius);
      const nextSpeed = Math.hypot(nextVelocity.x, nextVelocity.y, nextVelocity.z);
      const progressStart = (sampleIndex - 1) / (parameters.samplesPerLine - 1);
      const progressEnd = sampleIndex / (parameters.samplesPerLine - 1);

      writePoint(positions, vertexCursor, previousPoint);
      writePoint(positions, vertexCursor + 1, nextPoint);
      pathPositions[vertexCursor] = progressStart;
      pathPositions[vertexCursor + 1] = progressEnd;
      seeds[vertexCursor] = lineSeed;
      seeds[vertexCursor + 1] = lineSeed;
      speeds[vertexCursor] = previousSpeed;
      speeds[vertexCursor + 1] = nextSpeed;
      radii[vertexCursor] = state.rho / parameters.minorRadius;
      radii[vertexCursor + 1] = nextState.rho / parameters.minorRadius;
      intensities[vertexCursor] = lineIntensity;
      intensities[vertexCursor + 1] = lineIntensity;
      vertexCursor += 2;

      speedTotal += nextSpeed;
      speedSamples += 1;
      maxSpeed = Math.max(maxSpeed, previousSpeed, nextSpeed);
      state = nextState;
      previousPoint = nextPoint;
      previousDerivative = nextDerivative;
      previousVelocity = nextVelocity;
      previousSpeed = nextSpeed;
    }

    closureTotal += Math.hypot(
      previousPoint.x - firstPoint.x,
      previousPoint.y - firstPoint.y,
      previousPoint.z - firstPoint.z,
    ) / (parameters.majorRadius + parameters.minorRadius);
  }

  const safeMaxSpeed = Math.max(maxSpeed, 0.0001);
  for (let index = 0; index < speeds.length; index += 1) {
    speeds[index] = clamp(speeds[index] / safeMaxSpeed, 0, 1);
  }

  return {
    intensities,
    pathPositions,
    positions,
    radii,
    seeds,
    speeds,
    stats: {
      averageSpeed: speedTotal / Math.max(1, speedSamples),
      closureError: closureTotal / parameters.streamlineCount,
      computeMs: performance.now() - startedAt,
      invalidTrajectories,
      maxSpeed,
      pointCount: parameters.streamlineCount * parameters.samplesPerLine,
      segmentCount,
      streamlineCount: parameters.streamlineCount,
    },
  };
}

export function serializeTorusState(value: Record<string, unknown>) {
  return encodeURIComponent(JSON.stringify(value));
}

export function parseTorusState(serialized: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(serialized));
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
