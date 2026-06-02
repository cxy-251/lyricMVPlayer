export type PaperSource = {
  id: string;
  source: "arxiv";
  arxivId: string;
  title: string;
  authors: string[];
  abstract: string;
  categories: string[];
  pdfUrl?: string;
  publishedAt?: string;
  fetchedAt: string;
};

export type ContentSection = {
  id: string;
  heading: string;
  narration: string;
  slideBullets: string[];
  imagePrompt: string;
};

export type ContentBrief = {
  projectId: string;
  sourcePaperId: string;
  language: "zh-CN";
  summary: {
    oneLiner: string;
    shortSummary: string;
    keyTakeaways: string[];
  };
  script: {
    hook: string;
    sections: ContentSection[];
    ending: string;
  };
};

export type BackgroundImageLayoutId =
  | "gradient-default"
  | "cover-full"
  | "cover-focus-tl"
  | "cover-focus-tr"
  | "cover-focus-br"
  | "cover-focus-bl";

export type BackgroundEffectId =
  | "none"
  | "aurora"
  | "grid-drift"
  | "noise-bloom"
  | "cellular-launch"
  | "cellular-life"
  | "snake-grid"
  | "particle-orbit"
  | "donut-spin"
  | "lights-launch"
  | "lights-beams"
  | "rubiks-launch"
  | "rubiks-auto-solve";

export type WebGLEffectProfileId =
  | "life-game"
  | "snake-grid"
  | "particle-orbit"
  | "donut-spin"
  | "lights-beams"
  | "rubiks-solver";

export type EffectProfileConfig = {
  id: WebGLEffectProfileId;
};

export type ContentProfileConfig = {
  id: string;
  path?: string;
};

export type SummaryModeId = "rule-based" | "lm-studio";

export type CoverProfileConfig = {
  id: string;
  path?: string;
};

export type TextMotionId = "fade-up" | "slide-up" | "stagger-rise" | "hard-cut";

export type TextMotionConfig = {
  enterFrames: number;
  maxLiftPx: number;
  minOpacity: number;
  bodyDelayFrames: number;
  bulletsStaggerFrames: number;
  exitFrames: number;
  exitLiftPx: number;
  exitOpacity: number;
};

export type BackgroundMotionConfig = {
  overscanPercent: number;
  panTravelPercent: number;
};

export type CellularEffectConfig = {
  cellColumns: number;
  cellRows: number;
  stepEveryFrames: number;
  cellPadding: number;
  cellScale: number;
  foodCount: number;
  snakeStrategy: "survival-chase" | "row-sweep" | "safe-loop";
  cornerRadius: number;
  edgeMode: "wrap";
  colorPreset: "mint-ice" | "sunset-pop" | "violet-cyan";
  primaryHue: number;
  primarySaturation: number;
  primaryLightness: number;
  secondaryHue: number;
  secondarySaturation: number;
  secondaryLightness: number;
  birthHue: number;
  birthSaturation: number;
  birthLightness: number;
  primaryColor: string;
  secondaryColor: string;
  birthColor: string;
  launchClickRatio: number;
  launchSettleRatio: number;
  minLaunchClickFrames: number;
  maxLaunchClickFrames: number;
  minLaunchSettleFrames: number;
  maxLaunchSettleFrames: number;
};

export type TypographyScaleConfig = {
  kickerSize: string;
  titleSize: string;
  bodySize: string;
  bulletSize: string;
  subtitleSize: string;
};

