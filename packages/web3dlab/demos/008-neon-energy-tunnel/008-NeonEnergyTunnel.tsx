import {useFrame, useThree} from '@react-three/fiber';
import {Environment} from '@react-three/drei';
import {useControls} from 'leva';
import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {MutableRefObject, WheelEvent} from 'react';
import * as THREE from 'three';

import {Web3DEngine} from '../../core/Web3DEngine';
import {damp, dampVector2, decay} from '../../core/math/easing';
import {clampToStep} from '../../core/math/number';
import {usePointerInteraction} from '../../core/pointer/usePointerInteraction';
import type {PointerInteractionState} from '../../core/pointer/usePointerInteraction';
import {getTunnelCenter, getTunnelRadius, getWrappedTunnelZ, TAU} from './tunnelPath';

const MIN_SEGMENTS = 36;
const MAX_SEGMENTS = 110;
const MIN_STREAKS = 180;
const MAX_STREAKS = 1600;
const DEPTH_SPACING = 1.08;
const RADIAL_LINE_COUNT = 34;

type NeonTunnelControls = {
  distortionStrength: number;
  glowStrength: number;
  particleDensity: number;
  segmentCount: number;
  travelSpeed: number;
  tunnelRadius: number;
};

type TunnelMotionState = {
  distortion: number;
  effectiveSpeed: number;
  pointer: THREE.Vector2;
  travel: number;
};

function clampSegmentCount(value: number) {
  return clampToStep(value, MIN_SEGMENTS, MAX_SEGMENTS, 1);
}

function clampStreakCount(value: number) {
  return clampToStep(value, MIN_STREAKS, MAX_STREAKS, 20);
}

function TunnelMotionController({
  controls,
  interaction,
  motion,
  speedBias,
}: {
  controls: NeonTunnelControls;
  interaction: MutableRefObject<PointerInteractionState>;
  motion: MutableRefObject<TunnelMotionState>;
  speedBias: MutableRefObject<number>;
}) {
  const {camera, pointer} = useThree();
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const drag = interaction.current.drag;

    dampVector2(motion.current.pointer, pointer, 8, delta);
    interaction.current.drag = damp(drag, interaction.current.dragTarget, 7.5, delta);
    interaction.current.wheel = decay(interaction.current.wheel, 2.8, delta);
    speedBias.current = decay(speedBias.current, 0.85, delta);

    motion.current.distortion =
      controls.distortionStrength + interaction.current.drag * 1.15 + Math.abs(interaction.current.wheel) * 0.26;
    motion.current.effectiveSpeed = THREE.MathUtils.clamp(
      controls.travelSpeed + speedBias.current + interaction.current.drag * 1.4,
      0.6,
      13,
    );
    motion.current.travel += delta * motion.current.effectiveSpeed * 5.2;

    camera.position.x = damp(camera.position.x, motion.current.pointer.x * 0.28, 5, delta);
    camera.position.y = damp(camera.position.y, motion.current.pointer.y * 0.2, 5, delta);

    lookTarget.set(motion.current.pointer.x * 1.15, motion.current.pointer.y * 0.8, -8.5);
    camera.lookAt(lookTarget);
  });

  return null;
}

