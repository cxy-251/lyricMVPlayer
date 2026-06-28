import type {EffectBlendMode, RecipeLayer, VisualEffectRecipe} from "./types";
import {IDENTITY_LAYER_TRANSFORM} from "./types";

const layer = (
  id: string,
  atomId: string,
  options: {
    config?: Record<string, unknown>;
    opacity?: number;
    blendMode?: EffectBlendMode;
    scale?: number;
    x?: number;
    y?: number;
    inputEnabled?: boolean;
  } = {},
): RecipeLayer => ({
  id,
  atomId,
  config: options.config ?? {},
  opacity: options.opacity ?? 1,
  blendMode: options.blendMode ?? "normal",
  transform: {...IDENTITY_LAYER_TRANSFORM, x: options.x ?? 0, y: options.y ?? 0, scale: options.scale ?? 1},
  inputEnabled: options.inputEnabled ?? false,
  visible: true,
});

const recipe = (
  id: string,
  title: string,
  description: string,
  source: VisualEffectRecipe["source"],
  layers: RecipeLayer[],
): VisualEffectRecipe => ({id, title, description, source, layers});

export const web3dRecipes: VisualEffectRecipe[] = [
  recipe("web3d/blender-fibonacci", "Blender Fibonacci", "Fibonacci structure with a restrained stellar depth layer.", "web3d", [layer("stars", "ambient-stars", {opacity: 0.46, blendMode: "screen"}), layer("orb", "fibonacci-orb", {inputEnabled: true})]),
  recipe("web3d/gpgpu-black-hole", "GPGPU Black Hole", "Accretion particles orbit a clean event horizon with restrained lensing.", "web3d", [layer("stars", "ambient-stars", {opacity: 0.28, blendMode: "screen"}), layer("lens", "fluid-surface", {config: {distortionStrength: 0.65, glowStrength: 0.5}, opacity: 0.1, blendMode: "screen", scale: 1.08}), layer("disk", "black-hole-disk", {config: {intensity: 0.82, scale: 0.82}, opacity: 0.72, blendMode: "add", inputEnabled: true}), layer("core", "black-hole-core", {scale: 0.28})]),
  recipe("web3d/liquid-metal", "Liquid Metal", "A contained deforming chrome body with a readable silhouette.", "web3d", [layer("stars", "ambient-stars", {opacity: 0.14}), layer("metal", "liquid-metal-surface", {config: {primary: "#243044", secondary: "#dbe9ff", speed: 0.52, intensity: 1.02, scale: 0.9}, inputEnabled: true})]),
  recipe("web3d/cyber-city", "Cyber City", "A multicolor procedural skyline with rooftop lights, grid depth and controlled speed accents.", "web3d", [layer("city", "cyber-city", {config: {speed: 0.3, intensity: 1.32, scale: 0.96}, inputEnabled: true}), layer("traffic", "energy-streaks", {opacity: 0.18, blendMode: "add", scale: 0.78})]),
  recipe("web3d/quantum-network", "Quantum Network", "A readable neural core with independent links and traveling pulse nodes.", "web3d", [layer("links", "quantum-links", {config: {scale: 1.28, intensity: 1.45}, opacity: 0.96, inputEnabled: true}), layer("points", "quantum-points", {config: {density: 0.72, scale: 1.2, intensity: 1.34}, opacity: 0.78, blendMode: "add", inputEnabled: true})]),
  recipe("web3d/cosmic-nebula", "Cosmic Nebula", "A dense colored nebula with a quiet outer star field.", "web3d", [layer("stars", "ambient-stars", {opacity: 0.35}), layer("nebula", "cosmic-nebula", {opacity: 0.92, blendMode: "screen"})]),
  recipe("web3d/particle-galaxy", "Particle Galaxy Web3D", "Five shader-driven spiral arms with a hot core and stronger interaction.", "web3d", [layer("stars", "ambient-stars", {opacity: 0.2}), layer("galaxy", "galaxy-particles", {config: {particleCount: 42000, particleSize: 1.18, rotationSpeed: 0.2, interactionStrength: 1.05, glowStrength: 1.18, audioReactivity: 0.8}, blendMode: "add", inputEnabled: true})]),
  recipe("web3d/neon-energy-tunnel", "Neon Energy Tunnel Web3D", "A complete tunnel scene with rings, radial lattice and speed streaks in one isolated layer.", "web3d", [layer("tunnel", "neon-tunnel", {config: {travelSpeed: 4.2, tunnelRadius: 2.15, segmentCount: 72, glowStrength: 1.25, distortionStrength: 0.72, particleDensity: 820, audioReactivity: 0.75}, inputEnabled: true})]),
  recipe("web3d/fluid-cursor-field", "Fluid Cursor Field Web3D", "A full-frame pointer fluid with persistent ripple impulses and a luminous grid.", "web3d", [layer("fluid", "fluid-surface", {config: {distortionStrength: 1.2, trailPersistence: 0.78, rippleRadius: 0.105, fluidDecay: 0.74, backgroundScale: 2.2, glowStrength: 1.2, audioReactivity: 0.8}, inputEnabled: true})]),
  recipe("web3d/physics-cloth-banner", "Physics Cloth Banner Web3D", "A pinned fabric surface with wind, ripples and independently composited border particles.", "web3d", [layer("cloth", "cloth-surface", {config: {windStrength: 0.9, clothResolution: 36, interactionRadius: 0.62, interactionStrength: 1.2, glowStrength: 1.15, audioReactivity: 0.55}, inputEnabled: true}), layer("edge", "edge-particles", {opacity: 0.52, blendMode: "add"})]),
  recipe("web3d/particle-morphing-field", "Particle Morphing Field Web3D", "A four-state particle sculpture cycling through sphere, torus, spiral and wave grid.", "web3d", [layer("stars", "ambient-stars", {opacity: 0.18}), layer("morph", "morph-particles", {config: {particleCount: 22000, particleSize: 1.1, morphSpeed: 0.52, turbulenceStrength: 0.48, interactionStrength: 0.82, glowStrength: 1.05, audioReactivity: 0.65}, blendMode: "add", inputEnabled: true})]),
  recipe("web3d/liquid-metaballs", "Liquid Metaballs", "A reflective shader metaball composition with pointer-directed motion.", "web3d", [layer("stars", "ambient-stars", {opacity: 0.12}), layer("metaballs", "metaball-surface", {config: {speed: 0.62, intensity: 1.38, scale: 1.18}, blendMode: "screen", inputEnabled: true})]),
  recipe("web3d/text-morphing", "Text Morphing", "Particles explode and reform into a bright dedicated LYRIC glyph target.", "web3d", [layer("glyphs", "text-glyph-particles", {config: {density: 0.96, speed: 0.76, intensity: 1.18, scale: 1.04, audioReactivity: 0.52}, blendMode: "add", inputEnabled: true}), layer("edge", "edge-particles", {opacity: 0.18})]),
  recipe("web3d/physics-sandbox", "Physics Sandbox", "Deterministic frame-addressable colored blocks orbit a reactive hero object above a luminous floor.", "web3d", [layer("stars", "ambient-stars", {opacity: 0.16}), layer("blocks", "physics-blocks", {config: {speed: 0.58, intensity: 1.28, scale: 0.9, audioReactivity: 0.7}, inputEnabled: true})]),
  recipe("web3d/audio-metaballs", "Audio Metaballs", "Reflective metaballs driven by the selected lyric song.", "web3d", [layer("stars", "ambient-stars", {opacity: 0.18}), layer("metaballs", "audio-metaball-surface", {config: {speed: 0.64, intensity: 1.42, scale: 1.18, audioReactivity: 1.35}, blendMode: "screen", inputEnabled: true})]),
  recipe("web3d/boids-flocking", "Boids Flocking", "A coherent flock with stable seeded membership.", "web3d", [layer("stars", "ambient-stars", {opacity: 0.1}), layer("boids", "boids-field", {config: {intensity: 1.35, scale: 1.18}, blendMode: "add", inputEnabled: true})]),
  recipe("web3d/audio-ferrofluid", "Audio Ferrofluid", "A reflective ferrofluid body whose spikes follow the selected lyric song.", "web3d", [layer("stars", "ambient-stars", {opacity: 0.16}), layer("ferrofluid", "audio-ferrofluid-surface", {config: {speed: 0.48, intensity: 1.48, scale: 1.12, audioReactivity: 1.35}, blendMode: "screen", inputEnabled: true})]),
  recipe("web3d/ultimate-convergence", "Ultimate Convergence", "A composition assembled from reusable black-hole, fluid, ferrofluid and streak atoms.", "web3d", [layer("stars", "ambient-stars", {opacity: 0.28}), layer("fluid", "fluid-surface", {opacity: 0.18, blendMode: "screen", scale: 1.12, inputEnabled: true}), layer("disk", "black-hole-disk", {config: {intensity: 0.76, scale: 0.8}, opacity: 0.62, blendMode: "add", scale: 0.9}), layer("core", "black-hole-core", {scale: 0.22}), layer("ferro", "audio-ferrofluid-surface", {opacity: 0.28, blendMode: "screen", scale: 0.48, x: 0.22, y: -0.08}), layer("streaks", "energy-streaks", {opacity: 0.3, blendMode: "add"})]),
];

