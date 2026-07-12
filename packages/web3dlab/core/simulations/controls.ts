import type { EffectControlDefinition } from "./types";

export const DONUT_EFFECT_CONTROLS: EffectControlDefinition[] = [
  { id: "donut-variant", kind: "select", label: "Variant", description: "Switch between graphite, luminous, and slow orbital ring moods.", section: "donutEffect", field: "variant", options: [ {label: "Graphite", value: "classic"}, {label: "Luminous", value: "arcade"}, {label: "Orbital", value: "cosmic"} ] },
  { id: "donut-ring-radius", kind: "range", label: "Ring Radius", description: "Controls the overall torus diameter.", section: "donutEffect", field: "ringRadius", min: 0.9, max: 2.4, step: 0.02 },
  { id: "donut-tube-radius", kind: "range", label: "Tube Radius", description: "Controls the thickness of the abstract ring body.", section: "donutEffect", field: "tubeRadius", min: 0.18, max: 0.8, step: 0.01 },
  { id: "donut-spin-speed", kind: "range", label: "Spin Speed", description: "Changes how fast the main ring spins.", section: "donutEffect", field: "spinSpeed", min: 0.3, max: 2.4, step: 0.02 },
  { id: "donut-orbit-speed", kind: "range", label: "Dust Orbit", description: "Controls how fast the surrounding light dust travels.", section: "donutEffect", field: "orbitSpeed", min: 0.2, max: 2.4, step: 0.02 },
  { id: "donut-wobble", kind: "range", label: "Surface Drift", description: "Adds subtle camera-friendly drift.", section: "donutEffect", field: "wobbleAmount", min: 0, max: 1, step: 0.01 },
  { id: "donut-glow", kind: "range", label: "Rim Glow", description: "Adjusts restrained bloom support.", section: "donutEffect", field: "glowIntensity", min: 0, max: 1.4, step: 0.02 }
];

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
