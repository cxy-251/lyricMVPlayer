import type { EffectControlDefinition } from "./types";

export const LIFE_EFFECT_CONTROLS: EffectControlDefinition[] = [
  { id: "life-primary-hue", kind: "range", label: "Primary Hue", description: "Controls the hue of the main live cells.", section: "cellularEffect", field: "primaryHue", min: 0, max: 360, step: 1 },
  { id: "life-primary-light", kind: "range", label: "Primary Lightness", description: "Controls the brightness of the main live cells.", section: "cellularEffect", field: "primaryLightness", min: 0, max: 100, step: 1 },
  { id: "life-secondary-hue", kind: "range", label: "Secondary Hue", description: "Controls the hue of the older cells / secondary tone.", section: "cellularEffect", field: "secondaryHue", min: 0, max: 360, step: 1 },
  { id: "life-secondary-light", kind: "range", label: "Secondary Lightness", description: "Controls the brightness of the secondary cells.", section: "cellularEffect", field: "secondaryLightness", min: 0, max: 100, step: 1 },
  { id: "life-birth-hue", kind: "range", label: "Birth Hue", description: "Controls the hue of freshly born cells.", section: "cellularEffect", field: "birthHue", min: 0, max: 360, step: 1 },
  { id: "life-birth-light", kind: "range", label: "Birth Lightness", description: "Controls the brightness of freshly born cells.", section: "cellularEffect", field: "birthLightness", min: 0, max: 100, step: 1 },
  { id: "life-scale", kind: "range", label: "Cell Scale", description: "Increase or decrease the apparent block size.", section: "cellularEffect", field: "cellScale", min: 0.55, max: 1.55, step: 0.05 },
  { id: "life-speed", kind: "range", label: "Step Interval", description: "Lower values make the life simulation evolve faster.", section: "cellularEffect", field: "stepEveryFrames", min: 1, max: 8, step: 1 }
];

export const PARTICLE_EFFECT_CONTROLS: EffectControlDefinition[] = [
  { id: "particle-variant", kind: "select", label: "Variant", description: "Treat one particle family as multiple effect presets.", section: "particleEffect", field: "variant", options: [ {label: "Nebula", value: "nebula"}, {label: "Vortex", value: "vortex"}, {label: "Comet", value: "comet"} ] },
  { id: "particle-shape", kind: "select", label: "Particle Shape", description: "Switch the primitive shape used by the particle field.", section: "particleEffect", field: "shape", options: [ {label: "Circle", value: "circle"}, {label: "Square", value: "square"}, {label: "Diamond", value: "diamond"} ] },
  { id: "particle-distribution", kind: "select", label: "Distribution", description: "Controls whether particles cluster.", section: "particleEffect", field: "distribution", options: [ {label: "Core", value: "core"}, {label: "Spiral", value: "spiral"}, {label: "Halo", value: "halo"} ] },
  { id: "particle-trajectory", kind: "select", label: "Trajectory", description: "Choose how particles move through space.", section: "particleEffect", field: "trajectory", options: [ {label: "Orbit", value: "orbit"}, {label: "Drift", value: "drift"}, {label: "Wave", value: "wave"} ] },
  { id: "particle-count", kind: "range", label: "Particle Count", description: "Higher values add richness.", section: "particleEffect", field: "particleCount", min: 120, max: 1200, step: 20 },
  { id: "particle-size", kind: "range", label: "Point Size", description: "Bigger points feel softer.", section: "particleEffect", field: "pointSize", min: 1.2, max: 12, step: 0.2 },
  { id: "particle-radius", kind: "range", label: "Orbit Radius", description: "Controls how much of the stage the particle mass occupies.", section: "particleEffect", field: "orbitRadius", min: 0.08, max: 0.8, step: 0.01 }
];

export const DONUT_EFFECT_CONTROLS: EffectControlDefinition[] = [
  { id: "donut-variant", kind: "select", label: "Variant", description: "Switch between cleaner glossy, brighter arcade, and slower cosmic donut moods.", section: "donutEffect", field: "variant", options: [ {label: "Classic", value: "classic"}, {label: "Arcade", value: "arcade"}, {label: "Cosmic", value: "cosmic"} ] },
  { id: "donut-ring-radius", kind: "range", label: "Ring Radius", description: "Controls the overall diameter.", section: "donutEffect", field: "ringRadius", min: 0.9, max: 2.4, step: 0.02 },
  { id: "donut-tube-radius", kind: "range", label: "Tube Radius", description: "Controls how thick and edible the donut body feels.", section: "donutEffect", field: "tubeRadius", min: 0.18, max: 0.8, step: 0.01 },
  { id: "donut-spin-speed", kind: "range", label: "Spin Speed", description: "Changes how fast the main donut spins.", section: "donutEffect", field: "spinSpeed", min: 0.3, max: 2.4, step: 0.02 },
  { id: "donut-orbit-speed", kind: "range", label: "Pearl Orbit", description: "Controls how fast the small orbiting pearls travel.", section: "donutEffect", field: "orbitSpeed", min: 0.2, max: 2.4, step: 0.02 },
  { id: "donut-wobble", kind: "range", label: "Wobble", description: "Adds camera-friendly wobble.", section: "donutEffect", field: "wobbleAmount", min: 0, max: 1, step: 0.01 },
  { id: "donut-glow", kind: "range", label: "Glow", description: "Adjusts bloom support.", section: "donutEffect", field: "glowIntensity", min: 0, max: 1.4, step: 0.02 }
];

