import {sampleFourierCrest} from './fourierMath';
import type {
  ArmGeometry,
  CurveDefinition,
  CurveParameters,
  CurveSample,
  Point,
} from './types';

const TAU = Math.PI * 2;

type EpicycleTerm = {amplitude: number; frequency: number; phase?: number};

const pointOnCircle = (radius: number, angle: number): Point => ({
  x: radius * Math.cos(angle),
  y: radius * Math.sin(angle),
});

function sampleEpicycleChain(terms: EpicycleTerm[], t: number): CurveSample {
  const arms: ArmGeometry[] = [];
  let endpoint: Point = {x: 0, y: 0};

  for (const term of terms) {
    const start = endpoint;
    const angle = term.frequency * t + (term.phase ?? 0);
    endpoint = {
      x: start.x + term.amplitude * Math.cos(angle),
      y: start.y + term.amplitude * Math.sin(angle),
    };
    arms.push({
      start,
      end: endpoint,
      radius: term.amplitude,
      frequency: term.frequency,
    });
  }

  return {
    point: endpoint,
    construction: {tracingPoint: endpoint, arms},
  };
}

const greatestCommonDivisor = (a: number, b: number): number => {
  let left = Math.abs(Math.round(a));
  let right = Math.abs(Math.round(b));
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return Math.max(1, left);
};

export function rollingCurvePeriod(parameters: CurveParameters): number {
  const scaledR = Math.max(1, Math.round(parameters.R * 2));
  const scaledr = Math.max(1, Math.round(parameters.r * 2));
  const turns = scaledr / greatestCommonDivisor(scaledR, scaledr);
  return TAU * turns;
}

export function normalizeCurveParameters(
  definition: CurveDefinition,
  parameters: CurveParameters,
): CurveParameters {
  const normalized = {
    R: Math.min(6, Math.max(0.5, parameters.R)),
    r: Math.min(3, Math.max(0.25, parameters.r)),
    d: Math.min(4, Math.max(0, parameters.d)),
    epicycles: Math.min(81, Math.max(3, Math.round(parameters.epicycles))),
  };
  if (definition.parameterMode === 'rolling-inside' && normalized.r >= normalized.R) {
    normalized.r = Math.max(0.25, normalized.R * 0.5);
  }
  return normalized;
}

function sampleRollingCircle(
  t: number,
  parameters: CurveParameters,
  mode: 'inside' | 'outside',
): CurveSample {
  const R = Math.max(0.5, parameters.R);
  const r = mode === 'inside'
    ? Math.min(Math.max(0.2, parameters.r), R * 0.92)
    : Math.max(0.2, parameters.r);
  const d = Math.max(0, parameters.d);
  const orbitRadius = mode === 'inside' ? R - r : R + r;
  const frequency = orbitRadius / r;
  const center = pointOnCircle(orbitRadius, t);
  const tracingPoint = mode === 'inside'
    ? {
        x: center.x + d * Math.cos(frequency * t),
        y: center.y - d * Math.sin(frequency * t),
      }
    : {
        x: center.x - d * Math.cos(frequency * t),
        y: center.y - d * Math.sin(frequency * t),
      };
  const motionDirection = {
    x: -orbitRadius * Math.sin(t),
    y: orbitRadius * Math.cos(t),
  };

  return {
    point: tracingPoint,
    construction: {
      fixedCircle: {center: {x: 0, y: 0}, radius: R},
      rollingCircle: {center, radius: r},
      tracingPoint,
      radiusLine: {start: center, end: tracingPoint},
      motionDirection,
    },
  };
}

const defaults = (overrides: Partial<CurveParameters> = {}): CurveParameters => ({
  R: 3,
  r: 1,
  d: 1,
  epicycles: 31,
  ...overrides,
});

const fixedPeriod = () => TAU;