export const lyricRecipes: VisualEffectRecipe[] = [
  recipe("lyric/particle-galaxy", "Particle Galaxy Lyric", "A complete five-arm lyric galaxy with direct pointer response and song-driven energy.", "lyric", [layer("galaxy", "galaxy-particles", {config: {particleCount: 36000, particleSize: 1.08, rotationSpeed: 0.15, interactionStrength: 1.28, glowStrength: 1.08, audioReactivity: 0.72}, opacity: 0.9, blendMode: "screen", inputEnabled: true})]),
  recipe("lyric/neon-energy-tunnel", "Neon Energy Tunnel Lyric", "A centered ring, lattice and streak tunnel with pointer-directed travel.", "lyric", [layer("tunnel", "neon-tunnel", {config: {travelSpeed: 3.8, tunnelRadius: 2.05, segmentCount: 68, glowStrength: 1.18, distortionStrength: 0.78, particleDensity: 680, audioReactivity: 0.72}, opacity: 0.9, inputEnabled: true})]),
  recipe("lyric/fluid-cursor-field", "Fluid Cursor Field Lyric", "A responsive ripple-grid field that follows pointer movement and song impulses.", "lyric", [layer("fluid", "fluid-surface", {config: {distortionStrength: 1.18, trailPersistence: 0.78, rippleRadius: 0.12, fluidDecay: 0.76, backgroundScale: 2.15, glowStrength: 1.08, audioReactivity: 0.68}, opacity: 0.94, inputEnabled: true})]),
  recipe("lyric/physics-cloth-banner", "Physics Cloth Banner Lyric", "A pinned luminous fabric with visible pointer ripples and edge sparks.", "lyric", [layer("cloth", "cloth-surface", {config: {windStrength: 0.9, clothResolution: 34, interactionRadius: 0.68, interactionStrength: 1.35, glowStrength: 1.08, audioReactivity: 0.58}, opacity: 0.9, inputEnabled: true}), layer("edge", "edge-particles", {config: {intensity: 0.82}, opacity: 0.42, blendMode: "add"})]),
  recipe("lyric/particle-morphing-field", "Particle Morphing Field Lyric", "A vivid four-shape morph cycle with direct pointer repulsion and audio response.", "lyric", [layer("morph", "morph-particles", {config: {particleCount: 19000, particleSize: 1.12, morphSpeed: 0.42, turbulenceStrength: 0.4, interactionStrength: 1.12, glowStrength: 1.08, audioReactivity: 0.62}, opacity: 0.86, blendMode: "screen", inputEnabled: true})]),
];

export const visualEffectRecipes = [...web3dRecipes, ...lyricRecipes];
export const visualEffectRecipeMap = new Map(visualEffectRecipes.map((item) => [item.id, item]));

export const getVisualEffectRecipe = (id: string) => {
  const found = visualEffectRecipeMap.get(id);
  if (!found) throw new Error(`Unknown visual effect recipe: ${id}`);
  return found;
};
