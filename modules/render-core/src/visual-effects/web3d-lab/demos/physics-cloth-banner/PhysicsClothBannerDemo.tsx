import {useFrame, useThree} from '@react-three/fiber';
import {Bloom, EffectComposer, Vignette} from '@react-three/postprocessing';
import {useControls} from 'leva';
import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {MutableRefObject, PointerEvent, WheelEvent} from 'react';
import * as THREE from 'three';

import {Web3DEngine} from '../../core/Web3DEngine';
import {damp, dampVector2, decay} from '../../shared/math/easing';
import {clampToStep} from '../../shared/math/number';
import {usePointerInteraction} from '../../shared/pointer/usePointerInteraction';
import type {PointerInteractionState} from '../../shared/pointer/usePointerInteraction';
import {createUniforms} from '../../shared/shaders/uniforms';
import {ClothSimulation, createClothIndices, createClothUvs} from '../../core/physics/clothSimulation';
import clothFragmentShader from './shaders/cloth.frag';
import clothVertexShader from './shaders/cloth.vert';

const MIN_RESOLUTION = 16;
const MAX_RESOLUTION = 34;
const DEFAULT_RESOLUTION = 24;
const SPARK_COUNT = 140;
const CLOTH_WIDTH = 5.8;
const CLOTH_HEIGHT = 3.35;

type ClothControls = {
  clothResolution: number;
  damping: number;
  glowStrength: number;
  interactionRadius: number;
  interactionStrength: number;
  windStrength: number;
};

type ClothUniforms = {
  uGlowStrength: number;
  uTime: number;
};

function clampResolution(value: number) {
  return clampToStep(value, MIN_RESOLUTION, MAX_RESOLUTION, 1);
}

function createLineGeometry(simulation: ClothSimulation) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((simulation.linePairs.length / 2) * 2 * 3);

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return {geometry, positions};
}

function updateLinePositions(simulation: ClothSimulation, linePositions: Float32Array) {
  let cursor = 0;

  for (let i = 0; i < simulation.linePairs.length; i += 2) {
    const a = simulation.linePairs[i] * 3;
    const b = simulation.linePairs[i + 1] * 3;

    linePositions[cursor++] = simulation.positions[a];
    linePositions[cursor++] = simulation.positions[a + 1];
    linePositions[cursor++] = simulation.positions[a + 2] + 0.006;
    linePositions[cursor++] = simulation.positions[b];
    linePositions[cursor++] = simulation.positions[b + 1];
    linePositions[cursor++] = simulation.positions[b + 2] + 0.006;
  }
}

function createSparkData(simulation: ClothSimulation) {
  const edgeLookup = simulation.edgeIndices;
  const edgeCursor = new Uint16Array(SPARK_COUNT);
  const phase = new Float32Array(SPARK_COUNT);
  const speed = new Float32Array(SPARK_COUNT);
  const spread = new Float32Array(SPARK_COUNT);
  const tint = new Float32Array(SPARK_COUNT);
  const positions = new Float32Array(SPARK_COUNT * 3);
  const colors = new Float32Array(SPARK_COUNT * 3);

  for (let i = 0; i < SPARK_COUNT; i += 1) {
    edgeCursor[i] = edgeLookup[Math.floor(Math.random() * edgeLookup.length)];
    phase[i] = Math.random() * Math.PI * 2;
    speed[i] = THREE.MathUtils.lerp(0.7, 2.3, Math.random());
    spread[i] = THREE.MathUtils.lerp(0.025, 0.18, Math.random());
    tint[i] = Math.random();
  }

  return {colors, edgeCursor, phase, positions, speed, spread, tint};
}

function updateSparkPositions({
  glowStrength,
  simulation,
  sparkData,
  time,
}: {
  glowStrength: number;
  simulation: ClothSimulation;
  sparkData: ReturnType<typeof createSparkData>;
  time: number;
}) {
  for (let i = 0; i < SPARK_COUNT; i += 1) {
    const vertex = sparkData.edgeCursor[i] * 3;
    const cursor = i * 3;
    const flicker = Math.sin(time * sparkData.speed[i] + sparkData.phase[i]) * 0.5 + 0.5;
    const drift = Math.sin(time * 0.9 + sparkData.phase[i]) * sparkData.spread[i];

    sparkData.positions[cursor] = simulation.positions[vertex] + drift * 0.55;
    sparkData.positions[cursor + 1] = simulation.positions[vertex + 1] - sparkData.spread[i] * 0.4;
    sparkData.positions[cursor + 2] = simulation.positions[vertex + 2] + 0.12 + flicker * 0.1;

    if (sparkData.tint[i] > 0.7) {
      sparkData.colors[cursor] = 1.0 * (0.45 + flicker * 0.55);
      sparkData.colors[cursor + 1] = 0.38 * (0.65 + glowStrength * 0.16);
      sparkData.colors[cursor + 2] = 0.95;
    } else {
      sparkData.colors[cursor] = 0.16 * (0.75 + glowStrength * 0.2);
      sparkData.colors[cursor + 1] = 1.0 * (0.45 + flicker * 0.55);
      sparkData.colors[cursor + 2] = 0.84;
    }
  }
}

