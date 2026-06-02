import React, {useEffect} from "react";
import {useCurrentFrame} from "remotion";
import {useThreeLightsEngine} from "./useThreeLightsEngine";
import type {RemotionLightsLayerProps} from "../lights-beams.types";

export const RemotionLightsLayer: React.FC<RemotionLightsLayerProps> = ({
  absoluteFrame,
  activationFrame,
  className,
  height,
  modules,
  seed,
  simulationFrame,
  width,
}) => {
  const remotionFrame = useCurrentFrame();
  const resolvedFrame = simulationFrame ?? absoluteFrame ?? remotionFrame;
  const {canvasRef, engineRef} = useThreeLightsEngine({height, width});

  useEffect(() => {
    engineRef.current?.renderFrame({
      absoluteFrame: resolvedFrame,
      activationFrame,
      modules,
      seed,
      simulationFrame: resolvedFrame,
    });
  }, [activationFrame, engineRef, modules, resolvedFrame, seed]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
      width={width}
      height={height}
    />
  );
};
