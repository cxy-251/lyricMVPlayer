import React from "react";
import { LIGHTS_EFFECT_CONTROLS } from "../core/simulations/controls";
import type { EffectAtomRuntimeProps } from "../core/simulations/types";
import { Web3DEngine } from "../core/Web3DEngine";
import { LightsBeamsEffect } from "../demos/paper-lights-beams/PaperLightsBeamsDemo";

const renderLightsLayer = ({
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
        camera: { fov: 34, far: 100, near: 0.1, position: [0, 1.38, 7.6] },
        bloom: { intensity: 0.5, luminanceThreshold: 0.78, luminanceSmoothing: 0.22 },
      }}
    >
      <LightsBeamsEffect seed={seed} absoluteFrame={absoluteFrame} simulationFrame={simulationFrame} />
    </Web3DEngine>
  );
};

const LightsLaunchAtom: React.FC<EffectAtomRuntimeProps> = (props) => {
  return renderLightsLayer(props);
};

const LightsBeamsAtom: React.FC<EffectAtomRuntimeProps> = (props) => {
  return renderLightsLayer(props);
};

export { LIGHTS_EFFECT_CONTROLS, renderLightsLayer, LightsLaunchAtom, LightsBeamsAtom };