function TunnelRings({
  controls,
  motion,
}: {
  controls: NeonTunnelControls;
  motion: MutableRefObject<TunnelMotionState>;
}) {
  const safeSegments = useMemo(() => clampSegmentCount(controls.segmentCount), [controls.segmentCount]);
  // Thick tubular geometry to show off PBR reflections
  const ringGeometry = useMemo(() => new THREE.TorusGeometry(1, 0.06, 16, 128), []);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const scale = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const totalDepth = safeSegments * DEPTH_SPACING;

  useEffect(() => () => ringGeometry.dispose(), [ringGeometry]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;

    if (!mesh) return;

    const travel = motion.current.travel;
    const distortion = motion.current.distortion;

    for (let i = 0; i < safeSegments; i += 1) {
      const z = getWrappedTunnelZ(i, DEPTH_SPACING, travel, totalDepth);
      const radius = getTunnelRadius(controls.tunnelRadius, z, travel, distortion);
      const pulse = Math.sin(Math.abs(z) * 0.62 + travel * 0.18 + i * 0.17);

      getTunnelCenter(z, travel, distortion, motion.current.pointer, position);
      scale.setScalar(radius * (1 + pulse * 0.025));
      quaternion.setFromEuler(
        new THREE.Euler(
          Math.sin(Math.abs(z) * 0.07 + travel * 0.02) * distortion * 0.06,
          Math.cos(Math.abs(z) * 0.065 - travel * 0.025) * distortion * 0.06,
          travel * 0.012 + i * 0.11,
        ),
      );
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);

      color.setHSL((0.55 + i * 0.021 + travel * 0.006) % 1, 0.95, 0.6);
      color.lerpHSL(new THREE.Color(0.8, 0.2, 1.0), 0.3); // Deep violet/magenta mix
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.rotation.z += delta * (0.05 + controls.travelSpeed * 0.012);
  });

  return (
    <instancedMesh ref={meshRef} args={[ringGeometry, undefined, safeSegments]} frustumCulled={false} receiveShadow castShadow>
      <meshPhysicalMaterial
        roughness={0.05}
        metalness={1.0}
        clearcoat={1.0}
        clearcoatRoughness={0.1}
      />
    </instancedMesh>
  );
}

function SciFiPanels({
  controls,
  motion,
}: {
  controls: NeonTunnelControls;
  motion: MutableRefObject<TunnelMotionState>;
}) {
  const safeSegments = useMemo(() => clampSegmentCount(controls.segmentCount), [controls.segmentCount]);
  const panelCount = RADIAL_LINE_COUNT * (safeSegments - 1);
  const geometry = useMemo(() => new THREE.BoxGeometry(0.12, 0.03, 0.8), []);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const scale = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const totalDepth = safeSegments * DEPTH_SPACING;

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const travel = motion.current.travel;
    const distortion = motion.current.distortion;
    let cursor = 0;

    for (let radial = 0; radial < RADIAL_LINE_COUNT; radial += 1) {
      const baseAngle = (radial / RADIAL_LINE_COUNT) * TAU;

      for (let segment = 0; segment < safeSegments - 1; segment += 1) {
        const z = getWrappedTunnelZ(segment, DEPTH_SPACING, travel, totalDepth);
        const radius = getTunnelRadius(controls.tunnelRadius, z, travel, distortion) * 1.01;
        const twist = travel * 0.018 + Math.sin(Math.abs(z) * 0.12 + travel * 0.03) * distortion * 0.12;
        const angle = baseAngle + twist;

        getTunnelCenter(z, travel, distortion, motion.current.pointer, position);
        position.x += Math.cos(angle) * radius;
        position.y += Math.sin(angle) * radius;

        quaternion.setFromEuler(new THREE.Euler(0, 0, angle));
        scale.setScalar(1);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(cursor, matrix);

        color.set('#39f5ff');
        mesh.setColorAt(cursor, color);
        
        cursor++;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, panelCount]} frustumCulled={false} receiveShadow castShadow>
      <meshPhysicalMaterial
        roughness={0.1}
        metalness={0.9}
        clearcoat={1.0}
      />
    </instancedMesh>
  );
}

