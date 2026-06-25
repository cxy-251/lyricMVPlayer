import type {Texture, WebGLRenderer} from "three";

export type VisualEffectMode = "interactive" | "remotion";
export type EffectBlendMode = "normal" | "add" | "screen" | "multiply";

export type EffectViewport = {width: number; height: number; pixelRatio: number};
export type EffectPointer = {x: number; y: number; pressed: number; wheel: number};

export type EffectAudioFrame = {
  bass: number;
  mid: number;
  high: number;
  energy: number;
  beat: number;
  onset: number;
};

export type EffectFrameContext = {
  mode: VisualEffectMode;
  frame: number;
  fps: number;
  time: number;
  delta: number;
  viewport: EffectViewport;
  pointer: EffectPointer;
  audio: EffectAudioFrame;
};

export type EffectControl =
  | {kind: "number"; field: string; label: string; min: number; max: number; step: number}
  | {kind: "color"; field: string; label: string};

export type EffectCapabilities = {
  audio?: boolean;
  pointer?: boolean;
  webgl2?: boolean;
  gpuHeavy?: boolean;
};

export type LayerTransform = {x: number; y: number; scale: number; rotation: number};

export type VisualEffectLayer<TConfig> = {
  setConfig(config: TConfig): void;
  resize(viewport: EffectViewport): void;
  render(renderer: WebGLRenderer, context: EffectFrameContext): Texture;
  dispose(): void;
};

export type VisualEffectAtom<TConfig = Record<string, unknown>> = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  defaultConfig: TConfig;
  controls: EffectControl[];
  capabilities: EffectCapabilities;
  sanitizeConfig(value: unknown): TConfig;
  createLayer(options: {seed: number; config: TConfig}): VisualEffectLayer<TConfig>;
};

export type RecipeLayer = {
  id: string;
  atomId: string;
  config: Record<string, unknown>;
  opacity: number;
  blendMode: EffectBlendMode;
  transform: LayerTransform;
  inputEnabled: boolean;
  visible: boolean;
};

export type VisualEffectRecipe = {
  id: string;
  title: string;
  description: string;
  source: "web3d" | "lyric" | "custom";
  layers: RecipeLayer[];
};

export const SILENT_AUDIO_FRAME: EffectAudioFrame = {
  bass: 0,
  mid: 0,
  high: 0,
  energy: 0,
  beat: 0,
  onset: 0,
};

export const IDENTITY_LAYER_TRANSFORM: LayerTransform = {x: 0, y: 0, scale: 1, rotation: 0};
