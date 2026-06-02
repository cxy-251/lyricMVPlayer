export type {
  AudioFeatureFrame,
  AudioFeatureTrack,
  BackgroundAsset,
  LyricVideoCompositionProps,
  PoetryFrame,
  PlaylistSummary,
  QueueTrack,
  SongLibraryItem,
  SongLibraryItemLoader,
  TimedLyricLine
} from "./types";
export {sampleCompositionProps} from "./sample-data";
export {validateCompositionProps} from "./validate-composition";
export {MusicVideoComposition} from "./compositions/MusicVideoComposition";
export {PaperVideo} from "./components/paper-video";
export {
  EffectCanvas,
  EffectLabPage,
  RemotionEffectLayer,
  getVisualEffectDefinition,
  visualEffectRegistry,
} from "./visual-effects";
export type {
  EffectClock,
  EffectInputState,
  EffectViewport,
  ParticleGalaxyConfig,
  VisualEffectConfigMap,
  VisualEffectId,
  VisualEffectMode,
  VisualEffectScene,
} from "./visual-effects";
