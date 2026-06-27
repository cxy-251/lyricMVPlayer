import {useFrame, useThree} from '@react-three/fiber';
import {Bloom, EffectComposer, Vignette} from '@react-three/postprocessing';
import {useControls} from 'leva';
import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {MutableRefObject, WheelEvent} from 'react';
import * as THREE from 'three';

import {Web3DEngine} from '../../core/Web3DEngine';
import {damp, dampVector2, decay} from '../../shared/math/easing';
import {usePointerInteraction} from '../../shared/pointer/usePointerInteraction';
import type {PointerInteractionState} from '../../shared/pointer/usePointerInteraction';
import {createUniforms} from '../../shared/shaders/uniforms';
import fieldFragmentShader from './shaders/fluidField.frag';
import fullscreenVertexShader from './shaders/fullscreen.vert';
import trailUpdateFragmentShader from './shaders/trailUpdate.frag';
import {useFluidTrail} from '../../core/hooks/useFluidTrail';

const TRAIL_TEXTURE_SIZE = 512;

type FluidControls = {
  backgroundScale: number;
  bloomStrength: number;
  distortionStrength: number;
  fluidDecay: number;
  rippleRadius: number;
  trailPersistence: number;
  specularIntensity: number;
  specularShininess: number;
};

type FieldUniforms = {
  uBackgroundScale: number;
  uDistortionStrength: number;
  uPointer: THREE.Vector2;
  uResolution: THREE.Vector2;
  uTime: number;
  uTrail: THREE.Texture | null;
  uZoom: number;
  uSpecularIntensity: number;
  uSpecularShininess: number;
};

function FluidField({
  controls,
  interaction,
  zoomTarget,
}: {
  controls: FluidControls;
  interaction: MutableRefObject<PointerInteractionState>;
  zoomTarget: MutableRefObject<number>;
}) {
  const {camera, gl, pointer, size, viewport} = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const zoom = useRef(1);
  const pointerUv = useMemo(() => new THREE.Vector2(0.5, 0.5), []);
  const easedPointerUv = useMemo(() => new THREE.Vector2(0.5, 0.5), []);
  const previousPointerUv = useMemo(() => new THREE.Vector2(0.5, 0.5), []);
  const velocity = useMemo(() => new THREE.Vector2(), []);

  const { update: updateTrail } = useFluidTrail({
    size: TRAIL_TEXTURE_SIZE,
    distortionStrength: controls.distortionStrength,
    fluidDecay: controls.fluidDecay,
    rippleRadius: controls.rippleRadius,
    trailPersistence: controls.trailPersistence,
    updateShader: trailUpdateFragmentShader
  });

  const fieldUniforms = useMemo(
    () =>
      createUniforms<FieldUniforms>({
        uBackgroundScale: controls.backgroundScale,
        uDistortionStrength: controls.distortionStrength,
        uPointer: new THREE.Vector2(0.5, 0.5),
        uResolution: new THREE.Vector2(size.width, size.height),
        uTime: 0,
        uTrail: null,
        uZoom: 1,
        uSpecularIntensity: controls.specularIntensity,
        uSpecularShininess: controls.specularShininess,
      }),
    [size.width, size.height, controls.backgroundScale, controls.distortionStrength, controls.specularIntensity, controls.specularShininess],
  );

  useFrame((state, delta) => {
    const material = materialRef.current;
    const mesh = meshRef.current;

    if (!material || !mesh) {
      return;
    }

    const safeDelta = Math.min(delta, 0.045);

    pointerUv.set(pointer.x * 0.5 + 0.5, pointer.y * 0.5 + 0.5);
    dampVector2(easedPointerUv, pointerUv, 18, safeDelta);
    interaction.current.drag = damp(interaction.current.drag, interaction.current.dragTarget, 8.5, safeDelta);
    interaction.current.wheel = decay(interaction.current.wheel, 2.4, safeDelta);
    zoom.current = damp(zoom.current, zoomTarget.current + interaction.current.wheel * 0.08, 4.2, safeDelta);

    velocity.copy(easedPointerUv).sub(previousPointerUv);
    const pointerSpeed = velocity.length() / Math.max(safeDelta, 1 / 120);
    const force = THREE.MathUtils.clamp(pointerSpeed * 0.42 + interaction.current.drag * 0.28, 0, 2.8);
    velocity.multiplyScalar(1 / Math.max(safeDelta, 1 / 120));

    const aspect = size.width / Math.max(size.height, 1);

    const fluidTexture = updateTrail(
      safeDelta,
      state.clock.elapsedTime,
      easedPointerUv,
      previousPointerUv,
      velocity,
      interaction.current.drag,
      force,
      aspect
    );

    material.uniforms.uTrail.value = fluidTexture;
    material.uniforms.uPointer.value.copy(easedPointerUv);
    material.uniforms.uResolution.value.set(size.width, size.height);
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uBackgroundScale.value = controls.backgroundScale;
    material.uniforms.uDistortionStrength.value = controls.distortionStrength;
    material.uniforms.uZoom.value = zoom.current;
    material.uniforms.uSpecularIntensity.value = controls.specularIntensity;
    material.uniforms.uSpecularShininess.value = controls.specularShininess;

    mesh.scale.set(viewport.width, viewport.height, 1);
    camera.position.z = damp(camera.position.z, 1.75 + (zoom.current - 1) * 0.16, 3.5, safeDelta);
    camera.lookAt(0, 0, 0);
    previousPointerUv.copy(easedPointerUv);
  });

  return (
    <mesh ref={meshRef} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        depthWrite={false}
        fragmentShader={fieldFragmentShader}
        uniforms={fieldUniforms}
        vertexShader={fullscreenVertexShader}
      />
    </mesh>
  );
}

function FluidCursorScene({debug}: {debug: boolean}) {
  const {interaction, pointerHandlers} = usePointerInteraction();
  const zoomTarget = useRef(1);
  const controls = useControls('Iridescent Liquid Metal', {
    distortionStrength: { value: 1.8, min: 0, max: 3.0, step: 0.01 },
    trailPersistence: { value: 0.94, min: 0, max: 1, step: 0.01 },
    rippleRadius: { value: 0.18, min: 0.025, max: 0.3, step: 0.001 },
    fluidDecay: { value: 0.35, min: 0, max: 2.5, step: 0.01 },
    backgroundScale: { value: 2.2, min: 0.8, max: 4.8, step: 0.02 },
    bloomStrength: { value: 0.0, min: 0, max: 3.5, step: 0.05 },
    specularIntensity: { value: 1.5, min: 0, max: 5.0, step: 0.1 },
    specularShininess: { value: 128.0, min: 8.0, max: 256.0, step: 1.0 },
  }) as FluidControls;

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      pointerHandlers.onWheel(event);
      const direction = event.deltaY > 0 ? 1 : -1;
      zoomTarget.current = THREE.MathUtils.clamp(zoomTarget.current + direction * 0.09, 0.72, 1.42);
    },
    [pointerHandlers],
  );

  return (
    <Web3DEngine
      {...pointerHandlers}
      onWheel={handleWheel}
      config={{
        background: '#03040b',
        camera: {fov: 50, far: 10, near: 0.01, position: [0, 0, 1.75]},
        debug,
        vignette: {darkness: 0.55, offset: 0.18},
      }}
    >
      <FluidField controls={controls} interaction={interaction} zoomTarget={zoomTarget} />
    </Web3DEngine>
  );
}

export default function FluidCursorFieldDemo() {
  const {showStats} = useControls('Debug', { showStats: false });
  return <FluidCursorScene debug={showStats} />;
}
