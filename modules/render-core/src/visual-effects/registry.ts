import type {
  FluidCursorFieldConfig,
  NeonEnergyTunnelConfig,
  ParticleGalaxyConfig,
  ParticleMorphingFieldConfig,
  PhysicsClothBannerConfig,
  VisualEffectConfigMap,
  VisualEffectId,
  VisualEffectScene,
} from "./types";
import {DEFAULT_PARTICLE_GALAXY_CONFIG, ParticleGalaxyScene} from "./core/particle-galaxy";
import {
  DEFAULT_FLUID_CURSOR_FIELD_CONFIG,
  FluidCursorFieldScene,
} from "./core/fluid-cursor-field";
import {
  DEFAULT_NEON_ENERGY_TUNNEL_CONFIG,
  NeonEnergyTunnelScene,
} from "./core/neon-energy-tunnel";
import {
  DEFAULT_PARTICLE_MORPHING_FIELD_CONFIG,
  ParticleMorphingFieldScene,
} from "./core/particle-morphing-field";
import {
  DEFAULT_PHYSICS_CLOTH_BANNER_CONFIG,
  PhysicsClothBannerScene,
} from "./core/physics-cloth-banner";

export type VisualEffectDefinition<TId extends VisualEffectId = VisualEffectId> = {
  id: TId;
  title: string;
  description: string;
  tags: string[];
  defaultConfig: VisualEffectConfigMap[TId];
  createScene: (input: {
    config: VisualEffectConfigMap[TId];
    seed?: number;
  }) => VisualEffectScene<VisualEffectConfigMap[TId]>;
};

type VisualEffectRegistry = {
  [TId in VisualEffectId]: VisualEffectDefinition<TId>;
};

export const visualEffectRegistry = {
  "particle-galaxy": {
    id: "particle-galaxy",
    title: "Particle Galaxy",
    description: "Shader particles swirl into a deep responsive galactic field.",
    tags: ["particles", "shader", "interactive", "web3d"],
    defaultConfig: DEFAULT_PARTICLE_GALAXY_CONFIG,
    createScene: ({config, seed}: {config: ParticleGalaxyConfig; seed?: number}) =>
      new ParticleGalaxyScene({config, seed}),
  },
  "neon-energy-tunnel": {
    id: "neon-energy-tunnel",
    title: "Neon Energy Tunnel",
    description: "A procedural sci-fi corridor of glowing rings, electric guide lines, and speed streaks.",
    tags: ["tunnel", "neon", "motion", "procedural"],
    defaultConfig: DEFAULT_NEON_ENERGY_TUNNEL_CONFIG,
    createScene: ({config, seed}: {config: NeonEnergyTunnelConfig; seed?: number}) =>
      new NeonEnergyTunnelScene({config, seed}),
  },
  "fluid-cursor-field": {
    id: "fluid-cursor-field",
    title: "Fluid Cursor Field",
    description: "A shader field where pointer motion stirs glowing ripples, soft trails, and liquid distortion.",
    tags: ["fluid", "shader", "cursor", "distortion"],
    defaultConfig: DEFAULT_FLUID_CURSOR_FIELD_CONFIG,
    createScene: ({config, seed}: {config: FluidCursorFieldConfig; seed?: number}) =>
      new FluidCursorFieldScene({config, seed}),
  },
  "physics-cloth-banner": {
    id: "physics-cloth-banner",
    title: "Physics Cloth Banner",
    description: "A pinned holographic fabric panel with Verlet cloth motion, procedural wind, and pointer ripples.",
    tags: ["cloth", "physics", "hologram", "soft-body"],
    defaultConfig: DEFAULT_PHYSICS_CLOTH_BANNER_CONFIG,
    createScene: ({config, seed}: {config: PhysicsClothBannerConfig; seed?: number}) =>
      new PhysicsClothBannerScene({config, seed}),
  },
  "particle-morphing-field": {
    id: "particle-morphing-field",
    title: "Particle Morphing Field",
    description: "A GPU-style particle sculpture that morphs between a sphere, torus, spiral galaxy, and wave grid.",
    tags: ["particles", "morphing", "shader", "generative"],
    defaultConfig: DEFAULT_PARTICLE_MORPHING_FIELD_CONFIG,
    createScene: ({config, seed}: {config: ParticleMorphingFieldConfig; seed?: number}) =>
      new ParticleMorphingFieldScene({config, seed}),
  },
} satisfies VisualEffectRegistry;

export const getVisualEffectDefinition = <TId extends VisualEffectId>(id: TId): VisualEffectDefinition<TId> =>
  visualEffectRegistry[id] as unknown as VisualEffectDefinition<TId>;
