export type EstimateLyricOffsetInput = {
  audioPath?: string;
  decodedAudioBuffer?: AudioBuffer;
  firstLrcTimeSec: number;
  minActiveDurationMs?: number;
  analysisWindowMs?: number;
  thresholdFloor?: number;
};

export type EstimateLyricOffsetResult = {
  lyricOffsetMs: number;
  detectedVocalStartSec: number;
  firstLrcTimeSec: number;
  threshold: number;
  smoothedRms: Float32Array;
  windowDurationSec: number;
};

const DEFAULT_ANALYSIS_WINDOW_MS = 20;
const DEFAULT_MIN_ACTIVE_DURATION_MS = 240;
const DEFAULT_THRESHOLD_FLOOR = 0.018;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const percentile = (values: number[], ratio: number): number => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = clamp(Math.floor((sorted.length - 1) * ratio), 0, sorted.length - 1);
  return sorted[index];
};

const decodeAudioBufferFromPath = async (audioPath: string): Promise<AudioBuffer> => {
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error("Web Audio API is not available in this environment.");
  }

  const response = await fetch(audioPath);
  if (!response.ok) {
    throw new Error(`Failed to load audio file: ${audioPath}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContextClass();

  try {
    return await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await audioContext.close().catch(() => undefined);
  }
};

const mixdownToMono = (audioBuffer: AudioBuffer): Float32Array => {
  const {numberOfChannels, length} = audioBuffer;
  if (numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  const mono = new Float32Array(length);
  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      mono[index] += channelData[index] / numberOfChannels;
    }
  }
  return mono;
};

const computeSmoothedRms = (
  monoSamples: Float32Array,
  sampleRate: number,
  windowMs: number
): {smoothedRms: Float32Array; windowDurationSec: number} => {
  const samplesPerWindow = Math.max(1, Math.floor((sampleRate * windowMs) / 1000));
  const windowCount = Math.max(1, Math.ceil(monoSamples.length / samplesPerWindow));
  const smoothedRms = new Float32Array(windowCount);
  let smoothedValue = 0;

  for (let windowIndex = 0; windowIndex < windowCount; windowIndex += 1) {
    const start = windowIndex * samplesPerWindow;
    const end = Math.min(start + samplesPerWindow, monoSamples.length);
    let sumSquares = 0;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      const sample = monoSamples[sampleIndex];
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / Math.max(1, end - start));
    smoothedValue = smoothedValue * 0.85 + rms * 0.15;
    smoothedRms[windowIndex] = smoothedValue;
  }

  return {
    smoothedRms,
    windowDurationSec: samplesPerWindow / sampleRate
  };
};

const detectVocalStartSec = (
  smoothedRms: Float32Array,
  windowDurationSec: number,
  minActiveDurationMs: number,
  thresholdFloor: number
): {detectedVocalStartSec: number; threshold: number} => {
  const values = Array.from(smoothedRms);
  const noiseFloor = percentile(values, 0.2);
  const highBand = percentile(values, 0.9);
  const dynamicThreshold = noiseFloor + (highBand - noiseFloor) * 0.22;
  const threshold = Math.max(thresholdFloor, dynamicThreshold);
  const minWindows = Math.max(1, Math.ceil((minActiveDurationMs / 1000) / windowDurationSec));

  let activeCount = 0;
  for (let index = 0; index < smoothedRms.length; index += 1) {
    if (smoothedRms[index] >= threshold) {
      activeCount += 1;
      if (activeCount >= minWindows) {
        const startIndex = index - activeCount + 1;
        return {
          detectedVocalStartSec: startIndex * windowDurationSec,
          threshold
        };
      }
    } else {
      activeCount = 0;
    }
  }

  return {
    detectedVocalStartSec: 0,
    threshold
  };
};

export const estimateLyricOffset = async (
  input: EstimateLyricOffsetInput
): Promise<EstimateLyricOffsetResult> => {
  const {
    audioPath,
    decodedAudioBuffer,
    firstLrcTimeSec,
    minActiveDurationMs = DEFAULT_MIN_ACTIVE_DURATION_MS,
    analysisWindowMs = DEFAULT_ANALYSIS_WINDOW_MS,
    thresholdFloor = DEFAULT_THRESHOLD_FLOOR
  } = input;

  if (typeof firstLrcTimeSec !== "number" || Number.isNaN(firstLrcTimeSec)) {
    throw new Error("firstLrcTimeSec must be a valid number.");
  }

  const audioBuffer =
    decodedAudioBuffer ??
    (audioPath ? await decodeAudioBufferFromPath(audioPath) : null);

  if (!audioBuffer) {
    throw new Error("estimateLyricOffset requires audioPath or decodedAudioBuffer.");
  }

  const monoSamples = mixdownToMono(audioBuffer);
  const {smoothedRms, windowDurationSec} = computeSmoothedRms(
    monoSamples,
    audioBuffer.sampleRate,
    analysisWindowMs
  );
  const {detectedVocalStartSec, threshold} = detectVocalStartSec(
    smoothedRms,
    windowDurationSec,
    minActiveDurationMs,
    thresholdFloor
  );

  return {
    lyricOffsetMs: Math.round((firstLrcTimeSec - detectedVocalStartSec) * 1000),
    detectedVocalStartSec,
    firstLrcTimeSec,
    threshold,
    smoothedRms,
    windowDurationSec
  };
};
