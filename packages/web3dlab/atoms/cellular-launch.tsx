import React from "react";
import type { EffectAtomRuntimeProps } from "../core/simulations/types";
import { baseLayerStyle, launchButtonBaseStyle, getLaunchButtonState, getLaunchButtonBackground } from "./styles";

import { renderDonutLayer } from "./donut";
import { renderLifeLayer } from "./three-life";
import { renderLightsLayer } from "./lights";
import { renderRubiksLayer } from "./rubiks";
import { renderSnakeLayer } from "./snake";
import { renderParticleLayer } from "./particle";

const CellularLaunchAtom: React.FC<EffectAtomRuntimeProps> = ({
  absoluteFrame,
  activationFrame,
  continuousEffectId,
  effectStartFrame,
  height,
  interactionFrame,
  isRunning,
  mode,
  modules,
  onPrimaryAction,
  resetToken,
  seed,
  simulationFrame,
  width,
}) => {
  const pulseFrame = simulationFrame ?? absoluteFrame;
  const {buttonOrigin, pulse} = getLaunchButtonState(pulseFrame);
  const clicked = interactionFrame !== undefined ? absoluteFrame >= interactionFrame : Boolean(isRunning);
  const ready = effectStartFrame !== undefined ? absoluteFrame >= effectStartFrame : Boolean(isRunning);
  const buttonScale = ready ? 0.94 : clicked ? pulse * 0.9 : pulse;
  const buttonLabel = ready ? "Simulation Running" : clicked ? "Booting Life Grid" : "Start Life Simulation";
  const renderContinuousLayer = () => {
    if (continuousEffectId === "snake-grid") {
      return renderSnakeLayer({
        absoluteFrame,
        activationFrame,
        height,
        isRunning,
        mode,
        modules,
        resetToken,
        seed,
        simulationFrame,
        width,
      });
    }

    if (continuousEffectId === "particle-orbit") {
      return renderParticleLayer({
        absoluteFrame,
        activationFrame,
        height,
        isRunning,
        mode,
        modules,
        resetToken,
        seed,
        simulationFrame,
        width,
      });
    }

    if (continuousEffectId === "donut-spin") {
      return renderDonutLayer({
        absoluteFrame,
        activationFrame,
        height,
        isRunning,
        mode,
        modules,
        resetToken,
        seed,
        simulationFrame,
        width,
      });
    }

    if (continuousEffectId === "lights-beams") {
      return renderLightsLayer({
        absoluteFrame,
        activationFrame,
        height,
        isRunning,
        mode,
        modules,
        resetToken,
        seed,
        simulationFrame,
        width,
      });
    }

    if (continuousEffectId === "rubiks-auto-solve") {
      return renderRubiksLayer({
        absoluteFrame,
        activationFrame,
        height,
        isRunning,
        mode,
        modules,
        resetToken,
        seed,
        simulationFrame,
        width,
      });
    }

    return renderLifeLayer({
      absoluteFrame,
      activationFrame,
      height,
      isRunning,
      mode,
      modules,
      resetToken,
      seed,
      simulationFrame,
      width,
    });
  };

  return (
    <>
      {ready ? (
        renderContinuousLayer()
      ) : (
        <div
          style={{
            ...baseLayerStyle,
            background: `radial-gradient(circle at ${buttonOrigin.x * 100}% ${buttonOrigin.y * 100}%, rgba(87,216,196,0.14) 0%, transparent 16%)`,
          }}
        />
      )}

      <button
        onClick={onPrimaryAction}
        style={{
          ...launchButtonBaseStyle,
          background: getLaunchButtonBackground(ready || clicked),
          transform: `translate(${(buttonOrigin.x - 0.5) * 110}px, ${(buttonOrigin.y - 0.5) * 110}px) scale(${buttonScale})`,
        }}
        type="button"
      >
        {buttonLabel}
      </button>
    </>
  );
};
export { CellularLaunchAtom };
