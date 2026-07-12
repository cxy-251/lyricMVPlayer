import {useFrame, useThree} from '@react-three/fiber';
import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

const WATER_WIDTH = 14;
const WATER_DEPTH = 10;
const WATER_SEGMENTS_X = 72;
const WATER_SEGMENTS_Z = 48;

type WaterWaveControls = {
  amplitude: number;
  ballScale: number;
  frequency: number;
  surfaceDetail: number;
  waveSpeed: number;
};

type WaterWaveEffectProps = {
  absoluteFrame?: number;
  autoCamera?: boolean;
  controls?: Partial<WaterWaveControls>;
  seed?: number;
  simulationFrame?: number;
};

const DEFAULT_CONTROLS: WaterWaveControls = {
  amplitude: 0.48,
  ballScale: 1,
  frequency: 1.08,
  surfaceDetail: 0.48,
  waveSpeed: 0.42,
};

const FLOATS = [
  {color: '#ffb65c', phase: 0.2, position: [-1.45, -0.52] as const},
  {color: '#8ee9ff', phase: 1.4, position: [1.55, 0.64] as const},
];

function clampNumber(value: number | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return THREE.MathUtils.clamp(value, min, max);
}

function sampleWaveHeight(x: number, z: number, time: number, controls: WaterWaveControls) {
  const primary = Math.sin(x * controls.frequency * 1.42 + time * 1.38) * 0.46;
  const longSwell = Math.sin((x * 0.5 + z * 1.14) * controls.frequency - time * 1.08) * 0.36;
  const cross = Math.sin((x * -0.86 + z * 0.72) * controls.frequency + time * 0.82) * 0.22;
  const radial =
    Math.sin(Math.hypot(x - 0.45, z + 0.18) * controls.frequency * 1.46 - time * 1.72) * 0.18;
  const detail =
    Math.sin((x * 3.4 - z * 2.2) * controls.frequency + time * 2.1) * 0.07 * controls.surfaceDetail;

  return (primary + longSwell + cross + radial + detail) * controls.amplitude;
}

