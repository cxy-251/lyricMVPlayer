import type { RenderManifest, RenderScene } from "../../shared-types";

export type TemplateRenderContext = {
  manifest: RenderManifest;
  scene: RenderScene;
  coverSrc: string | null;
  subtitleText: string | null;
};
