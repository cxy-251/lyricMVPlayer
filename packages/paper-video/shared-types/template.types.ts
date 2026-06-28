import type { ProductionScene } from "./manifest.types";

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

