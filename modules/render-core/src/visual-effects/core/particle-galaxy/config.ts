import type {ParticleGalaxyConfig} from "../../types";

export const PARTICLE_GALAXY_LIMITS = {
  minParticles: 8000,
  maxParticles: 60000,
  particleStep: 500,
} as const;

export const DEFAULT_PARTICLE_GALAXY_CONFIG: ParticleGalaxyConfig = {
  particleCount: 32000,
  particleSize: 1,
  rotationSpeed: 0.16,
  interactionStrength: 0.82,
  bloomStrength: 0.65,
};

export const clampToStep = (value: number, min: number, max: number, step: number) => {
  const stepped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, stepped));
};

export const sanitizeParticleGalaxyConfig = (
  config: Partial<ParticleGalaxyConfig>,
): ParticleGalaxyConfig => ({
  particleCount: clampToStep(
    config.particleCount ?? DEFAULT_PARTICLE_GALAXY_CONFIG.particleCount,
    PARTICLE_GALAXY_LIMITS.minParticles,
    PARTICLE_GALAXY_LIMITS.maxParticles,
    PARTICLE_GALAXY_LIMITS.particleStep,
  ),
  particleSize: Math.min(2, Math.max(0.45, config.particleSize ?? DEFAULT_PARTICLE_GALAXY_CONFIG.particleSize)),
  rotationSpeed: Math.min(0.75, Math.max(0.02, config.rotationSpeed ?? DEFAULT_PARTICLE_GALAXY_CONFIG.rotationSpeed)),
  interactionStrength: Math.min(2, Math.max(0, config.interactionStrength ?? DEFAULT_PARTICLE_GALAXY_CONFIG.interactionStrength)),
  bloomStrength: Math.min(3, Math.max(0, config.bloomStrength ?? DEFAULT_PARTICLE_GALAXY_CONFIG.bloomStrength)),
});

