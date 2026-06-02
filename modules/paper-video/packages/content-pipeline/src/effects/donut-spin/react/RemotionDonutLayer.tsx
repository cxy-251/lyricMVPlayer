import React, {useLayoutEffect} from "react";
import {useCurrentFrame} from "remotion";
import {useThreeDonutEngine} from "./useThreeDonutEngine";
import type {RemotionDonutLayerProps} from "../donut-spin.types";

export const RemotionDonutLayer: React.FC<RemotionDonutLayerProps> = ({
  absoluteFrame = 0,
  activationFrame,
  className,
  height,
  modules,
  seed,
  simulationFrame = 0,
  width,
}) => {
  const remotionFrame = useCurrentFrame();
  const resolvedFrame = simulationFrame ?? absoluteFrame ?? remotionFrame;
  const {canvasRef, engineRef} = useThreeDonutEngine({height, width});

  useLayoutEffect(() => {
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