export type ParticleEffectConfig = {
  variant: "nebula" | "vortex" | "comet";
  shape: "circle" | "square" | "diamond";
  distribution: "core" | "spiral" | "halo";
  trajectory: "orbit" | "drift" | "wave";
  particleCount: number;
  pointSize: number;
  orbitRadius: number;
  swirlStrength: number;
  driftSpeed: number;
  layerDepth: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export type DonutEffectConfig = {
  variant: "classic" | "arcade" | "cosmic";
  ringRadius: number;
  tubeRadius: number;
  spinSpeed: number;
  orbitSpeed: number;
  wobbleAmount: number;
  pearlCount: number;
  glowIntensity: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export type RubiksEffectConfig = {
  turnFrames: number;
  holdFrames: number;
  cubeScale: number;
  cubieGap: number;
  floatAmplitude: number;
  cameraDrift: number;
};

export type LightsEffectConfig = {
  variant: "pulse" | "fan" | "bloom";
  palette: "midnight-cyan" | "violet-haze" | "sunset-plasma";
  density: number;
  speed: number;
  beatIntensity: number;
  beamCount: number;
  beamLength: number;
  beamThickness: number;
  orbitRadius: number;
  motionSpeed: number;
  spread: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export type VisualModuleConfig = {
  textMotions?: Partial<Record<TextMotionId, Partial<TextMotionConfig>>>;
  backgroundMotion?: Partial<BackgroundMotionConfig>;
  cellularEffect?: Partial<CellularEffectConfig>;
  particleEffect?: Partial<ParticleEffectConfig>;
  donutEffect?: Partial<DonutEffectConfig>;
  lightsEffect?: Partial<LightsEffectConfig>;
  rubiksEffect?: Partial<RubiksEffectConfig>;
  typography?: Partial<TypographyScaleConfig>;
};

export type TemplateZoneId = "primary" | "secondary";

export type AtomicComponentId =
  | "cover-avatar"
  | "scene-kicker"
  | "scene-title"
  | "scene-body"
  | "scene-bullets"
  | "subtitle-panel";

export type TemplateNode = {
  id: string;
  componentId: AtomicComponentId;
  zone: TemplateZoneId;
  props?: Record<string, unknown>;
};

export type SceneTemplateDefinition = {
  sceneType: ProductionScene["type"] | "default";
  nodes: TemplateNode[];
};

export type TemplateDocument = {
  id: string;
  version: string;
  description?: string;
  sceneTemplates: SceneTemplateDefinition[];
};

export type ProductionScene = {
  id: string;
  type:
    | "hero"
    | "paper-intro"
    | "summary"
    | "bullet"
    | "image-focus"
    | "quote"
    | "ending";
  contentRef: string;
  narrationText?: string;
  content?: Record<string, unknown>;
  imagePrompt?: string;
  imageAssetId?: string;
  backgroundPresetId: string;
  backgroundImageLayoutId?: BackgroundImageLayoutId;
  backgroundEffectId?: BackgroundEffectId;
  motionPresetId: TextMotionId;
  durationStrategy: "auto-by-audio" | "fixed";
  fixedDurationMs?: number;
};

export type ProductionManifest = {
  projectId: string;
  seed: number;
  locale: "zh-CN";
  template: {
    id: string;
    path: string;
  };
  contentProfile?: ContentProfileConfig;
  coverProfile?: CoverProfileConfig;
  coverImage?: {
    source: "local" | "remote";
    path: string;
    alt?: string;
  };
  output: {
    width: number;
    height: number;
    fps: number;
    platform: "douyin" | "xiaohongshu" | "bilibili-short";
  };
  paper: {
    source: "arxiv";
    paperId: string;
    title: string;
    pdfUrl?: string;
    localPdfPath?: string;
    categories?: string[];
    publishedAt?: string;
  };
  theme: {
    id: string;
    paletteId: string;
    fontPackId: string;
  };
  voice: {
    provider: "edge-tts";
    name: string;
    rate: string;
    pitch: string;
    volume?: string;
  };
  effectProfile?: EffectProfileConfig;
  modules?: VisualModuleConfig;
  scenes: ProductionScene[];
};

export type ContentProfileSceneEntry = {
  narrationText: string;
  content?: Record<string, unknown>;
  imagePrompt?: string;
  imageAssetId?: string;
};

export type ContentProfileDocument = {
  id: string;
  paper?: Partial<ProductionManifest["paper"]>;
  coverImage?: CoverImageAsset;
  scenes: Record<string, ContentProfileSceneEntry>;
};

export type ContentProfileRegistryDocument = {
  profiles: Array<{
    id: string;
    path: string;
    label?: string;
  }>;
};

export type CoverProfileRegistryDocument = {
  assets: Array<
    CoverImageAsset & {
      id: string;
      label?: string;
    }
  >;
};

export type ImageAsset = {
  id: string;
  prompt: string;
  localPath: string;
  provider: string;
  width?: number;
  height?: number;
  styleTag?: string;
};

export type CoverImageAsset = {
  source: "local" | "remote";
  path: string;
  alt?: string;
};

export type AudioSegment = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  role: "narration" | "subtitle";
};

export type AudioAsset = {
  id: string;
  filePath: string;
  durationMs: number;
  sceneId: string;
  segments: AudioSegment[];
};

export type SubtitleSegment = {
  id: string;
  sceneId: string;
  text: string;
  startFrame: number;
  endFrame: number;
  emphasisLevel?: number;
};

export type SceneTiming = {
  enterFrames: number;
  holdFrames: number;
  exitFrames: number;
  audioOffsetFrames: number;
  interactionFrameOffset: number;
  effectStartFrameOffset: number;
};

export type RenderScene = {
  id: string;
  type: ProductionScene["type"];
  fromFrame: number;
  durationInFrames: number;
  backgroundPresetId: string;
  backgroundImageLayoutId: BackgroundImageLayoutId;
  backgroundEffectId: BackgroundEffectId;
  motionPresetId: TextMotionId;
  imageAssetIds: string[];
  audioSegmentIds: string[];
  subtitleSegmentIds: string[];
  content: Record<string, unknown>;
  timing: SceneTiming;
};

export type RenderManifest = {
  projectId: string;
  seed: number;
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  template: ProductionManifest["template"];
  templateDocument: TemplateDocument;
  coverImage?: CoverImageAsset;
  paper: ProductionManifest["paper"];
  theme: ProductionManifest["theme"];
  voice: ProductionManifest["voice"];
  effectProfile?: EffectProfileConfig;
  modules?: VisualModuleConfig;
  scenes: RenderScene[];
  audioAssets: AudioAsset[];
  imageAssets: ImageAsset[];
  subtitleSegments: SubtitleSegment[];
};
