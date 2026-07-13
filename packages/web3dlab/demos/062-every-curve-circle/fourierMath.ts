import type {ArmGeometry, CurveSample, Point} from './types';

type FourierCoefficient = {
  frequency: number;
  amplitude: number;
  phase: number;
  re: number;
  im: number;
};

const TAU = Math.PI * 2;

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

function sampleClosedPolyline(vertices: Point[], sampleCount: number): Point[] {
  const segments = vertices.map((start, index) => {
    const end = vertices[(index + 1) % vertices.length];
    return {start, end, length: distance(start, end)};
  });
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  const samples: Point[] = [];
  let segmentIndex = 0;
  let segmentStartDistance = 0;

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const targetDistance = sampleIndex * totalLength / sampleCount;
    while (
      segmentIndex < segments.length - 1
      && targetDistance >= segmentStartDistance + segments[segmentIndex].length
    ) {
      segmentStartDistance += segments[segmentIndex].length;
      segmentIndex += 1;
    }
    const segment = segments[segmentIndex];
    const progress = (targetDistance - segmentStartDistance) / segment.length;
    samples.push({
      x: segment.start.x + (segment.end.x - segment.start.x) * progress,
      y: segment.start.y + (segment.end.y - segment.start.y) * progress,
    });
  }

  return samples;
}

function discreteFourierTransform(samples: Point[]): FourierCoefficient[] {
  return Array.from({length: samples.length}, (_, rawFrequency) => {
    const frequency = rawFrequency < samples.length / 2
      ? rawFrequency
      : rawFrequency - samples.length;
    let re = 0;
    let im = 0;

    for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
      const angle = -TAU * frequency * sampleIndex / samples.length;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const sample = samples[sampleIndex];
      re += sample.x * cosine - sample.y * sine;
      im += sample.x * sine + sample.y * cosine;
    }

    re /= samples.length;
    im /= samples.length;
    return {
      frequency,
      amplitude: Math.hypot(re, im),
      phase: Math.atan2(im, re),
      re,
      im,
    };
  });
}

const crestOutline: Point[] = [
  {x: -0.94, y: 0.08},
  {x: -0.52, y: -0.12},
  {x: -0.7, y: -0.58},
  {x: -0.24, y: -0.38},
  {x: 0, y: -0.96},
  {x: 0.22, y: -0.38},
  {x: 0.72, y: -0.56},
  {x: 0.52, y: -0.1},
  {x: 0.96, y: 0.1},
  {x: 0.46, y: 0.24},
  {x: 0.62, y: 0.72},
  {x: 0.14, y: 0.48},
  {x: 0, y: 0.88},
  {x: -0.16, y: 0.48},
  {x: -0.64, y: 0.7},
  {x: -0.46, y: 0.24},
];

const targetSamples = sampleClosedPolyline(crestOutline, 384);
const coefficients = discreteFourierTransform(targetSamples);
const selectedCoefficientCache = new Map<number, FourierCoefficient[]>();

function selectedCoefficients(termCount: number): FourierCoefficient[] {
  const safeCount = Math.max(3, Math.min(Math.round(termCount), 81));
  const cached = selectedCoefficientCache.get(safeCount);
  if (cached) return cached;
  const dc = coefficients.find((coefficient) => coefficient.frequency === 0);
  const oscillating = coefficients
    .filter((coefficient) => coefficient.frequency !== 0)
    .sort((a, b) => b.amplitude - a.amplitude);
  const selected = dc
    ? [dc, ...oscillating.slice(0, safeCount - 1)]
    : oscillating.slice(0, safeCount);
  selectedCoefficientCache.set(safeCount, selected);
  return selected;
}

export function sampleFourierCrest(t: number, termCount: number): CurveSample {
  const terms = selectedCoefficients(termCount);
  const arms: ArmGeometry[] = [];
  let endpoint: Point = {x: 0, y: 0};

  for (const coefficient of terms) {
    const start = endpoint;
    const angle = coefficient.frequency * t + coefficient.phase;
    endpoint = {
      x: start.x + coefficient.amplitude * Math.cos(angle),
      y: start.y + coefficient.amplitude * Math.sin(angle),
    };
    arms.push({
      start,
      end: endpoint,
      radius: coefficient.amplitude,
      frequency: coefficient.frequency,
    });
  }

  return {
    point: endpoint,
    construction: {tracingPoint: endpoint, arms},
  };
}
