import React from "react";
import { PARTICLE_EFFECT_CONTROLS } from "../core/simulations/controls";
import type { EffectAtomRuntimeProps } from "../core/simulations/types";
import { Web3DEngine } from "../core/Web3DEngine";
import { ThreeParticleEffect } from "../demos/paper-three-particle/PaperThreeParticleDemo";

const renderParticleLayer = ({
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
      <ThreeParticleEffect seed={seed} absoluteFrame={absoluteFrame} simulationFrame={simulationFrame} />
    </Web3DEngine>
  );
};

const ParticleOrbitAtom: React.FC<EffectAtomRuntimeProps> = (props) => {
  return renderParticleLayer(props);
};

export { PARTICLE_EFFECT_CONTROLS, renderParticleLayer, ParticleOrbitAtom };
