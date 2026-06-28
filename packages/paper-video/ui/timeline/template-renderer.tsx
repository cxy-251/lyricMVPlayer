import React from "react";
import type { RenderManifest, RenderScene, TemplateZoneId } from "../../shared-types";
import type { TemplateRenderContext } from "./types";
import { componentRegistry } from "./component-registry";

const selectSceneTemplate = (manifest: RenderManifest, scene: RenderScene) => {
  return (
    manifest.templateDocument.sceneTemplates.find((item) => item.sceneType === scene.type) ??
    manifest.templateDocument.sceneTemplates.find((item) => item.sceneType === "default") ??
    null
  );
};

export const renderTemplateZone = ({
  zone,
  context,
}: {
  zone: TemplateZoneId;
  context: TemplateRenderContext;
}) => {
  const template = selectSceneTemplate(context.manifest, context.scene);
  if (!template) {
    return [];
  }

  return template.nodes
    .filter((node) => node.zone === zone)
    .map((node) => {
      const renderer = componentRegistry[node.componentId];
      if (!renderer) {
        return null;
      }

      const result = renderer(node, context);
      if (!result) {
        return null;
      }

      return <React.Fragment key={node.id}>{result}</React.Fragment>;
    })
    .filter(Boolean);
};
