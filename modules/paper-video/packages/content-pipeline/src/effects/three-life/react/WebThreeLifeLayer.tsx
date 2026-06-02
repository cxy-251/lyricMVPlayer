import React, {useEffect, useMemo, useRef} from "react";
import {useThreeLifeEngine} from "./useThreeLifeEngine";
import type {WebThreeLifeLayerProps} from "../three-life.types";

const WEB_FPS = 24;
const FRAME_MS = 1000 / WEB_FPS;

export const WebThreeLifeLayer: React.FC<WebThreeLifeLayerProps> = ({
  activationFrame,
  className,
  height,
  isRunning = false,
  modules,
  resetToken = 0,
  seed,
  width,
}) => {
  const {canvasRef, engineRef} = useThreeLifeEngine({height, width});
  const rafRef = useRef<number | null>(null);
  const elapsedFrameRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const latestParamsRef = useRef({
    activationFrame,
    modules,
    seed,
  });

  latestParamsRef.current = {
    activationFrame,
    modules,
    seed,
  };

  const renderCurrentFrame = useMemo(
    () => () => {
      const engine = engineRef.current;
      if (!engine) {
        return;
      }

      engine.renderFrame({
        absoluteFrame: elapsedFrameRef.current,
        activationFrame: latestParamsRef.current.activationFrame,
        modules: latestParamsRef.current.modules,
        seed: latestParamsRef.current.seed,
        simulationFrame: elapsedFrameRef.current,
      });
    },
    [engineRef],
  );

  useEffect(() => {
    renderCurrentFrame();
  }, [renderCurrentFrame, resetToken, activationFrame, modules, seed]);

  useEffect(() => {
    if (!isRunning) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      startedAtRef.current = null;
      renderCurrentFrame();
      return;
    }

    /**
     * The browser preview owns its own RAF loop so React does not become the
     * per-frame render driver. Remotion uses the same engine through a
     * different adapter, but the browser path stays decoupled and smooth.
     */
    const tick = (now: number) => {
      if (startedAtRef.current === null) {
        startedAtRef.current = now - elapsedFrameRef.current * FRAME_MS;
      }

      elapsedFrameRef.current = Math.max(
        0,
        Math.floor((now - startedAtRef.current) / FRAME_MS),
      );
      renderCurrentFrame();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isRunning, renderCurrentFrame, resetToken]);

  useEffect(() => {
    elapsedFrameRef.current = 0;
    startedAtRef.current = null;
    renderCurrentFrame();
  }, [resetToken, renderCurrentFrame]);

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
