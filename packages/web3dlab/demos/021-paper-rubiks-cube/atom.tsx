import React from "react";
import { RUBIKS_EFFECT_CONTROLS } from "../../core/simulations/controls";
import type { EffectAtomRuntimeProps } from "../../core/simulations/types";
import { Web3DEngine } from "../../core/Web3DEngine";
import { RubiksCubeEffect } from "../../demos/021-paper-rubiks-cube/021-PaperRubiksCube";

const renderRubiksLayer = ({
  absoluteFrame,
  height,
  mode,
  seed,
  simulationFrame,
  width,
}: EffectAtomRuntimeProps) => {
  return (
    <Web3DEngine
      style={{
        position: "absolute",
        inset: 0,
        width: mode === "render" ? width : "100%",
        height: mode === "render" ? height : "100%",
        pointerEvents: "none",
      }}
      config={{
        background: 'transparent',
        camera: { fov: 34, far: 100, near: 0.1, position: [5.8, 4.2, 7.3] },
      }}
    >
      <RubiksCubeEffect seed={seed} absoluteFrame={absoluteFrame} simulationFrame={simulationFrame} />
    </Web3DEngine>
  );
};

const RubiksLaunchAtom: React.FC<EffectAtomRuntimeProps> = (props) => {
  return renderRubiksLayer(props);
};

const RubiksAutoSolveAtom: React.FC<EffectAtomRuntimeProps> = (props) => {
  return renderRubiksLayer(props);
};

export { RUBIKS_EFFECT_CONTROLS, renderRubiksLayer, RubiksLaunchAtom, RubiksAutoSolveAtom };
