import {useFrame, useThree} from '@react-three/fiber';
import {useEffect, useMemo, useRef} from 'react';
import type {MutableRefObject} from 'react';
import * as THREE from 'three';

import {damp} from '../../core/math/easing';
import type {PointerInteractionState} from '../../core/pointer/usePointerInteraction';
import {
  clampMorphParticleCount,
  createWebGlMorphSimulation,
  type MorphControls,
} from './particleSimulation';
import {createMorphGeometryFromTargets, generateMorphTargets} from './particleTargets';
import morphParticleFragmentShader from './shaders/morphParticles.frag';
import morphParticleVertexShader from './shaders/morphParticles.vert';

export function ParticleMorphRenderer({
  controls,
  cycleRequest,
  interaction,
  pointerInput,
  requestCycle,
  wheelCameraImpulse,
}: {
  controls: MorphControls;
  cycleRequest: MutableRefObject<number>;
  interaction: MutableRefObject<PointerInteractionState>;
  pointerInput: MutableRefObject<THREE.Vector2>;
  requestCycle: () => void;
  wheelCameraImpulse: MutableRefObject<number>;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const simulation = useMemo(() => createWebGlMorphSimulation(controls), []);
  const safeCount = useMemo(() => clampMorphParticleCount(controls.particleCount), [controls.particleCount]);
  const targets = useMemo(() => generateMorphTargets(safeCount), [safeCount]);
  const geometry = useMemo(() => createMorphGeometryFromTargets(targets), [targets]);
  const {camera, gl} = useThree();

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, delta) => {
    const points = pointsRef.current;

    if (!points) {
      return;
    }

    // Absolutely forceful automatic morphing every 3 seconds (bypass all DOM event issues)
    const currentCycle = Math.floor(state.clock.elapsedTime / 3.0);
    if (cycleRequest.current !== currentCycle) {
      cycleRequest.current = currentCycle;
    }

    const frame = simulation.step({
      controls,
      cycleRequest,
      delta,
      elapsedTime: state.clock.elapsedTime,
      interaction,
      pixelRatio: Math.min(gl.getPixelRatio(), 1.75),
      scenePointer: pointerInput.current,
      wheelCameraImpulse,
    });
    const safeDelta = Math.min(delta, 0.045);

    points.rotation.y += frame.rotationDeltaY;
    points.rotation.x = damp(points.rotation.x, frame.rotationTargetX, 4.2, safeDelta);
    points.rotation.z = damp(points.rotation.z, frame.rotationTargetZ, 4.2, safeDelta);

    camera.position.x = damp(camera.position.x, frame.easedPointer.x * 0.42, 3.6, safeDelta);
    camera.position.y = damp(camera.position.y, 0.24 + frame.easedPointer.y * 0.22, 3.6, safeDelta);
    camera.position.z = damp(camera.position.z, frame.cameraTargetZ, 4.2, safeDelta);
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <InteractionPlane
        interaction={interaction}
        pointerInput={pointerInput}
        requestCycle={requestCycle}
      />
      <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={morphParticleFragmentShader}
          transparent
          uniforms={simulation.uniforms}
          vertexShader={morphParticleVertexShader}
        />
      </points>
    </>
  );
}

function InteractionPlane({
  interaction,
  pointerInput,
  requestCycle,
}: {
  interaction: MutableRefObject<PointerInteractionState>;
  pointerInput: MutableRefObject<THREE.Vector2>;
  requestCycle: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const {viewport} = useThree();

  useFrame(() => {
    const mesh = meshRef.current;

    if (mesh) {
      mesh.scale.set(viewport.width * 1.5, viewport.height * 1.5, 1);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, 0, 4.2]}
      renderOrder={-1}
      onClick={(event) => {
        event.stopPropagation();
        requestCycle();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        interaction.current.dragTarget = 1;
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        pointerInput.current.copy(event.pointer);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        interaction.current.dragTarget = 0;
      }}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial depthWrite={false} opacity={0} transparent />
    </mesh>
  );
}
