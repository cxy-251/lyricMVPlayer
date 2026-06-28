import React from "react";
import { DONUT_EFFECT_CONTROLS } from "../../core/simulations/controls";
import type { EffectAtomRuntimeProps } from "../../core/simulations/types";
import { Web3DEngine } from "../../core/Web3DEngine";
import { DonutSpinEffect } from "../../demos/019-paper-donut-spin/019-PaperDonutSpin";

const renderDonutLayer = ({
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
        camera: { fov: 34, far: 100, near: 0.1, position: [0, 0.92, 7.7] },
        bloom: { intensity: 0.22, luminanceThreshold: 0.38, luminanceSmoothing: 0.28 },
      }}
    >
      <DonutSpinEffect seed={seed} absoluteFrame={absoluteFrame} simulationFrame={simulationFrame} />
    </Web3DEngine>
  );
};

const DonutSpinAtom: React.FC<EffectAtomRuntimeProps> = (props) => {
  return renderDonutLayer(props);
};

export { DONUT_EFFECT_CONTROLS, renderDonutLayer, DonutSpinAtom };