function SolidStreaks({
  controls,
  motion,
}: {
  controls: NeonTunnelControls;
  motion: MutableRefObject<TunnelMotionState>;
}) {
  const safeCount = useMemo(() => clampStreakCount(controls.particleDensity), [controls.particleDensity]);
  const totalDepth = clampSegmentCount(controls.segmentCount) * DEPTH_SPACING;
  const seeds = useMemo(
    () =>
      Array.from({length: safeCount}, () => ({
        angle: Math.random() * TAU,
        color: Math.random(),
        lane: THREE.MathUtils.lerp(0.32, 1.02, Math.random()),
        speed: THREE.MathUtils.lerp(0.62, 1.55, Math.random()),
        z: Math.random() * totalDepth,
      })),
    [safeCount, totalDepth],
  );
  
  const geometry = useMemo(() => {
    // Sharp fast crystals
    const geo = new THREE.TetrahedronGeometry(0.05, 0);
    geo.rotateX(Math.PI / 2); 
    return geo;
  }, []);
  
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const scale = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const colorA = useMemo(() => new THREE.Color(), []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const travel = motion.current.travel;
    const distortion = motion.current.distortion;
    const streakLength = 1.0 + motion.current.effectiveSpeed * 0.5 + motion.current.distortion * 0.2;
    let cursor = 0;

    for (const seed of seeds) {
      const wrapped = (seed.z + travel * seed.speed) % totalDepth;
      const zHead = -totalDepth + wrapped;
      const radius = getTunnelRadius(controls.tunnelRadius, zHead, travel, distortion) * seed.lane;
      const angle = seed.angle + travel * 0.035 + Math.sin(wrapped * 0.08) * distortion * 0.16;

      getTunnelCenter(zHead, travel, distortion, motion.current.pointer, position);
      position.x += Math.cos(angle) * radius;
      position.y += Math.sin(angle) * radius;

      scale.set(1, 1, streakLength);
      quaternion.setFromEuler(new THREE.Euler(0, 0, angle));
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(cursor, matrix);

      colorA.setHSL(seed.color > 0.55 ? 0.84 : 0.53, 0.95, 0.72);
      mesh.setColorAt(cursor, colorA);
      
      cursor++;
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, safeCount]} frustumCulled={false} castShadow receiveShadow>
      <meshPhysicalMaterial
        roughness={0.0}
        metalness={0.2}
        transmission={0.9}
        thickness={0.5}
        ior={2.0}
        clearcoat={1.0}
      />
    </instancedMesh>
  );
}

function NeonTunnelScene() {
  const {interaction, pointerHandlers} = usePointerInteraction();
  const speedBias = useRef(0);
  const motion = useRef<TunnelMotionState>({
    distortion: 0,
    effectiveSpeed: 0,
    pointer: new THREE.Vector2(),
    travel: 0,
  });
  const controls = useControls('Neon Energy Tunnel', {
    travelSpeed: {
      value: 4.2,
      min: 0.6,
      max: 10,
      step: 0.05,
    },
    tunnelRadius: {
      value: 3.05,
      min: 1.8,
      max: 5.2,
      step: 0.05,
    },
    segmentCount: {
      value: 72,
      min: MIN_SEGMENTS,
      max: MAX_SEGMENTS,
      step: 1,
    },
    glowStrength: {
      value: 0.85,
      min: 0.2,
      max: 3,
      step: 0.05,
    },
    distortionStrength: {
      value: 0.72,
      min: 0,
      max: 2,
      step: 0.01,
    },
    particleDensity: {
      value: 820,
      min: MIN_STREAKS,
      max: MAX_STREAKS,
      step: 20,
    },
  }) as NeonTunnelControls;

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      pointerHandlers.onWheel(event);
      const direction = event.deltaY > 0 ? -1 : 1;
      speedBias.current = THREE.MathUtils.clamp(speedBias.current + direction * 0.55, -2.2, 3.8);
    },
    [pointerHandlers],
  );

  return (
    <Web3DEngine
      {...pointerHandlers}
      onWheel={handleWheel}
      config={{
        background: '#04020a',
        camera: {fov: 76, far: 90, near: 0.05, position: [0, 0, 0]},
        fog: {color: '#04020a', far: 50, near: 10},
      }}
    >
      <Environment preset="night" />
      
      {/* Lights moving through the tunnel to create reflections */}
      <pointLight position={[0, 0, -10]} intensity={20.0} color="#ff0088" distance={50} decay={2} />
      <pointLight position={[0, 0, -30]} intensity={40.0} color="#00ffff" distance={50} decay={2} />
      <pointLight position={[0, 0, -60]} intensity={30.0} color="#ffaa00" distance={50} decay={2} />
      <ambientLight intensity={1.5} />

      <TunnelMotionController controls={controls} interaction={interaction} motion={motion} speedBias={speedBias} />
      <SciFiPanels controls={controls} motion={motion} />
      <TunnelRings controls={controls} motion={motion} />
      <SolidStreaks controls={controls} motion={motion} />
    </Web3DEngine>
  );
}

export default function Demo008NeonEnergyTunnel() {
  return <NeonTunnelScene />;
}