export const CURVE_DEFINITIONS: CurveDefinition[] = [
  {
    id: 'rotating-vector',
    name: 'Circle from One Vector',
    category: 'basic',
    parameterMode: 'none',
    duration: 6,
    equation: 'x(t) = r cos(t),  y(t) = r sin(t)',
    accent: '#ff6b55',
    defaultParameters: defaults(),
    samplesPerTurn: 900,
    period: fixedPeriod,
    sample: (t) => sampleEpicycleChain([{amplitude: 0.86, frequency: 1}], t),
  },
  {
    id: 'line',
    name: 'Line',
    category: 'fourier',
    parameterMode: 'none',
    duration: 7,
    equation: 'z(t) = a exp(i t) + a exp(-i t) = 2a cos(t)',
    accent: '#64a0ef',
    defaultParameters: defaults(),
    samplesPerTurn: 1000,
    period: fixedPeriod,
    sample: (t) => sampleEpicycleChain([
      {amplitude: 0.44, frequency: 1},
      {amplitude: 0.44, frequency: -1},
    ], t),
  },
  {
    id: 'ellipse',
    name: 'Ellipse',
    category: 'fourier',
    parameterMode: 'none',
    duration: 7,
    equation: 'x=(a+b) cos(t),  y=(a-b) sin(t)',
    accent: '#64a0ef',
    defaultParameters: defaults(),
    samplesPerTurn: 1000,
    period: fixedPeriod,
    sample: (t) => sampleEpicycleChain([
      {amplitude: 0.6, frequency: 1},
      {amplitude: 0.24, frequency: -1},
    ], t),
  },
  {
    id: 'deltoid',
    name: 'Deltoid',
    category: 'hypocycloid',
    parameterMode: 'rolling-inside',
    duration: 8,
    equation: 'R=3r;  p=(R-r)e^(it) + r e^(-i(R-r)t/r)',
    accent: '#ff6b55',
    defaultParameters: defaults({R: 3, r: 1, d: 1}),
    samplesPerTurn: 2200,
    period: rollingCurvePeriod,
    sample: (t, parameters) => sampleRollingCircle(t, parameters, 'inside'),
  },
  {
    id: 'astroid',
    name: 'Astroid',
    category: 'hypocycloid',
    parameterMode: 'rolling-inside',
    duration: 8,
    equation: 'R=4r;  x=a cos^3(t),  y=a sin^3(t)',
    accent: '#ff6b55',
    defaultParameters: defaults({R: 4, r: 1, d: 1}),
    samplesPerTurn: 2400,
    period: rollingCurvePeriod,
    sample: (t, parameters) => sampleRollingCircle(t, parameters, 'inside'),
  },
  {
    id: 'hypotrochoid',
    name: 'Hypotrochoid',
    category: 'trochoid',
    parameterMode: 'rolling-inside',
    duration: 10,
    equation: 'p=(R-r)e^(it) + d e^(-i(R-r)t/r)',
    accent: '#c47ac7',
    defaultParameters: defaults({R: 5, r: 2, d: 3}),
    samplesPerTurn: 1500,
    period: rollingCurvePeriod,
    sample: (t, parameters) => sampleRollingCircle(t, parameters, 'inside'),
  },
  {
    id: 'cardioid',
    name: 'Cardioid',
    category: 'epicycloid',
    parameterMode: 'rolling-outside',
    duration: 8,
    equation: 'R=r;  x=2r cos(t)-r cos(2t)',
    accent: '#4bc29e',
    defaultParameters: defaults({R: 1.5, r: 1.5, d: 1.5}),
    samplesPerTurn: 2200,
    period: rollingCurvePeriod,
    sample: (t, parameters) => sampleRollingCircle(t, parameters, 'outside'),
  },
  {
    id: 'nephroid',
    name: 'Nephroid',
    category: 'epicycloid',
    parameterMode: 'rolling-outside',
    duration: 8,
    equation: 'R=2r;  x=3r cos(t)-r cos(3t)',
    accent: '#4bc29e',
    defaultParameters: defaults({R: 3, r: 1.5, d: 1.5}),
    samplesPerTurn: 2400,
    period: rollingCurvePeriod,
    sample: (t, parameters) => sampleRollingCircle(t, parameters, 'outside'),
  },
  {
    id: 'epitrochoid',
    name: 'Epitrochoid',
    category: 'trochoid',
    parameterMode: 'rolling-outside',
    duration: 10,
    equation: 'p=(R+r)e^(it) - d e^(i(R+r)t/r)',
    accent: '#c47ac7',
    defaultParameters: defaults({R: 3, r: 1, d: 1.7}),
    samplesPerTurn: 1500,
    period: rollingCurvePeriod,
    sample: (t, parameters) => sampleRollingCircle(t, parameters, 'outside'),
  },
  {
    id: 'rosette',
    name: 'Rosette',
    category: 'fourier',
    parameterMode: 'none',
    duration: 9,
    equation: 'z(t) = sum a_n exp(i(k_n t + phase_n))',
    accent: '#64a0ef',
    defaultParameters: defaults(),
    samplesPerTurn: 1500,
    period: fixedPeriod,
    sample: (t) => sampleEpicycleChain([
      {amplitude: 0.57, frequency: 1},
      {amplitude: 0.25, frequency: -5},
      {amplitude: 0.13, frequency: 7, phase: Math.PI / 2},
    ], t),
  },
  {
    id: 'fourier-crest',
    name: 'Fourier Crest',
    category: 'fourier',
    parameterMode: 'fourier',
    duration: 12,
    equation: 'z(t) = sum c_n exp(i n t)',
    accent: '#64a0ef',
    defaultParameters: defaults({epicycles: 31}),
    samplesPerTurn: 1800,
    period: fixedPeriod,
    sample: (t, parameters) => sampleFourierCrest(t, parameters.epicycles),
  },
];

export const CURVE_BY_ID = Object.fromEntries(
  CURVE_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<string, CurveDefinition>;
