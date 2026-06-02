import React from "react";

import type {VisualEffectConfigMap, VisualEffectId} from "../types";
import {EffectCanvas} from "./EffectCanvas";

export function RemotionEffectLayer<TId extends VisualEffectId>({
  config,
  effectId,
  seed,
}: {
  effectId: TId;
  config: VisualEffectConfigMap[TId];
  seed?: number;
}) {
  return (
    <EffectCanvas
      className="visual-effect-canvas visual-effect-canvas--remotion"
      config={config}
      effectId={effectId}
      seed={seed}
    />
  );
}

