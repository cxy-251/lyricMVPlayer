import type {
  ComplexPoint,
  EpicycleSegment,
  FourierCoefficient,
  FourierSortMode,
} from './types';

const TAU = Math.PI * 2;
const ZERO_THRESHOLD = 1e-12;

export function discreteFourierTransform(samples: ComplexPoint[]): FourierCoefficient[] {
  const sampleCount = samples.length;
  if (sampleCount === 0) return [];

  return Array.from({length: sampleCount}, (_, rawFrequency) => {
    const frequency = rawFrequency < sampleCount / 2
      ? rawFrequency
      : rawFrequency - sampleCount;
    let re = 0;
    let im = 0;

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const angle = -TAU * frequency * sampleIndex / sampleCount;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const sample = samples[sampleIndex];
      re += sample.x * cosine - sample.y * sine;
      im += sample.x * sine + sample.y * cosine;
    }

    re /= sampleCount;
    im /= sampleCount;
    if (Math.abs(re) < ZERO_THRESHOLD) re = 0;
    if (Math.abs(im) < ZERO_THRESHOLD) im = 0;

    return {
      frequency,
      amplitude: Math.hypot(re, im),
      phase: Math.atan2(im, re),
      re,
      im,
    };
  });
}

const compareByFrequency = (a: FourierCoefficient, b: FourierCoefficient) => {
  const magnitudeDifference = Math.abs(a.frequency) - Math.abs(b.frequency);
  if (magnitudeDifference !== 0) return magnitudeDifference;
  return b.frequency - a.frequency;
};

export function selectFourierCoefficients(
  coefficients: FourierCoefficient[],
  termCount: number,
  sortMode: FourierSortMode,
): FourierCoefficient[] {
  const safeCount = Math.max(1, Math.min(Math.round(termCount), coefficients.length));

  if (sortMode === 'frequency') {
    return [...coefficients].sort(compareByFrequency).slice(0, safeCount);
  }

  const dc = coefficients.find((coefficient) => coefficient.frequency === 0);
  const oscillatingTerms = coefficients
    .filter((coefficient) => coefficient.frequency !== 0)
    .sort((a, b) => b.amplitude - a.amplitude || compareByFrequency(a, b));

  return dc
    ? [dc, ...oscillatingTerms.slice(0, safeCount - 1)]
    : oscillatingTerms.slice(0, safeCount);
}

export function evaluateEpicycleChain(
  coefficients: FourierCoefficient[],
  timeAngle: number,
): {segments: EpicycleSegment[]; endpoint: ComplexPoint} {
  const segments: EpicycleSegment[] = [];
  let endpoint: ComplexPoint = {x: 0, y: 0};

  for (const coefficient of coefficients) {
    const center = endpoint;
    const angle = coefficient.frequency * timeAngle + coefficient.phase;
    endpoint = {
      x: center.x + coefficient.amplitude * Math.cos(angle),
      y: center.y + coefficient.amplitude * Math.sin(angle),
    };
    segments.push({center, end: endpoint, coefficient});
  }

  return {segments, endpoint};
}
