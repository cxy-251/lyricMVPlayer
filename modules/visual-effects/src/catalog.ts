import type {VisualEffectAtom} from "./types";
import {createGeometryAtom} from "./atoms/geometry";
import {createParticleAtom} from "./atoms/particles";
import {createSurfaceAtom} from "./atoms/surfaces";
import type {ProceduralEffectConfig} from "./atoms/config";
import {
  signatureClothAtom,
  signatureFluidAtom,
  signatureGalaxyAtom,
  signatureMorphAtom,
  signatureTunnelAtom,
} from "./atoms/signature";
import {createBoidsAtom, createTextGlyphAtom} from "./atoms/advanced";

const config = (
  primary: string,
  secondary: string,
  density: number,
  speed: number,
  intensity: number,
  scale: number,
  audioReactivity = 0,
): ProceduralEffectConfig => ({primary, secondary, density, speed, intensity, scale, audioReactivity});

const definitions: Array<VisualEffectAtom<ProceduralEffectConfig>> = [
  createParticleAtom({id: "ambient-stars", title: "Ambient Stars", description: "A restrained deterministic star layer.", layout: "stars", baseCount: 5200, defaults: config("#7dd9ff", "#ffffff", 0.72, 0.2, 0.72, 1)}),
  signatureGalaxyAtom as unknown as VisualEffectAtom<ProceduralEffectConfig>,
  createParticleAtom({id: "black-hole-disk", title: "Black Hole Disk", description: "A compact accretion disk with differential rotation.", layout: "black-hole", baseCount: 30000, defaults: config("#fff0b0", "#ff532f", 1, 0.68, 1.42, 1), audio: true, pointer: true}),
  createParticleAtom({id: "cosmic-nebula", title: "Cosmic Nebula", description: "A layered volumetric particle cloud.", layout: "nebula", baseCount: 32000, defaults: config("#ff6bd5", "#5d7bff", 1, 0.22, 1.18, 1.08), audio: true}),
  createParticleAtom({id: "quantum-points", title: "Quantum Points", description: "Pulsing nodes for network compositions.", layout: "network", baseCount: 900, defaults: config("#8ffcff", "#8b5dff", 0.72, 0.58, 1.15, 1), audio: true, pointer: true}),
  signatureMorphAtom as unknown as VisualEffectAtom<ProceduralEffectConfig>,
  createBoidsAtom(config("#b4ffef", "#70a6ff", 0.88, 0.72, 1.08, 0.94, 0.7)),
  createTextGlyphAtom(config("#f5fbff", "#45eaff", 0.96, 0.76, 1.18, 1.04, 0.52)),
  createParticleAtom({id: "energy-streaks", title: "Energy Streaks", description: "Depth-driven streaks for tunnels and high-speed scenes.", layout: "streaks", baseCount: 7200, defaults: config("#67f5ff", "#e86cff", 0.8, 0.92, 1.28, 1), audio: true, pointer: true}),
  createParticleAtom({id: "edge-particles", title: "Edge Particles", description: "A contained border particle layer.", layout: "edge", baseCount: 2400, defaults: config("#79f3ff", "#ffffff", 0.8, 0.55, 0.9, 1), audio: true}),
  signatureFluidAtom as unknown as VisualEffectAtom<ProceduralEffectConfig>,
  createSurfaceAtom({id: "liquid-metal-surface", title: "Liquid Metal", description: "A defined reflective metal body with controlled deformation.", kind: "liquid-metal", defaults: config("#71819b", "#ecf6ff", 1, 0.62, 1.25, 0.94), audio: true, pointer: true}),
  createSurfaceAtom({id: "metaball-surface", title: "Liquid Metaballs", description: "Seven smoothly merged reflective shader bodies.", kind: "metaballs", defaults: config("#ff3f9e", "#4fe9ff", 1, 0.62, 1.38, 1.18), pointer: true}),
  createSurfaceAtom({id: "audio-metaball-surface", title: "Audio Metaballs", description: "Reflective metaballs driven by real song features.", kind: "audio-metaballs", defaults: config("#3971ff", "#63fff4", 1, 0.64, 1.42, 1.18, 1.35), audio: true, pointer: true}),
  createSurfaceAtom({id: "audio-ferrofluid-surface", title: "Audio Ferrofluid", description: "A song-reactive reflective ferrofluid body with beat-defined spikes.", kind: "ferrofluid", defaults: config("#3213a8", "#67fff5", 1, 0.48, 1.48, 1.12, 1.35), audio: true, pointer: true}),
  createSurfaceAtom({id: "black-hole-core", title: "Black Hole Core", description: "An opaque event horizon with a narrow photon ring.", kind: "black-hole-core", defaults: config("#ffb347", "#ff4f21", 1, 0.34, 1.05, 1), audio: true}),
  createGeometryAtom({id: "fibonacci-orb", title: "Fibonacci Orb", description: "An instanced golden-angle sphere with clear depth.", kind: "fibonacci", defaults: config("#f0c86e", "#fff1b8", 1, 0.38, 0.82, 0.9), audio: true, pointer: true}),
  createGeometryAtom({id: "cyber-city", title: "Cyber City", description: "A deterministic multicolor skyline with rooftop lights and a luminous grid.", kind: "city", defaults: config("#4a658f", "#20e7ff", 1, 0.3, 1.32, 0.96), audio: true, pointer: true}),
  signatureTunnelAtom as unknown as VisualEffectAtom<ProceduralEffectConfig>,
  createGeometryAtom({id: "quantum-links", title: "Quantum Links", description: "Isolated nodes and links with deterministic connectivity.", kind: "network", defaults: config("#d4ffff", "#5acfff", 1, 0.42, 1.08, 1), audio: true, pointer: true}),
  signatureClothAtom as unknown as VisualEffectAtom<ProceduralEffectConfig>,
  createGeometryAtom({id: "physics-blocks", title: "Physics Blocks", description: "A deterministic fixed-frame field of colored blocks around a reactive hero object.", kind: "physics", defaults: config("#ffffff", "#56dfff", 1, 0.58, 1.28, 0.9, 0.7), audio: true, pointer: true}),
];

export const visualEffectAtoms = definitions as unknown as VisualEffectAtom[];
export const visualEffectAtomMap = new Map(visualEffectAtoms.map((atom) => [atom.id, atom]));

export const getVisualEffectAtom = (id: string) => {
  const atom = visualEffectAtomMap.get(id);
  if (!atom) throw new Error(`Unknown visual effect atom: ${id}`);
  return atom;
};
