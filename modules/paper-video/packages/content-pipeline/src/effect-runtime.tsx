import React from "react";
import {getEffectAtomDefinition} from "./effect-atoms";
import type {BackgroundEffectId, RenderManifest} from "@paper-to-video/shared-types";
import type {EffectAtomId} from "./effect-atoms.types";

export type EffectRuntimeMode = "interactive" | "render";

export type EffectRuntimeAdapterProps = {
  absoluteFrame: number;
  activationFrame: number;
  continuousEffectId?: EffectAtomId;
  interactionFrame?: number;
  effectStartFrame?: number;
  effectId: BackgroundEffectId;
  height: number;
  isRunning?: boolean;
  mode: EffectRuntimeMode;
  modules?: RenderManifest["modules"];
  onPrimaryAction?: () => void;
  resetToken?: number;
  seed: number;
  simulationFrame?: number;
  width: number;
};

export const EffectRuntimeAdapter: React.FC<EffectRuntimeAdapterProps> = ({
  absoluteFrame,
  activationFrame,
  continuousEffectId,
  interactionFrame,
  effectStartFrame,
  effectId,
  height,
  isRunning,
  mode,
  modules,
  onPrimaryAction,
  resetToken,
  seed,
  simulationFrame,
  width,
}) => {
  if (effectId === "none") {
    return null;
  }

  const definition = getEffectAtomDefinition(effectId);
  const effectiveInteractionFrame = interactionFrame ?? activationFrame;
  const effectiveEffectStartFrame = effectStartFrame ?? activationFrame;
  const effectiveRunning =
    mode === "render"
      ? absoluteFrame >= effectiveEffectStartFrame ||
        effectId === "cellular-life" ||
        effectId === "aurora" ||
        effectId === "snake-grid" ||
        effectId === "particle-orbit" ||
        effectId === "donut-spin" ||
        effectId === "lights-beams" ||
        effectId === "rubiks-auto-solve"
      : isRunning;
  const effectiveSimulationFrame =
    mode === "render" ? Math.max(0, absoluteFrame - effectiveEffectStartFrame) : (simulationFrame ?? absoluteFrame);

  return (
    <definition.Component
      absoluteFrame={absoluteFrame}
      activationFrame={activationFrame}
      continuousEffectId={continuousEffectId}
      interactionFrame={effectiveInteractionFrame}
      effectStartFrame={effectiveEffectStartFrame}
      height={height}
      isRunning={effectiveRunning}
      mode={mode}
      modules={modules}
      onPrimaryAction={onPrimaryAction}
      resetToken={resetToken}
      seed={seed}
      simulationFrame={effectiveSimulationFrame}
      width={width}
    />
  );
};
