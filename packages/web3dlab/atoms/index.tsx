import React from "react";
import type { EffectAtomRuntimeProps } from "../core/simulations/types";
import type { EffectControlDefinition } from "../core/simulations/types";
import { baseLayerStyle, launchButtonBaseStyle, getLaunchButtonState, getLaunchButtonBackground, getAuroraBackground, getGridDriftBackground, getNoiseBloomBackground } from "./styles";
import type { EffectAtomDefinition, EffectAtomId } from "../core/simulations/types";
import { AuroraAtom, GridDriftAtom, NoiseBloomAtom } from "./backgrounds";
import { CellularLifeAtom, LIFE_EFFECT_CONTROLS } from "./three-life";
import { CellularLaunchAtom } from "./cellular-launch";
import { SnakeGridAtom, SNAKE_EFFECT_CONTROLS } from "./snake";
import { ParticleOrbitAtom, PARTICLE_EFFECT_CONTROLS } from "./particle";
import { DonutSpinAtom, DONUT_EFFECT_CONTROLS } from "./donut";
import { LightsLaunchAtom, LightsBeamsAtom, LIGHTS_EFFECT_CONTROLS } from "./lights";
import { RubiksLaunchAtom, RubiksAutoSolveAtom, RUBIKS_EFFECT_CONTROLS } from "./rubiks";
import type { VisualModuleConfig } from "@paper-to-video/shared-types";

export * from "./signature";

export const EFFECT_ATOMS: Record<EffectAtomId, EffectAtomDefinition> = {
  aurora: { id: "aurora", title: "Aurora Overlay", description: "...", Component: AuroraAtom },
  "grid-drift": { id: "grid-drift", title: "Grid Drift", description: "...", Component: GridDriftAtom },
  "noise-bloom": { id: "noise-bloom", title: "Noise Bloom", description: "...", Component: NoiseBloomAtom },
  "cellular-launch": { id: "cellular-launch", title: "Cellular Launch", description: "...", Component: CellularLaunchAtom, controls: LIFE_EFFECT_CONTROLS },
  "cellular-life": { id: "cellular-life", title: "Cellular Life", description: "...", Component: CellularLifeAtom, controls: LIFE_EFFECT_CONTROLS },
  "snake-grid": { id: "snake-grid", title: "Snake Grid", description: "...", Component: SnakeGridAtom, controls: SNAKE_EFFECT_CONTROLS },
  "particle-orbit": { id: "particle-orbit", title: "Particle Orbit", description: "...", Component: ParticleOrbitAtom, controls: PARTICLE_EFFECT_CONTROLS },
  "donut-spin": { id: "donut-spin", title: "Donut Spin", description: "...", Component: DonutSpinAtom, controls: DONUT_EFFECT_CONTROLS },
  "lights-launch": { id: "lights-launch", title: "Lights Launch", description: "...", Component: LightsLaunchAtom, controls: LIGHTS_EFFECT_CONTROLS },
  "lights-beams": { id: "lights-beams", title: "Lights Beams", description: "...", Component: LightsBeamsAtom, controls: LIGHTS_EFFECT_CONTROLS },
  "rubiks-launch": { id: "rubiks-launch", title: "Rubiks Launch", description: "...", Component: RubiksLaunchAtom, controls: RUBIKS_EFFECT_CONTROLS },
  "rubiks-auto-solve": { id: "rubiks-auto-solve", title: "Rubiks Auto Solve", description: "...", Component: RubiksAutoSolveAtom, controls: RUBIKS_EFFECT_CONTROLS },
};

export const getEffectAtomDefinition = (effectId: EffectAtomId) => EFFECT_ATOMS[effectId];

export const createModuleOverride = ({ baseModules, control, value }: { baseModules?: VisualModuleConfig; control: EffectControlDefinition; value: number | string; }) => {
  const section = { ...(baseModules?.[control.section] ?? {}), [control.field]: value };
  return { ...(baseModules ?? {}), [control.section]: section } as VisualModuleConfig;
};
