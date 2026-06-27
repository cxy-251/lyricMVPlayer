import {useMemo, useState} from "react";
import * as THREE from "three";

export interface UseAudioVisualizerOptions {
  fftSize?: number;
}

export function useAudioVisualizer({fftSize = 128}: UseAudioVisualizerOptions = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const texture = useMemo(() => {
    const width = Math.max(1, fftSize / 2);
    const data = new Uint8Array(width * 4);
    const audioTexture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
    audioTexture.minFilter = THREE.LinearFilter;
    audioTexture.magFilter = THREE.LinearFilter;
    audioTexture.generateMipmaps = false;
    audioTexture.needsUpdate = true;
    return audioTexture;
  }, [fftSize]);

  return {
    isPlaying,
    start: () => setIsPlaying(false),
    stop: () => setIsPlaying(false),
    update: () => {
      texture.needsUpdate = true;
      return 0;
    },
    texture,
  };
}
