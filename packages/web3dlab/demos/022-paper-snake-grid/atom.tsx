import React from "react";
import { SNAKE_EFFECT_CONTROLS } from "../../core/simulations/controls";
import type { EffectAtomRuntimeProps } from "../../core/simulations/types";
import { Web3DEngine } from "../../core/Web3DEngine";
import { SnakeGridEffect } from "../../demos/022-paper-snake-grid/022-PaperSnakeGrid";

const renderSnakeLayer = ({
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
      }}
    >
      <SnakeGridEffect seed={seed} absoluteFrame={absoluteFrame} simulationFrame={simulationFrame} />
    </Web3DEngine>
  );
};

const SnakeGridAtom: React.FC<EffectAtomRuntimeProps> = (props) => {
  return renderSnakeLayer(props);
};

export { SNAKE_EFFECT_CONTROLS, renderSnakeLayer, SnakeGridAtom };
