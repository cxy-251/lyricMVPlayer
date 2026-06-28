import type {MutableRefObject} from 'react';
import * as THREE from 'three';

import {dampVector2, decay} from '../../core/math/easing';
import {clampToStep} from '../../core/math/number';
import type {PointerInteractionState} from '../../core/pointer/usePointerInteraction';
import {createUniforms} from '../../core/shaders/uniforms';
import {MORPH_SHAPES} from './particleTargets';

export const MIN_MORPH_PARTICLES = 12000;
export const MAX_MORPH_PARTICLES = 90000;
export const MORPH_PARTICLE_STEP = 1000;
export const DEFAULT_MORPH_PARTICLE_COUNT = 46000;

export type MorphControls = {
  bloomStrength: number;
  interactionStrength: number;
  morphSpeed: number;
  particleCount: number;
  particleSize: number;
  turbulenceStrength: number;
};

export type MorphUniforms = {
  uClickPulse: number;
  uDrag: number;
  uFromShape: number;
  uInteractionStrength: number;
  uMorph: number;
  uParticleSize: number;
  uPixelRatio: number;
  uPointer: THREE.Vector2;
  uTime: number;
  uToShape: number;
  uTurbulenceStrength: number;
  uWheel: number;
};

export type ParticleSimulationInput = {
  controls: MorphControls;
  cycleRequest: MutableRefObject<number>;
  delta: number;
  elapsedTime: number;
  interaction: MutableRefObject<PointerInteractionState>;
  pixelRatio: number;
  scenePointer: THREE.Vector2;
  wheelCameraImpulse: MutableRefObject<number>;
};

export type ParticleSimulationFrame = {
  cameraTargetZ: number;
  easedPointer: THREE.Vector2;
  rotationDeltaY: number;
  rotationTargetX: number;
  rotationTargetZ: number;
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

  private readonly easedPointer = new THREE.Vector2();
  private cameraOffset = 0;
  private clickPulse = 0;
  private fromShape = 0;
  private handledCycle = 0;
  private morphProgress = 1;
  private toShape = 0;

  constructor(controls: MorphControls) {
    this.uniforms = createUniforms<MorphUniforms>({
      uClickPulse: 0,
      uDrag: 0,
      uFromShape: 0,
      uInteractionStrength: controls.interactionStrength,
      uMorph: 1,
      uParticleSize: controls.particleSize,
      uPixelRatio: 1,
      uPointer: new THREE.Vector2(),
      uTime: 0,
      uToShape: 0,
      uTurbulenceStrength: controls.turbulenceStrength,
      uWheel: 0,
    });
  }

  step(input: ParticleSimulationInput): ParticleSimulationFrame {
    const safeDelta = Math.min(input.delta, 0.045);

    // WebGL fallback: particle "state" is resolved in the vertex shader from persistent target attributes.
    // A texture/compute backend can implement this interface later and feed the renderer a position texture instead.
    if (input.cycleRequest.current !== this.handledCycle) {
      this.fromShape = this.toShape;
      this.toShape = (this.toShape + 1) % MORPH_SHAPES.length;
      this.morphProgress = 0;
      this.clickPulse = 1;
      this.handledCycle = input.cycleRequest.current;
      console.info('[ParticleMorphingField] simulation cycle', {
        fromShape: this.fromShape,
        request: input.cycleRequest.current,
        toShape: this.toShape,
      });
    }

    dampVector2(this.easedPointer, input.scenePointer, 9.5, safeDelta);
    input.interaction.current.drag = THREE.MathUtils.lerp(
      input.interaction.current.drag,
      input.interaction.current.dragTarget,
      1 - Math.exp(-8 * safeDelta),
    );
    input.interaction.current.wheel = decay(input.interaction.current.wheel, 2.4, safeDelta);

    this.cameraOffset = THREE.MathUtils.clamp(
      this.cameraOffset + input.wheelCameraImpulse.current,
      -1.8,
      2.6,
    );
    input.wheelCameraImpulse.current = 0;
    this.cameraOffset = decay(this.cameraOffset, 1.15, safeDelta);
    this.clickPulse = decay(this.clickPulse, 1.7, safeDelta);

    const morphBoost = 1 + Math.abs(input.interaction.current.wheel) * 0.42;
    this.morphProgress = Math.min(1, this.morphProgress + safeDelta * input.controls.morphSpeed * morphBoost);

    this.uniforms.uClickPulse.value = this.clickPulse;
    this.uniforms.uDrag.value = input.interaction.current.drag;
    this.uniforms.uFromShape.value = this.fromShape;
    this.uniforms.uInteractionStrength.value = input.controls.interactionStrength;
    this.uniforms.uMorph.value = this.morphProgress;
    this.uniforms.uParticleSize.value = input.controls.particleSize;
    this.uniforms.uPixelRatio.value = input.pixelRatio;
    this.uniforms.uPointer.value.copy(this.easedPointer);
    this.uniforms.uTime.value = input.elapsedTime;
    this.uniforms.uToShape.value = this.toShape;
    this.uniforms.uTurbulenceStrength.value = input.controls.turbulenceStrength;
    this.uniforms.uWheel.value = input.interaction.current.wheel;

    Object.assign(globalThis, {
      __particleMorphDebug: {
        cycleRequest: input.cycleRequest.current,
        fromShape: this.fromShape,
        handledCycle: this.handledCycle,
        morphProgress: this.morphProgress,
        toShape: this.toShape,
      },
    });

    return {
      cameraTargetZ: 8.2 + this.cameraOffset,
      easedPointer: this.easedPointer,
      rotationDeltaY: safeDelta * (0.04 + input.controls.morphSpeed * 0.035),
      rotationTargetX: this.easedPointer.y * 0.11,
      rotationTargetZ: -this.easedPointer.x * 0.075,
    };
  }
}

export function createWebGlMorphSimulation(controls: MorphControls): ParticleSimulationPipeline {
  return new WebGlAttributeMorphSimulation(controls);
}
