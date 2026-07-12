import {useFrame, useThree} from '@react-three/fiber';
import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

const TAU = Math.PI * 2;
const RING_RADIUS = 1.14;
const TUBE_RADIUS = 0.31;
const HALO_PARTICLE_COUNT = 620;

type DonutSpinControls = {
  autoCamera: boolean;
  halo: number;
  spinSpeed: number;
  surfaceEnergy: number;
};

type DonutSpinEffectProps = {
  absoluteFrame?: number;
  controls?: Partial<DonutSpinControls>;
  seed?: number;
  simulationFrame?: number;
};

const DEFAULT_CONTROLS: DonutSpinControls = {
  autoCamera: false,
  halo: 0.22,
  spinSpeed: 0.48,
  surfaceEnergy: 0.56,
};

const vertexShader = `
  uniform float uTime;
  uniform float uEnergy;

  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPosition;
  varying float vBand;

  void main() {
    vUv = uv;

    float broadBand = sin(uv.x * 18.8495559 + uTime * 0.42) * 0.5 + 0.5;
    float tubeBand = sin(uv.y * 6.2831853 - uTime * 0.26) * 0.5 + 0.5;
    float ripple = sin((uv.x * 42.0) + (uv.y * 9.0) + uTime * 0.64) * 0.5 + 0.5;
    vBand = mix(broadBand * tubeBand, ripple, 0.22);

    vec3 displaced = position + normal * ((vBand - 0.5) * 0.022 * uEnergy);
    vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);

    vWorldPosition = worldPosition.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = `
  uniform float uEnergy;
  uniform vec3 uBaseColor;
  uniform vec3 uCoolColor;
  uniform vec3 uWarmColor;

  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPosition;
  varying float vBand;

  void main() {
    vec3 normalW = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 topLight = normalize(vec3(-0.28, 0.88, 0.38));
    vec3 sideLight = normalize(vec3(0.78, 0.18, 0.58));
    vec3 frontLight = normalize(vec3(-0.08, 0.18, 0.98));

    float top = max(dot(normalW, topLight), 0.0);
    float side = max(dot(normalW, sideLight), 0.0);
    float front = max(dot(normalW, frontLight), 0.0);
    float rim = pow(1.0 - clamp(dot(normalW, viewDir), 0.0, 1.0), 2.15);
    float specTop = pow(max(dot(reflect(-topLight, normalW), viewDir), 0.0), 28.0);
    float specSide = pow(max(dot(reflect(-sideLight, normalW), viewDir), 0.0), 18.0);
    float movingRibbon = smoothstep(0.58, 0.92, vBand);
    float etchedLine = smoothstep(0.44, 0.5, sin(vUv.x * 84.0 + vUv.y * 10.0 + vBand * 2.0) * 0.5 + 0.5);

    vec3 color = uBaseColor * (0.42 + top * 0.56 + front * 0.14);
    color += uCoolColor * (side * 0.14 + rim * (0.5 + uEnergy * 0.28));
    color += vec3(0.86, 0.94, 1.0) * specTop * (0.26 + uEnergy * 0.16);
    color += uCoolColor * specSide * (0.15 + uEnergy * 0.12);
    color += uWarmColor * movingRibbon * (0.055 + uEnergy * 0.09);
    color += uCoolColor * etchedLine * 0.014 * uEnergy;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function seededRandom(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clampNumber(value: number | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return THREE.MathUtils.clamp(value, min, max);
}

function createHaloGeometry(seed: number) {
  const rand = seededRandom(seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(HALO_PARTICLE_COUNT * 3);
  const colors = new Float32Array(HALO_PARTICLE_COUNT * 3);

  const cool = new THREE.Color('#60ddff');
  const blue = new THREE.Color('#88a8ff');
  const warm = new THREE.Color('#ffd08a');

  for (let i = 0; i < HALO_PARTICLE_COUNT; i++) {
    const lane = Math.floor(rand() * 3);
    const angle = rand() * TAU;
    const radius = RING_RADIUS + TUBE_RADIUS * (1.6 + rand() * 2.9);
    const lift = (rand() - 0.5) * (0.18 + lane * 0.07);
    const twist = angle + lane * 0.34 + (rand() - 0.5) * 0.16;

    positions[i * 3] = Math.cos(twist) * radius;
    positions[i * 3 + 1] = Math.sin(twist) * radius * (0.72 + lane * 0.03) + lift;
    positions[i * 3 + 2] = Math.sin(angle * 2.0 + lane) * 0.12 + (rand() - 0.5) * 0.18;

    const color = rand() > 0.9 ? warm : cool.clone().lerp(blue, rand() * 0.7);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function DonutSpinEffect({
  absoluteFrame,
  controls,
  seed = 1901,
  simulationFrame,
}: DonutSpinEffectProps) {
  const rootRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Points>(null);
  const glowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const {camera} = useThree();

  const safeControls = useMemo<DonutSpinControls>(() => ({
    autoCamera: controls?.autoCamera ?? DEFAULT_CONTROLS.autoCamera,
    halo: clampNumber(controls?.halo, DEFAULT_CONTROLS.halo, 0, 0.45),
    spinSpeed: clampNumber(controls?.spinSpeed, DEFAULT_CONTROLS.spinSpeed, 0, 1.2),
    surfaceEnergy: clampNumber(controls?.surfaceEnergy, DEFAULT_CONTROLS.surfaceEnergy, 0, 1),
  }), [controls?.autoCamera, controls?.halo, controls?.spinSpeed, controls?.surfaceEnergy]);

  const uniforms = useMemo(() => ({
    uBaseColor: {value: new THREE.Color('#384252')},
    uCoolColor: {value: new THREE.Color('#54dbff')},
    uEnergy: {value: safeControls.surfaceEnergy},
    uTime: {value: 0},
    uWarmColor: {value: new THREE.Color('#ffd08a')},
  }), []);

  const torusGeometry = useMemo(() => new THREE.TorusGeometry(RING_RADIUS, TUBE_RADIUS, 192, 320), []);
  const glowGeometry = useMemo(() => new THREE.TorusGeometry(RING_RADIUS, TUBE_RADIUS * 1.045, 128, 220), []);
  const haloGeometry = useMemo(() => createHaloGeometry(seed), [seed]);

  useEffect(() => {
    return () => {
      torusGeometry.dispose();
      glowGeometry.dispose();
      haloGeometry.dispose();
    };
  }, [glowGeometry, haloGeometry, torusGeometry]);

  useFrame((state) => {
    const frame = simulationFrame ?? absoluteFrame;
    const time = frame === undefined ? state.clock.elapsedTime : frame / 60;
    const spin = time * safeControls.spinSpeed;

    uniforms.uTime.value = time;
    uniforms.uEnergy.value = safeControls.surfaceEnergy;

    if (rootRef.current) {
      rootRef.current.rotation.x = -0.16 + Math.sin(time * 0.5 + seed) * 0.026;
      rootRef.current.rotation.y = Math.sin(time * 0.37 + seed * 0.01) * 0.07;
      rootRef.current.rotation.z = spin * 0.82;
    }

    if (haloRef.current) {
      haloRef.current.rotation.x = Math.sin(time * 0.21) * 0.05;
      haloRef.current.rotation.z = -spin * 0.36;
      const material = haloRef.current.material as THREE.PointsMaterial;
      material.opacity = safeControls.halo;
    }

    if (glowMaterialRef.current) {
      glowMaterialRef.current.opacity = 0.055 + safeControls.surfaceEnergy * 0.07;
    }

    if (safeControls.autoCamera) {
      camera.position.x = Math.sin(time * 0.12) * 0.22;
      camera.position.y = 0.08 + Math.sin(time * 0.09 + 1.1) * 0.06;
      camera.position.z = 7.0 + Math.cos(time * 0.1) * 0.08;
      camera.lookAt(0, 0, 0);
    }
  });

  return (
    <>
      <ambientLight intensity={0.18} />
      <pointLight color="#9fefff" intensity={1.25} position={[-3.2, 3.1, 4.2]} />
      <pointLight color="#ffd08a" intensity={0.42} position={[3.0, -1.6, 2.2]} />

      <group ref={rootRef}>
        <mesh geometry={torusGeometry}>
          <shaderMaterial
            uniforms={uniforms}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
          />
        </mesh>
        <mesh geometry={glowGeometry}>
          <meshBasicMaterial
            ref={glowMaterialRef}
            color="#58dfff"
            transparent
            opacity={0.09}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      <points ref={haloRef} geometry={haloGeometry} frustumCulled={false}>
        <pointsMaterial
          vertexColors
          size={0.022}
          sizeAttenuation
          transparent
          opacity={safeControls.halo}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <mesh position={[0, 0, -0.9]}>
        <circleGeometry args={[2.9, 96]} />
        <meshBasicMaterial color="#030611" transparent opacity={0.26} depthWrite={false} />
      </mesh>
    </>
  );
}

export default function Demo019PaperDonutSpin() {
  const controls = useControls('Donut Spin', {
    spinSpeed: {value: DEFAULT_CONTROLS.spinSpeed, min: 0, max: 1.2, step: 0.02},
    surfaceEnergy: {value: DEFAULT_CONTROLS.surfaceEnergy, min: 0, max: 1, step: 0.01},
    halo: {value: DEFAULT_CONTROLS.halo, min: 0, max: 0.45, step: 0.01},
    autoCamera: {value: DEFAULT_CONTROLS.autoCamera},
  });

  return (
    <DemoScene
      engineConfig={{
        background: '#030611',
        bloom: {intensity: 0.18, luminanceThreshold: 0.46, luminanceSmoothing: 0.34},
        camera: {fov: 38, far: 80, near: 0.1, position: [0, 0.08, 7.0]},
        vignette: {darkness: 0.48, offset: 0.34},
      }}
      orbitConfig={{
        autoRotate: false,
        enablePan: false,
        enableZoom: true,
        maxDistance: 8,
        minDistance: 3.6,
      }}
    >
      <DonutSpinEffect controls={controls} />
    </DemoScene>
  );
}
