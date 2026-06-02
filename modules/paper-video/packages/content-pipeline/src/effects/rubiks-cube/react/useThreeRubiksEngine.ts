import {useEffect, useRef, useState} from "react";
import {ThreeRubiksEngine} from "../core/ThreeRubiksEngine";

export const useThreeRubiksEngine = ({
  height,
  width,
}: {
  height: number;
  width: number;
}) => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ThreeRubiksEngine | null>(null);

  useEffect(() => {
    if (!canvas) {
      return;
    }

    const engine = new ThreeRubiksEngine(canvas, {height, width});
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
