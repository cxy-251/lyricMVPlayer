import React, {useEffect, useRef} from "react";

type WaveformEnergyCanvasProps = {
  currentTimeMs: number;
  energy: number;
  isPlaying: boolean;
};

const smoothNoise = (value: number): number => {
  const base = Math.sin(value * 12.9898) * 43758.5453;
  return base - Math.floor(base);
};

export const WaveformEnergyCanvas: React.FC<WaveformEnergyCanvasProps> = ({
  currentTimeMs,
  energy,
  isPlaying
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

    const sampleCount = 240;
    const lines = 11;
    const centerY = 260;
    const activeEnergy = isPlaying ? energy : Math.max(0.12, energy);
    const phaseMs = isPlaying
      ? currentTimeMs
      : (typeof performance !== "undefined" ? performance.now() : Date.now());

    for (let lineIndex = 0; lineIndex < lines; lineIndex += 1) {
      const middle = Math.floor(lines / 2);
      const intensity = 1 - Math.abs(lineIndex - middle) / middle;
      const amplitude = 24 + activeEnergy * 46 * (0.6 + intensity * 0.85);
      const offsetY = (lineIndex - middle) * 12;
      const strokeWidth = lineIndex === middle ? 2.8 : 0.7 + intensity * 1.1;
      const alpha = lineIndex === middle ? 0.94 : 0.08 + intensity * 0.24;

      context.beginPath();

      let previousX = 0;
      let previousY = centerY + offsetY;

      for (let step = 0; step <= sampleCount; step += 1) {
        const x = (step / sampleCount) * width;
        const t = step / sampleCount;
        const waveA = Math.sin(t * Math.PI * 5 + phaseMs * 0.0021 + lineIndex * 0.31);
        const waveB = Math.sin(t * Math.PI * 9 - phaseMs * 0.0012 + lineIndex * 0.2) * 0.36;
        const waveC = (smoothNoise(t * 18 + lineIndex * 0.7 + phaseMs * 0.00045) - 0.5) * 0.72;
        const y = centerY + offsetY + (waveA + waveB + waveC) * amplitude;

        if (step === 0) {
          context.moveTo(x, y);
        } else {
          const cpx = (previousX + x) / 2;
          context.quadraticCurveTo(previousX, previousY, cpx, (previousY + y) / 2);
        }

        previousX = x;
        previousY = y;
      }

      context.strokeStyle =
        lineIndex === middle
          ? `rgba(240,244,255,${alpha})`
          : `rgba(124,170,255,${alpha})`;
      context.lineWidth = strokeWidth;
      context.shadowBlur = lineIndex === middle ? 18 : 8;
      context.shadowColor =
        lineIndex === middle ? "rgba(120,170,255,0.45)" : "rgba(120,170,255,0.16)";
      context.stroke();
    }

    const glow = context.createRadialGradient(width / 2, 300, 40, width / 2, 300, 320);
    glow.addColorStop(0, "rgba(100,145,255,0.14)");
    glow.addColorStop(1, "rgba(100,145,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 120, width, height);
  }, [currentTimeMs, energy, isPlaying]);

  return (
    <div className="absolute left-0 top-[1510px] z-20 h-[410px] w-[1080px] overflow-hidden pointer-events-none">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
};