function createWaterGeometry() {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let zIndex = 0; zIndex <= WATER_SEGMENTS_Z; zIndex += 1) {
    const zRatio = zIndex / WATER_SEGMENTS_Z;
    const z = (zRatio - 0.5) * WATER_DEPTH;

    for (let xIndex = 0; xIndex <= WATER_SEGMENTS_X; xIndex += 1) {
      const xRatio = xIndex / WATER_SEGMENTS_X;
      const x = (xRatio - 0.5) * WATER_WIDTH;
      positions.push(x, 0, z);
      uvs.push(xRatio, zRatio);
    }
  }

  const rowSize = WATER_SEGMENTS_X + 1;
  for (let zIndex = 0; zIndex < WATER_SEGMENTS_Z; zIndex += 1) {
    for (let xIndex = 0; xIndex < WATER_SEGMENTS_X; xIndex += 1) {
      const a = zIndex * rowSize + xIndex;
      const b = a + 1;
      const c = a + rowSize;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  (geometry.attributes.position as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
  geometry.computeVertexNormals();
  return geometry;
}

function updateWaterGeometry(
  geometry: THREE.BufferGeometry,
  time: number,
  controls: WaterWaveControls,
  updateNormals: boolean,
) {
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const positions = position.array as Float32Array;

  for (let cursor = 0; cursor < positions.length; cursor += 3) {
    const x = positions[cursor];
    const z = positions[cursor + 2];
    positions[cursor + 1] = sampleWaveHeight(x, z, time, controls);
  }

  position.needsUpdate = true;
  if (updateNormals) {
    geometry.computeVertexNormals();
  }
}

export function WaterWaveEffect({
  absoluteFrame,
  autoCamera = false,
  controls,
  simulationFrame,
}: WaterWaveEffectProps) {
  const {camera, scene} = useThree();
  const floatRefs = useRef<Array<THREE.Group | null>>([]);
  const surfaceMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const wireMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const normalFrameRef = useRef(0);
  const waterGeometry = useMemo(() => createWaterGeometry(), []);

  const safeControls = useMemo<WaterWaveControls>(() => ({
    amplitude: clampNumber(controls?.amplitude, DEFAULT_CONTROLS.amplitude, 0.08, 0.72),
    ballScale: clampNumber(controls?.ballScale, DEFAULT_CONTROLS.ballScale, 0.65, 1.35),
    frequency: clampNumber(controls?.frequency, DEFAULT_CONTROLS.frequency, 0.45, 1.75),
    surfaceDetail: clampNumber(controls?.surfaceDetail, DEFAULT_CONTROLS.surfaceDetail, 0, 0.9),
    waveSpeed: clampNumber(controls?.waveSpeed, DEFAULT_CONTROLS.waveSpeed, 0, 0.9),
  }), [
    controls?.amplitude,
    controls?.ballScale,
    controls?.frequency,
    controls?.surfaceDetail,
    controls?.waveSpeed,
  ]);

  useEffect(() => {
    scene.fog = new THREE.Fog('#020713', 6.0, 14.5);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame((state) => {
    const frame = simulationFrame ?? absoluteFrame;
    const rawTime = frame === undefined ? state.clock.elapsedTime : frame / 60;
    const time = rawTime * (0.32 + safeControls.waveSpeed * 1.72);
    normalFrameRef.current = (normalFrameRef.current + 1) % 6;

    updateWaterGeometry(waterGeometry, time, safeControls, normalFrameRef.current === 0);

    FLOATS.forEach((floatingBall, index) => {
      const group = floatRefs.current[index];
      const [x, z] = floatingBall.position;
      const height = sampleWaveHeight(x, z, time + floatingBall.phase * 0.08, safeControls);
      const radius = 0.27 * safeControls.ballScale;

      if (group) {
        group.position.set(x, height + radius * 0.58, z);
        group.rotation.x = Math.sin(time * 0.92 + floatingBall.phase) * 0.1;
        group.rotation.z = Math.cos(time * 0.76 + floatingBall.phase) * 0.08;
        group.scale.setScalar(safeControls.ballScale);
      }
    });

    if (surfaceMaterialRef.current) {
      surfaceMaterialRef.current.roughness = 0.42 - safeControls.surfaceDetail * 0.08;
      surfaceMaterialRef.current.emissiveIntensity = 0.08 + safeControls.amplitude * 0.08;
    }

    if (wireMaterialRef.current) {
      wireMaterialRef.current.opacity = 0.13 + safeControls.amplitude * 0.12;
    }

    if (autoCamera) {
      camera.position.x = Math.sin(time * 0.07) * 0.18;
      camera.position.y = 3.1 + Math.sin(time * 0.06) * 0.06;
      camera.position.z = 8.4 + Math.cos(time * 0.05) * 0.08;
      camera.lookAt(0, 0.02, -0.1);
    }
  });

  return (
    <>
      <ambientLight intensity={0.32} color="#9deaff" />
      <directionalLight color="#d9fbff" intensity={1.45} position={[-2.4, 4.8, 3.1]} />
      <pointLight color="#46d7ff" intensity={1.05} position={[2.8, 1.8, 2.3]} />

      <mesh geometry={waterGeometry}>
        <meshStandardMaterial
          ref={surfaceMaterialRef}
          color="#087b9d"
          emissive="#05354d"
          emissiveIntensity={0.12}
          metalness={0.02}
          roughness={0.38}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh geometry={waterGeometry} position={[0, 0.012, 0]}>
        <meshBasicMaterial
          ref={wireMaterialRef}
          color="#91f2ff"
          transparent
          opacity={0.18}
          depthWrite={false}
          wireframe
        />
      </mesh>

      {FLOATS.map((floatingBall, index) => (
        <group key={floatingBall.color}>
          <group
            ref={(node) => {
              floatRefs.current[index] = node;
            }}
          >
            <mesh>
              <sphereGeometry args={[0.27, 42, 32]} />
              <meshStandardMaterial
                color={floatingBall.color}
                emissive={floatingBall.color}
                emissiveIntensity={0.08}
                metalness={0.1}
                roughness={0.32}
              />
            </mesh>
            <mesh position={[0, 0.055, 0.045]}>
              <sphereGeometry args={[0.095, 24, 18]} />
              <meshStandardMaterial color="#ffffff" roughness={0.18} metalness={0.05} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}

export const LightsBeamsEffect = WaterWaveEffect;

export default function Demo020PaperLightsBeams() {
  const controls = useControls('Water Wave Floats', {
    amplitude: {value: DEFAULT_CONTROLS.amplitude, min: 0.08, max: 0.72, step: 0.01},
    waveSpeed: {value: DEFAULT_CONTROLS.waveSpeed, min: 0, max: 0.9, step: 0.01},
    frequency: {value: DEFAULT_CONTROLS.frequency, min: 0.45, max: 1.75, step: 0.01},
    surfaceDetail: {value: DEFAULT_CONTROLS.surfaceDetail, min: 0, max: 0.9, step: 0.01},
    ballScale: {value: DEFAULT_CONTROLS.ballScale, min: 0.65, max: 1.35, step: 0.01},
  });

  return (
    <DemoScene
      engineConfig={{
        background: '#020713',
        bloom: {intensity: 0.16, luminanceThreshold: 0.38, luminanceSmoothing: 0.46},
        camera: {fov: 42, far: 80, near: 0.1, position: [0, 3.1, 8.4]},
        vignette: {darkness: 0.42, offset: 0.36},
      }}
      orbitConfig={{
        enablePan: true,
        enableZoom: true,
        maxDistance: 15,
        minDistance: 3.4,
      }}
    >
      <WaterWaveEffect controls={controls} />
    </DemoScene>
  );
}
