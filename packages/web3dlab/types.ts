import type {ComponentType} from 'react';

export type VisualEffectMode = "interactive" | "remotion";

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

export const SILENT_AUDIO_FRAME: EffectAudioFrame = {
  bass: 0,
  mid: 0,
  high: 0,
  energy: 0,
  beat: 0,
  onset: 0,
};

export type DemoMetadata = {
  id: string;
  number?: string;
  title: string;
  description: string;
  tags: string[];
  route: string;
  instructions?: string[];
};

export type DemoDefinition = DemoMetadata & {
  Component: ComponentType;
};
