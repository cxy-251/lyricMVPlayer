import React from "react";
import {useThreeParticleRenderer} from "./use-three-particle-renderer";
import type {ThreeLifeEffectProps} from "./three-life-effect.types";

export const ThreeParticleEffect: React.FC<ThreeLifeEffectProps> = (props) => {
  const {canvasRef} = useThreeParticleRenderer(props);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
};
