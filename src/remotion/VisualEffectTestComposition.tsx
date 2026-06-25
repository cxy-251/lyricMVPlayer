import React from "react";
import {AbsoluteFill} from "remotion";

import {RemotionEffectLayer} from "../../modules/render-core/src/visual-effects/runtime";
import {previewCompositionProps} from "./preview-composition-props";

export const VisualEffectTestComposition: React.FC<{recipeId?: string}> = ({recipeId = "web3d/ultimate-convergence"}) => (
  <AbsoluteFill style={{backgroundColor: "#000"}}>
    <RemotionEffectLayer
      audioFeatures={previewCompositionProps.audioFeatures}
      recipeId={recipeId}
      seed={1307}
    />
  </AbsoluteFill>
);
