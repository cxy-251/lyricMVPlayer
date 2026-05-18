import React, {useEffect, useRef} from "react";

type WaveformEnergyCanvasProps = {
  currentTimeMs: number;
  bass: number;
  mid: number;
  high: number;
  energy: number;
  onset: number;
  isPlaying: boolean;
};

const smoothNoise = (value: number): number => {
  const base = Math.sin(value * 12.9898) * 43758.5453;
  return base - Math.floor(base);
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const WaveformEnergyCanvas: React.FC<WaveformEnergyCanvasProps> = ({
  currentTimeMs,
  bass,
  mid,
  high,
  energy,
  onset,
  isPlaying
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothedBassRef = useRef(0.1);
  const smoothedMidRef = useRef(0.08);
  const smoothedHighRef = useRef(0.04);
  const smoothedEnergyRef = useRef(0.08);
  const smoothedOnsetRef = useRef(0.0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const width = 1080;
    const height = 410;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.lineCap = "round";
    context.lineJoin = "round";

    const targetBass = isPlaying ? bass : 0.08;
    const targetMid = isPlaying ? mid : 0.06;
    const targetHigh = isPlaying ? high * 0.28 : 0.02;
    const targetEnergy = isPlaying ? energy : 0.08;
    const targetOnset = isPlaying ? onset : 0.0;

    smoothedBassRef.current = smoothedBassRef.current * 0.95 + targetBass * 0.05;
    smoothedMidRef.current = smoothedMidRef.current * 0.95 + targetMid * 0.05;
    smoothedHighRef.current = smoothedHighRef.current * 0.98 + targetHigh * 0.02;
    smoothedEnergyRef.current = smoothedEnergyRef.current * 0.96 + targetEnergy * 0.04;
    smoothedOnsetRef.current = smoothedOnsetRef.current * 0.9 + targetOnset * 0.1;

    const smoothedBass = clamp(smoothedBassRef.current, 0, 1);
    const smoothedMid = clamp(smoothedMidRef.current, 0, 1);
    const smoothedHigh = clamp(smoothedHighRef.current, 0, 1);
    const smoothedEnergy = clamp(smoothedEnergyRef.current, 0, 1);
    const smoothedOnset = clamp(smoothedOnsetRef.current, 0, 1);

    const sampleCount = 220;
    const lines = 9;
    const centerY = 282;
    const amplitudeBase = 1.2 + smoothedBass * 12 + smoothedMid * 3.5 + smoothedOnset * 5;
    const idleCompression = isPlaying ? 1 : 0.32;
    const amplitude = amplitudeBase * idleCompression;
    const lowWaveWeight = 0.86 + smoothedBass * 0.42;
    const midWaveWeight = 0.1 + smoothedMid * 0.1;
    const shimmerWeight = smoothedHigh * 0.018;
    const flowPhase = currentTimeMs * (0.00028 + smoothedEnergy * 0.00014);
    const tailLift = 16 + smoothedEnergy * 10 + smoothedOnset * 4;

    context.globalCompositeOperation = "screen";

    for (let lineIndex = 0; lineIndex < lines; lineIndex += 1) {
      const middle = Math.floor(lines / 2);
      const distanceFromCenter = Math.abs(lineIndex - middle);
      const centerBias = 1 - distanceFromCenter / Math.max(1, middle);
      const offsetY = (lineIndex - middle) * 14;
      const strokeWidth = lineIndex === middle ? 1.6 : 0.45 + centerBias * 0.52;
      const alpha = lineIndex === middle ? 0.17 : 0.015 + centerBias * 0.028;
      const localAmplitude = amplitude * (0.54 + centerBias * 0.22);
      const linePhase = flowPhase + lineIndex * 0.11;

      for (let trailIndex = 0; trailIndex < 2; trailIndex += 1) {
        const trailShift = trailIndex === 0 ? 0 : 16;
        const trailAlpha = trailIndex === 0 ? alpha : alpha * 0.34;
        const trailYOffset = trailIndex === 0 ? 0 : tailLift * (0.12 + centerBias * 0.08);

        context.beginPath();

        let previousX = 0;
        let previousY = centerY + offsetY + trailYOffset;

        for (let step = 0; step <= sampleCount; step += 1) {
          const x = (step / sampleCount) * width;
          const t = step / sampleCount;
          const horizontalEase = Math.sin(t * Math.PI);
          const lowWave = Math.sin(t * Math.PI * 1.65 + linePhase - trailShift * 0.0032);
          const midWave = Math.sin(t * Math.PI * 3.2 - linePhase * 0.62) * 0.28;
          const shimmer = Math.sin(t * Math.PI * 8.4 + linePhase * 0.45) * shimmerWeight;
          const organicNoise = (smoothNoise(t * 5.5 + lineIndex * 0.33 + linePhase) - 0.5) * 0.22;
          const displacement =
            (lowWave * lowWaveWeight + midWave * midWaveWeight + shimmer + organicNoise) *
            localAmplitude *
            horizontalEase;
          const y = centerY + offsetY + trailYOffset + displacement;

          if (step === 0) {
            context.moveTo(x, y);
          } else {
            const controlX = previousX + (x - previousX) * 0.5;
            const controlY = previousY + (y - previousY) * 0.5;
            context.quadraticCurveTo(previousX, previousY, controlX, controlY);
          }

          previousX = x;
          previousY = y;
        }

        context.strokeStyle =
          lineIndex === middle
            ? `rgba(236,241,255,${trailAlpha})`
            : `rgba(126,164,255,${trailAlpha})`;
        context.lineWidth = strokeWidth;
        context.shadowBlur = lineIndex === middle ? 6 : 3;
        context.shadowColor =
          lineIndex === middle ? "rgba(120,165,255,0.07)" : "rgba(120,165,255,0.03)";
        context.stroke();
      }
    }

    const glow = context.createRadialGradient(width / 2, 320, 30, width / 2, 320, 360);
    glow.addColorStop(0, `rgba(112,148,255,${0.03 + smoothedEnergy * 0.018})`);
    glow.addColorStop(0.55, `rgba(112,148,255,${0.012 + smoothedBass * 0.01})`);
    glow.addColorStop(1, "rgba(112,148,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 120, width, height);
    context.globalCompositeOperation = "source-over";
  }, [bass, currentTimeMs, energy, high, isPlaying, mid, onset]);

  return (
    <div className="absolute left-0 top-[1510px] z-20 h-[410px] w-[1080px] overflow-hidden pointer-events-none">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
};