function ClothCameraRig({cameraDistance}: {cameraDistance: MutableRefObject<number>}) {
  const {camera, pointer} = useThree();

  useFrame((_, delta) => {
    camera.position.x = damp(camera.position.x, pointer.x * 0.22, 3.8, delta);
    camera.position.y = damp(camera.position.y, 0.22 + pointer.y * 0.12, 3.8, delta);
    camera.position.z = damp(camera.position.z, cameraDistance.current, 3.5, delta);
    camera.lookAt(0, -0.18, 0);
  });

  return null;
}

import {Environment} from '@react-three/drei';

function HolographicCloth({
  cameraDistance,
  clickImpulse,
  controls,
  interaction,
  wheelWind,
}: {
  cameraDistance: MutableRefObject<number>;
  clickImpulse: MutableRefObject<number>;
  controls: ClothControls;
  interaction: MutableRefObject<PointerInteractionState>;
  wheelWind: MutableRefObject<number>;
}) {
  const {camera, pointer, raycaster} = useThree();
  const resolution = clampResolution(controls.clothResolution);
  const rows = Math.max(10, Math.round(resolution * 0.66));
  const simulation = useMemo(() => new ClothSimulation(resolution, rows, CLOTH_WIDTH, CLOTH_HEIGHT), [resolution, rows]);
  const clothGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute('position', new THREE.BufferAttribute(simulation.positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(createClothUvs(simulation.columns, simulation.rows), 2));
    geometry.setIndex(createClothIndices(simulation.columns, simulation.rows));
    geometry.computeVertexNormals();

    return geometry;
  }, [simulation]);
  const {geometry: lineGeometry, positions: linePositions} = useMemo(() => createLineGeometry(simulation), [simulation]);
  const sparkData = useMemo(() => createSparkData(simulation), [simulation]);
  const sparkGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute('position', new THREE.BufferAttribute(sparkData.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(sparkData.colors, 3));
    return geometry;
  }, [sparkData]);
  const pointerWorld = useMemo(() => new THREE.Vector3(), []);
  const previousPointerWorld = useMemo(() => new THREE.Vector3(), []);
  const pointerVelocity = useMemo(() => new THREE.Vector2(), []);
  const easedPointer = useMemo(() => new THREE.Vector2(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);

  useEffect(
    () => () => {
      clothGeometry.dispose();
      lineGeometry.dispose();
      sparkGeometry.dispose();
    },
    [clothGeometry, lineGeometry, sparkGeometry],
  );

  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.04);

    dampVector2(easedPointer, pointer, 10, safeDelta);
    raycaster.setFromCamera(easedPointer, camera);
    raycaster.ray.intersectPlane(plane, pointerWorld);
    pointerVelocity.set(pointerWorld.x - previousPointerWorld.x, pointerWorld.y - previousPointerWorld.y);

    interaction.current.drag = damp(interaction.current.drag, interaction.current.dragTarget, 8, safeDelta);
    interaction.current.wheel = decay(interaction.current.wheel, 2.6, safeDelta);
    wheelWind.current = decay(wheelWind.current, 0.7, safeDelta);

    if (clickImpulse.current > 0) {
      simulation.triggerRipple(pointerWorld.x, pointerWorld.y, 1.05 + interaction.current.drag * 0.55);
      clickImpulse.current = 0;
    }

    simulation.step({
      damping: controls.damping,
      delta: safeDelta,
      drag: interaction.current.drag,
      interactionRadius: controls.interactionRadius,
      interactionStrength: controls.interactionStrength,
      pointerSpeed: pointerVelocity.length() / Math.max(safeDelta, 1 / 120),
      pointerVelocityX: pointerVelocity.x,
      pointerVelocityY: pointerVelocity.y,
      pointerX: pointerWorld.x,
      pointerY: pointerWorld.y,
      time: state.clock.elapsedTime,
      windStrength: controls.windStrength + wheelWind.current,
    });

    const positionAttribute = clothGeometry.getAttribute('position') as THREE.BufferAttribute;
    positionAttribute.needsUpdate = true;
    clothGeometry.computeVertexNormals();

    updateLinePositions(simulation, linePositions);
    const linePositionAttribute = lineGeometry.getAttribute('position') as THREE.BufferAttribute;
    linePositionAttribute.needsUpdate = true;

    updateSparkPositions({
      glowStrength: controls.glowStrength,
      simulation,
      sparkData,
      time: state.clock.elapsedTime,
    });
    (sparkGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (sparkGeometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;

    previousPointerWorld.copy(pointerWorld);
    cameraDistance.current = THREE.MathUtils.clamp(cameraDistance.current, 4.8, 8.3);
  });

  return (
    <group rotation={[-0.04, -0.05, 0]}>
      <Environment preset="studio" />
      <mesh geometry={clothGeometry} frustumCulled={false} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#3a0008" // Deep velvet crimson
          emissive="#000000"
          roughness={0.8} // Velvet is rough but has grazing highlights
          metalness={0.1}
          sheen={1.0} // High sheen for velvet/silk effect
          sheenColor="#ff3355" // Bright red sheen reflection
          sheenRoughness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      <points geometry={sparkGeometry} frustumCulled={false}>
        <pointsMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          opacity={0.72}
          size={0.035}
          sizeAttenuation
          toneMapped={false}
          transparent
          vertexColors
        />
      </points>
    </group>
  );
}

