import type {
  BackgroundEffectId,
  BackgroundImageLayoutId,
  ContentProfileRegistryDocument,
  ProductionManifest,
  RenderManifest,
  RenderScene,
  SubtitleSegment,
  TextMotionConfig,
  VisualModuleConfig,
  WebGLEffectProfileId,
} from "@paper-to-video/shared-types";
import type {EffectAtomId, EffectControlDefinition, ThemePalette} from "@paper-to-video/content-pipeline";

export type TemplateRoute = {
  description: string;
  href: string;
  id: string;
  loadProductionManifest: () => Promise<ProductionManifest>;
  loadRenderManifest: () => Promise<RenderManifest>;
  title: string;
};

export type EffectRoute = {
  description: string;
  effectId: EffectAtomId;
  href: string;
  id: string;
  source: "default" | "latest";
  title: string;
};

export type TemplatePreviewState = {
  activeScene: RenderScene | null;
  activeSceneId: string;
  activeSubtitles: SubtitleSegment[];
  contentProfileOptions: ProfileOption[];
  errorMessage: string | null;
  effectProfileOptions: ProfileOption<WebGLEffectProfileId>[];
  loading: boolean;
  manifest: RenderManifest | null;
  previewFrame: number;
  selectedContentProfileId: string;
  selectedEffectProfileId: WebGLEffectProfileId;
  setActiveSceneId: (sceneId: string) => void;
  setSelectedContentProfileId: (profileId: string) => void;
  setSelectedEffectProfileId: (effectId: WebGLEffectProfileId) => void;
};

export type EffectPreviewState = {
  controlDefinitions: EffectControlDefinition[];
  errorMessage: string | null;
  isRunning: boolean;
  loading: boolean;
  manifest: RenderManifest | null;
  moduleOverrides: VisualModuleConfig;
  resetToken: number;
  resetSimulation: () => void;
  runtimeSeed: number;
  scene: RenderScene | null;
  setControlValue: (control: EffectControlDefinition, value: number | string) => void;
  setIsRunning: (isRunning: boolean) => void;
  simulationFrame: number;
};

export type TemplateStageModel = {
  absolutePreviewFrame: number;
  activationFrame: number;
  continuousEffectId: BackgroundEffectId;
  interactionFrame: number;
  backgroundEffectId: BackgroundEffectId;
  coverImageSrc: string | null;
  palette: ThemePalette;
  primaryNodes: React.ReactNode[];
  renderHeight: number;
  renderWidth: number;
  secondaryNodes: React.ReactNode[];
  stageBackground: string;
  textMotion: TextMotionConfig;
  visualLayout: {
    blurPx: number;
    brightness: number;
    opacity: number;
    saturation: number;
    scale: number;
    shade: string;
    translateX: number;
    translateY: number;
  };
};

export type EffectStageModel = {
  absolutePreviewFrame: number;
  activationFrame: number;
  continuousEffectId: EffectAtomId;
  interactionFrame: number;
  coverImageSrc: string | null;
  effectId: EffectAtomId;
  modules: VisualModuleConfig | undefined;
  palette: ThemePalette;
  renderHeight: number;
  renderWidth: number;
  stageBackground: string;
  visualLayout: {
    blurPx: number;
    brightness: number;
    opacity: number;
    saturation: number;
    scale: number;
    shade: string;
    translateX: number;
    translateY: number;
  };
};

export type AppRouteState = {
  currentPath: string;
  effectRoute: EffectRoute | null;
  navigate: (href: string) => void;
  templateRoute: TemplateRoute | null;
};

export type PreviewStageProps = {
  absolutePreviewFrame: number;
  activationFrame: number;
  continuousEffectId: BackgroundEffectId;
  interactionFrame: number;
  children?: React.ReactNode;
  coverImageSrc: string | null;
  effectId: BackgroundEffectId;
  effectLayer?: React.ReactNode;
  manifest: RenderManifest;
  palette: ThemePalette;
  previewFrame: number;
  renderHeight: number;
  renderWidth: number;
  surfaceVariant?: "phone" | "effect-lab";
  stageBackground: string;
  visualLayout: {
    blurPx: number;
    brightness: number;
    opacity: number;
    saturation: number;
    scale: number;
    shade: string;
    translateX: number;
    translateY: number;
  };
};

export type RouteLookup = {
  effectRoute: EffectRoute | null;
  templateRoute: TemplateRoute | null;
};

export type ProfileOption<TValue extends string = string> = {
  description?: string;
  id: TValue;
  label: string;
};

export type LegacyRedirectMap = Record<string, string>;

export type CoverLayoutConfig = {
  blurPx: number;
  brightness: number;
  objectPosition: string;
  opacity: number;
  saturation: number;
  scale: number;
  shade: string;
  translateX: number;
  translateY: number;
};

export type TemplateStageInput = {
  activeScene: RenderScene;
  activeSubtitles: SubtitleSegment[];
  manifest: RenderManifest;
  previewFrame: number;
};

export type EffectStageInput = {
  effectRoute: EffectRoute;
  isRunning: boolean;
  manifest: RenderManifest;
  moduleOverrides?: VisualModuleConfig;
  scene: RenderScene;
  simulationFrame: number;
};

export type TemplateLayoutInput = {
  activeScene: RenderScene;
  manifest: RenderManifest;
  previewFrame: number;
};

export type LayoutResolution = {
  activationFrame: number;
  interactionFrame: number;
  continuousEffectId: BackgroundEffectId;
  backgroundEffectId: BackgroundEffectId;
  coverImageSrc: string | null;
  palette: ThemePalette;
  stageBackground: string;
  textMotion: TextMotionConfig;
  visualLayout: CoverLayoutConfig;
};

export type EffectLayoutResolution = {
  absolutePreviewFrame: number;
  activationFrame: number;
  continuousEffectId: EffectAtomId;
  interactionFrame: number;
  coverImageSrc: string | null;
  effectId: EffectAtomId;
  modules: VisualModuleConfig | undefined;
  palette: ThemePalette;
  renderHeight: number;
  renderWidth: number;
  stageBackground: string;
  visualLayout: CoverLayoutConfig;
};

export type SceneSelectionResult = {
  activeScene: RenderScene | null;
  activeSubtitles: SubtitleSegment[];
};

export type EffectSelectionResult = {
  scene: RenderScene | null;
};

export type TemplateRouteCollection = TemplateRoute[];
export type EffectRouteCollection = EffectRoute[];

export type RouteCollections = {
  effectRoutes: EffectRouteCollection;
  templateRoutes: TemplateRouteCollection;
};

export type ContentProfileRegistry = ContentProfileRegistryDocument;

export type PreviewFrameController = {
  frame: number;
  reset: () => void;
  setRunning: (nextValue: boolean) => void;
};

export type CoverLayoutResolver = (
  currentLayoutId: BackgroundImageLayoutId,
  previousLayoutId: BackgroundImageLayoutId,
  previewFrame: number,
  sceneDuration: number,
  panTravelPercent: number,
) => CoverLayoutConfig;
