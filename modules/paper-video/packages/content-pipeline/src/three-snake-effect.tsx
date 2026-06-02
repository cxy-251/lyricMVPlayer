import React from "react";
import {useThreeSnakeRenderer} from "./use-three-snake-renderer";
import type {ThreeLifeEffectProps} from "./three-life-effect.types";

export const ThreeSnakeEffect: React.FC<ThreeLifeEffectProps> = (props) => {
  const {canvasRef} = useThreeSnakeRenderer(props);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
      width={props.width}
      height={props.height}
    />
  );
};
