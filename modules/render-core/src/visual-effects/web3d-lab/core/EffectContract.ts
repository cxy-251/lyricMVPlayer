export type EffectInput = {
  pointer: { x: number; y: number; z: number };
  clicks: number;
};

export type AudioFeatures = {
  frequencyData: Float32Array;
  timeDomainData: Float32Array;
  bass: number;
  mid: number;
  treble: number;
  energy: number;
};

export type EffectFrame = {
  frame: number;
  fps: number;
  time: number;
  delta: number;
  width: number;
  height: number;
  pixelRatio: number;
  seed: number;
  input: EffectInput;
  audioFeatures?: AudioFeatures;
};

export interface EffectScene<Config> {
  mount(target: HTMLElement | HTMLCanvasElement | null): void;
  setConfig(config: Config): void;
  resize(width: number, height: number, pixelRatio: number): void;
  renderFrame(frame: EffectFrame): void;
  dispose(): void;
}
