import {useCallback, useLayoutEffect, useRef} from "react";
import {ThreeDonutEngine} from "../core/ThreeDonutEngine";

export const useThreeDonutEngine = ({
  height,
  width,
}: {
  height: number;
  width: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ThreeDonutEngine | null>(null);

  const attachCanvas = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const engine = new ThreeDonutEngine(canvas, {height, width});
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [height, width]);

  useLayoutEffect(() => {
    engineRef.current?.resize(width, height);
  }, [height, width]);

  return {
    canvasRef: attachCanvas,
    engineRef,
  };
};
