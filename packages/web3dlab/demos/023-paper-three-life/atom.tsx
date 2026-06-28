import React from "react";
import { LIFE_EFFECT_CONTROLS } from "../../core/simulations/controls";
import type { EffectAtomRuntimeProps } from "../../core/simulations/types";
import { Web3DEngine } from "../../core/Web3DEngine";
import { ThreeLifeEffect } from "../../demos/023-paper-three-life/023-PaperThreeLife";

const renderLifeLayer = ({
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
      <ThreeLifeEffect seed={seed} absoluteFrame={absoluteFrame} simulationFrame={simulationFrame} />
    </Web3DEngine>
  );
};

const CellularLifeAtom: React.FC<EffectAtomRuntimeProps> = (props) => {
  return renderLifeLayer(props);
};

export { LIFE_EFFECT_CONTROLS, renderLifeLayer, CellularLifeAtom };