export const LIGHTS_EFFECT_CONTROLS: EffectControlDefinition[] = [
  { id: "lights-variant", kind: "select", label: "Variant", description: "Switch between tighter pulses, fan-like spreads, and fuller bloom compositions.", section: "lightsEffect", field: "variant", options: [ {label: "Pulse", value: "pulse"}, {label: "Fan", value: "fan"}, {label: "Bloom", value: "bloom"} ] },
  { id: "lights-count", kind: "range", label: "Beam Count", description: "Higher counts create denser light clusters.", section: "lightsEffect", field: "beamCount", min: 8, max: 48, step: 1 },
  { id: "lights-length", kind: "range", label: "Beam Length", description: "Controls how far each light strip reaches.", section: "lightsEffect", field: "beamLength", min: 0.18, max: 0.72, step: 0.01 },
  { id: "lights-thickness", kind: "range", label: "Beam Thickness", description: "Use this to move between razor-thin streaks and chunkier light bars.", section: "lightsEffect", field: "beamThickness", min: 0.018, max: 0.16, step: 0.002 },
  { id: "lights-radius", kind: "range", label: "Orbit Radius", description: "Controls how tightly the light choreography stays around the center.", section: "lightsEffect", field: "orbitRadius", min: 0.08, max: 0.42, step: 0.01 },
  { id: "lights-speed", kind: "range", label: "Motion Speed", description: "Lower values feel more ambient.", section: "lightsEffect", field: "motionSpeed", min: 0.004, max: 0.04, step: 0.001 },
  { id: "lights-spread", kind: "range", label: "Spread", description: "Controls how wide the beams fan outward.", section: "lightsEffect", field: "spread", min: 0.2, max: 0.95, step: 0.01 }
];

export const RUBIKS_EFFECT_CONTROLS: EffectControlDefinition[] = [
  { id: "rubiks-turn-frames", kind: "range", label: "Turn Frames", description: "Controls how long each face turn takes.", section: "rubiksEffect", field: "turnFrames", min: 6, max: 24, step: 1 },
  { id: "rubiks-hold-frames", kind: "range", label: "Hold Frames", description: "Adds a small pause between turns.", section: "rubiksEffect", field: "holdFrames", min: 0, max: 16, step: 1 },
  { id: "rubiks-scale", kind: "range", label: "Cube Scale", description: "Scales the cube up or down.", section: "rubiksEffect", field: "cubeScale", min: 0.7, max: 1.5, step: 0.01 },
  { id: "rubiks-gap", kind: "range", label: "Cubie Gap", description: "Controls the spacing between cubelets.", section: "rubiksEffect", field: "cubieGap", min: 0.02, max: 0.24, step: 0.01 },
  { id: "rubiks-drift", kind: "range", label: "Camera Drift", description: "Controls the amount of gentle camera-like sway.", section: "rubiksEffect", field: "cameraDrift", min: 0, max: 0.32, step: 0.01 }
];

export const SNAKE_EFFECT_CONTROLS: EffectControlDefinition[] = [
  { id: "snake-strategy", kind: "select", label: "Routing Mode", description: "Choose between the smarter survival-first route and the deterministic fallback.", section: "cellularEffect", field: "snakeStrategy", options: [ {label: "Survival Chase", value: "survival-chase"}, {label: "Row Sweep", value: "row-sweep"}, {label: "Safe Loop", value: "safe-loop"} ] },
  { id: "snake-primary-hue", kind: "range", label: "Primary Hue", description: "Controls the hue of the main snake.", section: "cellularEffect", field: "primaryHue", min: 0, max: 360, step: 1 },
  { id: "snake-primary-light", kind: "range", label: "Primary Lightness", description: "Controls the brightness of the main snake.", section: "cellularEffect", field: "primaryLightness", min: 0, max: 100, step: 1 },
  { id: "snake-secondary-hue", kind: "range", label: "Secondary Hue", description: "Controls the hue of the head.", section: "cellularEffect", field: "secondaryHue", min: 0, max: 360, step: 1 },
  { id: "snake-secondary-light", kind: "range", label: "Secondary Lightness", description: "Controls the brightness of the head.", section: "cellularEffect", field: "secondaryLightness", min: 0, max: 100, step: 1 },
  { id: "snake-birth-hue", kind: "range", label: "Food Hue", description: "Controls the hue of the food.", section: "cellularEffect", field: "birthHue", min: 0, max: 360, step: 1 },
  { id: "snake-birth-light", kind: "range", label: "Food Lightness", description: "Controls the brightness of the food.", section: "cellularEffect", field: "birthLightness", min: 0, max: 100, step: 1 },
  { id: "snake-scale", kind: "range", label: "Block Scale", description: "Adjust how large each visible snake block feels.", section: "cellularEffect", field: "cellScale", min: 0.55, max: 1.55, step: 0.05 },
  { id: "snake-speed", kind: "range", label: "Move Interval", description: "Lower values make the snake advance more frequently.", section: "cellularEffect", field: "stepEveryFrames", min: 1, max: 8, step: 1 },
  { id: "snake-food-count", kind: "range", label: "Food Count", description: "Controls how many food blocks stay active.", section: "cellularEffect", field: "foodCount", min: 1, max: 64, step: 1 }
];