function SpaceBackdrop() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(360 * 3);

    for (let i = 0; i < 360; i += 1) {
      const cursor = i * 3;
      positions[cursor] = THREE.MathUtils.lerp(-8, 8, Math.random());
      positions[cursor + 1] = THREE.MathUtils.lerp(-4.5, 4.5, Math.random());
      positions[cursor + 2] = THREE.MathUtils.lerp(-5.5, -1.8, Math.random());
    }

    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return nextGeometry;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        blending={THREE.AdditiveBlending}
        color="#6fd8ff"
        depthWrite={false}
        opacity={0.28}
        size={0.012}
        sizeAttenuation
        toneMapped={false}
        transparent
      />
    </points>
  );
}

function ClothScene({debug}: {debug: boolean}) {
  const {interaction, pointerHandlers} = usePointerInteraction();
  const cameraDistance = useRef(6.4);
  const clickImpulse = useRef(0);
  const wheelWind = useRef(0);
  const controls = useControls('Physics Cloth Banner', {
    windStrength: {
      value: 0.95,
      min: 0,
      max: 2.8,
      step: 0.01,
    },
    damping: {
      value: 0.985,
      min: 0.94,
      max: 0.998,
      step: 0.001,
    },
    clothResolution: {
      value: DEFAULT_RESOLUTION,
      min: MIN_RESOLUTION,
      max: MAX_RESOLUTION,
      step: 1,
    },
    interactionRadius: {
      value: 0.72,
      min: 0.25,
      max: 1.35,
      step: 0.01,
    },
    interactionStrength: {
      value: 0.9,
      min: 0,
      max: 2.4,
      step: 0.01,
    },
    glowStrength: {
      value: 1.05,
      min: 0,
      max: 3,
      step: 0.05,
    },
  }) as ClothControls;

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      pointerHandlers.onPointerDown();
      clickImpulse.current = event.button === 0 ? 1 : 0;
    },
    [pointerHandlers],
  );

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      pointerHandlers.onWheel(event);
      const direction = event.deltaY > 0 ? 1 : -1;
      cameraDistance.current = THREE.MathUtils.clamp(cameraDistance.current + direction * 0.26, 4.8, 8.3);
      wheelWind.current = THREE.MathUtils.clamp(wheelWind.current + (direction > 0 ? -0.12 : 0.22), -0.45, 1.1);
    },
    [pointerHandlers],
  );

  return (
    <Web3DEngine
      {...pointerHandlers}
      onPointerDown={handlePointerDown}
      onWheel={handleWheel}
      config={{
        background: '#03040b',
        camera: {fov: 48, far: 30, near: 0.05, position: [0, 0.22, 6.4]},
        debug,
        fog: {color: '#03040b', far: 19, near: 8},
        vignette: {darkness: 0.6, offset: 0.18},
      }}
    >
      <ambientLight intensity={0.22} />
      <pointLight color="#7dffe7" intensity={1.8} position={[0, 1.8, 2.8]} />
      <pointLight color="#c05cff" intensity={1.35} position={[-2.9, -1.4, 2.1]} />
      <SpaceBackdrop />
      <ClothCameraRig cameraDistance={cameraDistance} />
      <HolographicCloth
        cameraDistance={cameraDistance}
        clickImpulse={clickImpulse}
        controls={controls}
        interaction={interaction}
        wheelWind={wheelWind}
      />
    </Web3DEngine>
  );
}

/**
 * Physics Cloth Banner Demo
 * 
 * [Purpose / Foundation Usage]
 * Demonstrates soft-body physics (cloth simulation) running on the CPU.
 * It utilizes the extracted `ClothSimulation` foundation, which handles Verlet integration
 * and constraint relaxation, allowing the UI thread to interact with the physics geometry.
 * 
 * [Architecture Assembly]
 * - `ClothSimulation` foundation class for soft-body physics.
 * - <Web3DEngine> core renderer to manage the custom Camera Rig and lights.
 * - <usePointerInteraction> for mouse raycasting and physics impulse triggering.
 */
export default function PhysicsClothBannerDemo() {
  const {showStats} = useControls('Debug', {
    showStats: false,
  });

  return <ClothScene debug={showStats} />;
}
