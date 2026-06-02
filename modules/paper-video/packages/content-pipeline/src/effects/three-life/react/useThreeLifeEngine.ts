import {useEffect, useRef, useState} from "react";
import {ThreeLifeEngine} from "../core/ThreeLifeEngine";

export const useThreeLifeEngine = ({
  height,
  width,
}: {
  height: number;
  width: number;
}) => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ThreeLifeEngine | null>(null);

  useEffect(() => {
    if (!canvas) {
      return;
    }

    const engine = new ThreeLifeEngine(canvas, {height, width});
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
