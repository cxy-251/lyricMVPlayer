import type {WebGLEffectProfileId} from "@paper-to-video/shared-types";

export const SUPPORTED_EFFECT_PROFILE_IDS: WebGLEffectProfileId[] = [
  "life-game",
  "snake-grid",
  "particle-orbit",
  "donut-spin",
  "lights-beams",
  "rubiks-solver",
];

export const isSupportedEffectProfileId = (
  value: string,
): value is WebGLEffectProfileId => {
  return SUPPORTED_EFFECT_PROFILE_IDS.includes(value as WebGLEffectProfileId);
};
