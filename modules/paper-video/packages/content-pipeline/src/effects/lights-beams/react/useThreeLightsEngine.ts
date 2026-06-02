import {useEffect, useRef, useState} from "react";
import {ThreeLightsEngine} from "../core/ThreeLightsEngine";

export const useThreeLightsEngine = ({
  height,
  width,
}: {
  height: number;
  width: number;
}) => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ThreeLightsEngine | null>(null);

  useEffect(() => {
    if (!canvas) {
      return;
    }

    const engine = new ThreeLightsEngine(canvas, {height, width});
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [canvas]);

  useEffect(() => {
    engineRef.current?.resize(width, height);
  }, [height, width]);

  return {
    canvasRef: setCanvas,
    engineRef,
  };
};
