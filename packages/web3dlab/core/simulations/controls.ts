import type { EffectControlDefinition } from "./types";

// The former Donut Spin controls targeted a removed surface/particle implementation.
// Torus Dynamics is configured inside Demo 019, so the legacy Paper atom exposes no inert controls.
export const DONUT_EFFECT_CONTROLS: EffectControlDefinition[] = [];

export const LIGHTS_EFFECT_CONTROLS: EffectControlDefinition[] = [
  { id: "lights-variant", kind: "select", label: "Wave Style", description: "Switch between calm, swell, and crossed-wave reference moods.", section: "lightsEffect", field: "variant", options: [ {label: "Calm", value: "pulse"}, {label: "Swell", value: "fan"}, {label: "Cross Wave", value: "bloom"} ] },
  { id: "lights-count", kind: "range", label: "Sample Density", description: "Controls the density of the water reference sampling.", section: "lightsEffect", field: "beamCount", min: 8, max: 48, step: 1 },
  { id: "lights-length", kind: "range", label: "Wave Amplitude", description: "Controls the visible rise and fall of the surface.", section: "lightsEffect", field: "beamLength", min: 0.18, max: 0.72, step: 0.01 },
  { id: "lights-thickness", kind: "range", label: "Surface Detail", description: "Adds smaller ripples on top of the main wave.", section: "lightsEffect", field: "beamThickness", min: 0.018, max: 0.16, step: 0.002 },
  { id: "lights-radius", kind: "range", label: "Float Radius", description: "Controls the reference float scale in legacy compositions.", section: "lightsEffect", field: "orbitRadius", min: 0.08, max: 0.42, step: 0.01 },
  { id: "lights-speed", kind: "range", label: "Wave Speed", description: "Lower values make the water move more slowly.", section: "lightsEffect", field: "motionSpeed", min: 0.004, max: 0.04, step: 0.001 },
  { id: "lights-spread", kind: "range", label: "Wave Spread", description: "Controls how broad the wave field feels.", section: "lightsEffect", field: "spread", min: 0.2, max: 0.95, step: 0.01 }
];

export const RUBIKS_EFFECT_CONTROLS: EffectControlDefinition[] = [
  { id: "rubiks-turn-frames", kind: "range", label: "Turn Frames", description: "Controls how long each face turn takes.", section: "rubiksEffect", field: "turnFrames", min: 6, max: 24, step: 1 },
  { id: "rubiks-hold-frames", kind: "range", label: "Hold Frames", description: "Adds a small pause between turns.", section: "rubiksEffect", field: "holdFrames", min: 0, max: 16, step: 1 },
  { id: "rubiks-scale", kind: "range", label: "Cube Scale", description: "Scales the cube up or down.", section: "rubiksEffect", field: "cubeScale", min: 0.7, max: 1.5, step: 0.01 },
  { id: "rubiks-gap", kind: "range", label: "Cubie Gap", description: "Controls the spacing between cubelets.", section: "rubiksEffect", field: "cubieGap", min: 0.02, max: 0.24, step: 0.01 },
];
