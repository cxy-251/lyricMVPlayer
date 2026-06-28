import {useEffect, useRef, useState, type RefObject} from "react";

import {clamp} from "../lib/math";

export const useAudioAnalyser = ({
  audioRef,
  isInteractiveAudio,
  isPlaying,
}: {
  audioRef: RefObject<HTMLAudioElement | null>;
  isInteractiveAudio: boolean;
  isPlaying: boolean;
}) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const energyRafRef = useRef<number | null>(null);
  const smoothedEnergyRef = useRef(0.16);
  const [audioEnergy, setAudioEnergy] = useState(0.16);

  useEffect(() => {
    if (!isInteractiveAudio || !audioRef.current || typeof window === "undefined") {
      return;
    }

    const audio = audioRef.current;
    const AudioContextClass =
      window.AudioContext ?? (window as typeof window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    const audioContext = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = audioContext;

    const analyser = analyserRef.current ?? audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.72;
    analyserRef.current = analyser;

    if (!mediaSourceRef.current) {
      const source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      mediaSourceRef.current = source;
    }

    const timeDomainData = new Uint8Array(analyser.fftSize);

    const updateEnergy = () => {
      analyser.getByteTimeDomainData(timeDomainData);

      let sumSquares = 0;
      for (let index = 0; index < timeDomainData.length; index += 1) {
        const normalized = (timeDomainData[index] - 128) / 128;
        sumSquares += normalized * normalized;
      }

      const rms = Math.sqrt(sumSquares / timeDomainData.length);
      const boostedEnergy = clamp(rms * 4.8, 0, 1);
      const idlePhase = typeof performance !== "undefined" ? performance.now() * 0.0014 : Date.now() * 0.0014;
      const idleEnergy = 0.1 + (Math.sin(idlePhase) * 0.5 + 0.5) * 0.06;
      const currentEnergy = isPlaying ? boostedEnergy : idleEnergy;
      const nextSmoothed = smoothedEnergyRef.current * 0.85 + currentEnergy * 0.15;

      smoothedEnergyRef.current = nextSmoothed;
      setAudioEnergy(nextSmoothed);
      energyRafRef.current = window.requestAnimationFrame(updateEnergy);
    };

    if (audioContext.state === "suspended") {
      void audioContext.resume().catch(() => undefined);
    }

    energyRafRef.current = window.requestAnimationFrame(updateEnergy);

    return () => {
      if (energyRafRef.current) {
        window.cancelAnimationFrame(energyRafRef.current);
        energyRafRef.current = null;
      }
    };
  }, [audioRef, isInteractiveAudio, isPlaying]);

  const resumeAudioContext = async () => {
    if (audioContextRef.current?.state === "suspended") {
      await audioContextRef.current.resume();
    }
  };

  return {
    audioEnergy,
    resumeAudioContext,
  };
};
