import type {MutableRefObject} from 'react';

import {clampToStep} from '../../core/math/number';
import {createUniforms} from '../../core/shaders/uniforms';

export const MIN_MORPH_PARTICLES = 12000;
export const MAX_MORPH_PARTICLES = 90000;
export const MORPH_PARTICLE_STEP = 1000;
export const DEFAULT_MORPH_PARTICLE_COUNT = 46000;
const SHAPE_SEQUENCE = [0, 2, 3, 1];

export type MorphControls = {
  bloomStrength: number;
  morphSpeed: number;
  particleCount: number;
  particleSize: number;
  turbulenceStrength: number;
};

export type MorphUniforms = {
  uClickPulse: number;
  uFromShape: number;
  uMorph: number;
  uParticleSize: number;
  uPixelRatio: number;
  uTime: number;
  uToShape: number;
  uTurbulenceStrength: number;
};

export type ParticleSimulationInput = {
  controls: MorphControls;
  cycleRequest: MutableRefObject<number>;
  delta: number;
  elapsedTime: number;
  pixelRatio: number;
};

export type ParticleSimulationFrame = {
  rotationDeltaY: number;
};

export interface ParticleSimulationPipeline {
  readonly uniforms: ReturnType<typeof createUniforms<MorphUniforms>>;
  step(input: ParticleSimulationInput): ParticleSimulationFrame;
}

export function clampMorphParticleCount(value: number) {
  return clampToStep(value, MIN_MORPH_PARTICLES, MAX_MORPH_PARTICLES, MORPH_PARTICLE_STEP);
}

export class WebGlAttributeMorphSimulation implements ParticleSimulationPipeline {
  readonly uniforms: ReturnType<typeof createUniforms<MorphUniforms>>;

  private clickPulse = 0;
  private fromShape = 0;
  private handledCycle = 0;
  private morphProgress = 1;
  private toShape = 0;

  constructor(controls: MorphControls) {
    this.uniforms = createUniforms<MorphUniforms>({
      uClickPulse: 0,
      uFromShape: 0,
      uMorph: 1,
      uParticleSize: controls.particleSize,
      uPixelRatio: 1,
      uTime: 0,
      uToShape: 0,
      uTurbulenceStrength: controls.turbulenceStrength,
    });
  }

  step(input: ParticleSimulationInput): ParticleSimulationFrame {
    const safeDelta = Math.min(input.delta, 0.045);

    // WebGL fallback: particle "state" is resolved in the vertex shader from persistent target attributes.
    // A texture/compute backend can implement this interface later and feed the renderer a position texture instead.
    if (input.cycleRequest.current !== this.handledCycle) {
      this.fromShape = this.toShape;
      const sequenceIndex = SHAPE_SEQUENCE.indexOf(this.toShape);
      this.toShape = SHAPE_SEQUENCE[(sequenceIndex + 1) % SHAPE_SEQUENCE.length];
      this.morphProgress = 0;
      this.clickPulse = 1;
      this.handledCycle = input.cycleRequest.current;
    }

    this.clickPulse *= Math.exp(-1.7 * safeDelta);

    this.morphProgress = Math.min(1, this.morphProgress + safeDelta * input.controls.morphSpeed);

    this.uniforms.uClickPulse.value = this.clickPulse;
    this.uniforms.uFromShape.value = this.fromShape;
    this.uniforms.uMorph.value = this.morphProgress;
    this.uniforms.uParticleSize.value = input.controls.particleSize;
    this.uniforms.uPixelRatio.value = input.pixelRatio;
    this.uniforms.uTime.value = input.elapsedTime;
    this.uniforms.uToShape.value = this.toShape;
    this.uniforms.uTurbulenceStrength.value = input.controls.turbulenceStrength;

    return {
      rotationDeltaY: safeDelta * (0.04 + input.controls.morphSpeed * 0.035),
    };
  }
}

export function createWebGlMorphSimulation(controls: MorphControls): ParticleSimulationPipeline {
  return new WebGlAttributeMorphSimulation(controls);
}
