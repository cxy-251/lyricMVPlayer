import {Layers3, Pause, Play} from 'lucide-react';
import {useControls} from 'leva';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const GOLDEN_ANGLE_DEGREES = THREE.MathUtils.radToDeg(GOLDEN_ANGLE);

const FIBONACCI_PAIRS = {
  '13 / 21': [13, 21],
  '21 / 34': [21, 34],
  '34 / 55': [34, 55],
} as const;

const PALETTES = {
  Aurora: {core: '#07161d', primary: '#43e5c1', secondary: '#6978ff'},
  Solar: {core: '#1b1016', primary: '#ffd45c', secondary: '#ff5f91'},
  Polar: {core: '#08121c', primary: '#d5f5ff', secondary: '#5fa8d8'},
} as const;

type FibonacciPairName = keyof typeof FIBONACCI_PAIRS;
type PaletteName = keyof typeof PALETTES;
type LayerMode = 'both' | 'primary' | 'secondary';

const pointVertexShader = /* glsl */ `
  attribute float aProgress;
  varying float vProgress;
  uniform float uPointSize;
  uniform float uTime;

  void main() {
    vProgress = aProgress;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    float breathing = 0.88 + 0.12 * sin(aProgress * 52.0 - uTime * 1.8);
    gl_PointSize = uPointSize * breathing * (9.5 / max(1.0, -viewPosition.z));
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const pointFragmentShader = /* glsl */ `
  precision highp float;

  varying float vProgress;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform float uTime;

  void main() {
    vec2 centered = gl_PointCoord - 0.5;
    float distanceToCenter = length(centered);
    if (distanceToCenter > 0.5) discard;
    float edge = smoothstep(0.5, 0.17, distanceToCenter);
    float colorMix = 0.5 + 0.5 * sin(vProgress * 15.0 + uTime * 0.18);
    vec3 color = mix(uPrimary, uSecondary, colorMix);
    gl_FragColor = vec4(color * (0.72 + edge * 0.52), edge);
  }
`;

const lineVertexShader = /* glsl */ `
  attribute float aProgress;
  varying float vProgress;

  void main() {
    vProgress = aProgress;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const lineFragmentShader = /* glsl */ `
  precision highp float;

  varying float vProgress;
  uniform vec3 uColor;
  uniform float uDirection;
  uniform float uOpacity;
  uniform float uSpeed;
  uniform float uTime;

  void main() {
    float wave = 0.5 + 0.5 * sin(vProgress * 92.0 - uTime * uSpeed * uDirection);
    float pulse = 0.24 + pow(wave, 6.0) * 1.25;
    gl_FragColor = vec4(uColor * pulse, uOpacity * (0.42 + pulse * 0.58));
  }
`;

const buildFibonacciPoints = (count: number, radius: number) => {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < count; index += 1) {
    const normalized = (index + 0.5) / count;
    const polar = Math.acos(1 - 2 * normalized);
    const azimuth = GOLDEN_ANGLE * index;
    points.push(new THREE.Vector3(
      radius * Math.cos(azimuth) * Math.sin(polar),
      radius * Math.cos(polar),
      radius * Math.sin(azimuth) * Math.sin(polar),
    ));
  }
  return points;
};

const createPointGeometry = (points: THREE.Vector3[]) => {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const progress = new Float32Array(points.length);
  for (let index = 0; index < points.length; index += 1) progress[index] = index / Math.max(1, points.length - 1);
  geometry.setAttribute('aProgress', new THREE.BufferAttribute(progress, 1));
  return geometry;
};

const createParastichyGeometry = ({
  armCount,
  companionCount,
  direction,
  radius,
}: {
  armCount: number;
  companionCount: number;
  direction: number;
  radius: number;
}) => {
  const segmentsPerArm = 96;
  const segmentCount = armCount * (segmentsPerArm - 1);
  const positions = new Float32Array(segmentCount * 6);
  const progress = new Float32Array(segmentCount * 2);
  let cursor = 0;
  const pointAt = (arm: number, step: number) => {
    const normalized = (step + 0.5) / segmentsPerArm;
    const polar = Math.acos(1 - 2 * normalized);
    const windingRatio = companionCount / armCount;
    const azimuth =
      (arm / armCount) * Math.PI * 2
      + direction * normalized * Math.PI * 2 * windingRatio;
    return new THREE.Vector3(
      radius * Math.cos(azimuth) * Math.sin(polar),
      radius * Math.cos(polar),
      radius * Math.sin(azimuth) * Math.sin(polar),
    );
  };
  for (let arm = 0; arm < armCount; arm += 1) {
    for (let step = 0; step < segmentsPerArm - 1; step += 1) {
      const start = pointAt(arm, step);
      const end = pointAt(arm, step + 1);
      positions.set([start.x, start.y, start.z, end.x, end.y, end.z], cursor * 6);
      progress[cursor * 2] = (arm + step / segmentsPerArm) / armCount;
      progress[cursor * 2 + 1] = (arm + (step + 1) / segmentsPerArm) / armCount;
      cursor += 1;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aProgress', new THREE.BufferAttribute(progress, 1));
  return geometry;
};

function FibonacciSphere({
  fibonacciPair,
  flowSpeed,
  layerMode,
  lineOpacity,
  palette,
  paused,
  pointSize,
  radius,
  rotationSpeed,
  sampleCount,
}: {
  fibonacciPair: FibonacciPairName;
  flowSpeed: number;
  layerMode: LayerMode;
  lineOpacity: number;
  palette: PaletteName;
  paused: boolean;
  pointSize: number;
  radius: number;
  rotationSpeed: number;
  sampleCount: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(0);
  const colors = PALETTES[palette];
  const [primaryOffset, secondaryOffset] = FIBONACCI_PAIRS[fibonacciPair];
  const points = useMemo(() => buildFibonacciPoints(sampleCount, radius), [radius, sampleCount]);
  const pointGeometry = useMemo(() => createPointGeometry(points), [points]);
  const primaryGeometry = useMemo(() => createParastichyGeometry({
    armCount: primaryOffset,
    companionCount: secondaryOffset,
    direction: 1,
    radius: radius * 1.004,
  }), [primaryOffset, radius, secondaryOffset]);
  const secondaryGeometry = useMemo(() => createParastichyGeometry({
    armCount: secondaryOffset,
    companionCount: primaryOffset,
    direction: -1,
    radius: radius * 1.008,
  }), [primaryOffset, radius, secondaryOffset]);
  const pointMaterial = useMemo(() => new THREE.ShaderMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fragmentShader: pointFragmentShader,
    transparent: true,
    uniforms: {
      uPointSize: {value: pointSize},
      uPrimary: {value: new THREE.Color(colors.primary)},
      uSecondary: {value: new THREE.Color(colors.secondary)},
      uTime: {value: 0},
    },
    vertexShader: pointVertexShader,
  }), []);
  const primaryMaterial = useMemo(() => new THREE.ShaderMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fragmentShader: lineFragmentShader,
    transparent: true,
    uniforms: {
      uColor: {value: new THREE.Color(colors.primary)},
      uDirection: {value: 1},
      uOpacity: {value: lineOpacity},
      uSpeed: {value: flowSpeed},
      uTime: {value: 0},
    },
    vertexShader: lineVertexShader,
  }), []);
  const secondaryMaterial = useMemo(() => new THREE.ShaderMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fragmentShader: lineFragmentShader,
    transparent: true,
    uniforms: {
      uColor: {value: new THREE.Color(colors.secondary)},
      uDirection: {value: -1},
      uOpacity: {value: lineOpacity},
      uSpeed: {value: flowSpeed},
      uTime: {value: 0},
    },
    vertexShader: lineVertexShader,
  }), []);

  useEffect(() => () => {
    pointGeometry.dispose();
    primaryGeometry.dispose();
    secondaryGeometry.dispose();
  }, [pointGeometry, primaryGeometry, secondaryGeometry]);

  useEffect(() => () => {
    pointMaterial.dispose();
    primaryMaterial.dispose();
    secondaryMaterial.dispose();
  }, [pointMaterial, primaryMaterial, secondaryMaterial]);

  useFrame((_state, delta) => {
    if (!paused) elapsedRef.current += delta;
    const elapsed = elapsedRef.current;
    if (groupRef.current) {
      groupRef.current.rotation.y = elapsed * rotationSpeed;
      groupRef.current.rotation.x = Math.sin(elapsed * rotationSpeed * 0.37) * 0.1;
    }
    pointMaterial.uniforms.uPointSize.value = pointSize;
    pointMaterial.uniforms.uPrimary.value.set(colors.primary);
    pointMaterial.uniforms.uSecondary.value.set(colors.secondary);
    pointMaterial.uniforms.uTime.value = elapsed;
    [primaryMaterial, secondaryMaterial].forEach((material) => {
      material.uniforms.uOpacity.value = lineOpacity;
      material.uniforms.uSpeed.value = flowSpeed * 5;
      material.uniforms.uTime.value = elapsed;
    });
    primaryMaterial.uniforms.uColor.value.set(colors.primary);
    secondaryMaterial.uniforms.uColor.value.set(colors.secondary);
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[radius * 0.992, 64, 64]} />
        <meshStandardMaterial
          color={colors.core}
          metalness={0.42}
          roughness={0.56}
        />
      </mesh>
      <points geometry={pointGeometry} material={pointMaterial} />
      {layerMode !== 'secondary' ? <lineSegments geometry={primaryGeometry} material={primaryMaterial} /> : null}
      {layerMode !== 'primary' ? <lineSegments geometry={secondaryGeometry} material={secondaryMaterial} /> : null}
    </group>
  );
}

const SPHERE_STYLES = `
  .sphere-lab {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    background: #05080e;
  }

  .sphere-hud {
    position: fixed;
    z-index: 12;
    top: 64px;
    left: 50%;
    width: min(520px, calc(100vw - 132px));
    transform: translateX(-50%);
    padding: 11px 13px 10px;
    border: 1px solid rgba(148, 194, 211, 0.2);
    border-radius: 6px;
    background: rgba(7, 12, 20, 0.9);
    color: #eef7fb;
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(12px);
  }

  .sphere-hud__row,
  .sphere-hud__stats,
  .sphere-hud__actions {
    display: flex;
    align-items: center;
  }

  .sphere-hud__row,
  .sphere-hud__stats {
    justify-content: space-between;
    gap: 14px;
  }

  .sphere-hud__title strong {
    display: block;
    font-size: 0.88rem;
    font-weight: 760;
    line-height: 1.15;
  }

  .sphere-hud__mode {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 4px;
    color: #91aab8;
    font-size: 0.66rem;
    font-weight: 700;
  }

  .sphere-hud__mode::before {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #55e4c0;
    box-shadow: 0 0 10px rgba(85, 228, 192, 0.56);
    content: '';
  }

  .sphere-hud[data-paused='true'] .sphere-hud__mode::before {
    background: #ffc55f;
    box-shadow: 0 0 10px rgba(255, 197, 95, 0.46);
  }

  .sphere-hud__actions {
    gap: 6px;
  }

  .sphere-hud__action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 31px;
    height: 31px;
    border: 1px solid rgba(174, 207, 222, 0.18);
    border-radius: 5px;
    background: #131b26;
    color: #cee0e8;
    cursor: pointer;
  }

  .sphere-hud__action:hover {
    border-color: rgba(85, 228, 192, 0.5);
    color: #ffffff;
  }

  .sphere-hud__action:focus-visible {
    outline: 2px solid #55e4c0;
    outline-offset: 2px;
  }

  .sphere-hud__stats {
    margin-top: 9px;
    padding-top: 8px;
    border-top: 1px solid rgba(174, 207, 222, 0.12);
    color: #7f96a3;
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
  }

  .sphere-hud__stats strong {
    color: #d9eaf0;
    font-weight: 720;
  }

  @media (max-width: 650px) {
    .sphere-hud {
      top: 70px;
      width: min(500px, calc(100vw - 28px));
    }
  }
`;

export default function Demo059PerfectSphere() {
  const controls = useControls('Fibonacci Sphere', {
    fibonacciPair: {label: 'Spiral Pair', options: Object.keys(FIBONACCI_PAIRS), value: '13 / 21'},
    sampleCount: {label: 'Fibonacci Samples', options: {F610: 610, F987: 987, F1597: 1597, F2584: 2584}, value: 987},
    radius: {label: 'Sphere Radius', max: 4, min: 2.2, step: 0.05, value: 3},
    pointSize: {label: 'Point Size', max: 6, min: 1, step: 0.1, value: 4.2},
    lineOpacity: {label: 'Spiral Visibility', max: 0.48, min: 0.04, step: 0.01, value: 0.28},
    flowSpeed: {label: 'Pulse Speed', max: 1, min: 0, step: 0.02, value: 0.28},
    rotationSpeed: {label: 'Rotation Speed', max: 0.3, min: 0, step: 0.01, value: 0.08},
    palette: {label: 'Palette', options: Object.keys(PALETTES), value: 'Aurora'},
  });
  const [paused, setPaused] = useState(false);
  const [layerMode, setLayerMode] = useState<LayerMode>('primary');
  const fibonacciPair = controls.fibonacciPair as FibonacciPairName;
  const [primaryOffset, secondaryOffset] = FIBONACCI_PAIRS[fibonacciPair];

  return (
    <div className="sphere-lab">
      <style>{SPHERE_STYLES}</style>
      <div className="sphere-hud" data-paused={paused}>
        <div className="sphere-hud__row">
          <div className="sphere-hud__title">
            <strong>Fibonacci Parastichy Sphere</strong>
            <span className="sphere-hud__mode">{paused ? 'PAUSED' : layerMode.toUpperCase()}</span>
          </div>
          <div className="sphere-hud__actions">
            <button
              aria-label={paused ? 'Resume animation' : 'Pause animation'}
              className="sphere-hud__action"
              onClick={() => setPaused((value) => !value)}
              title={paused ? 'Resume animation' : 'Pause animation'}
              type="button"
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
            <button
              aria-label="Switch spiral layers"
              className="sphere-hud__action"
              onClick={() => setLayerMode((mode) => mode === 'both' ? 'primary' : mode === 'primary' ? 'secondary' : 'both')}
              title="Show both, primary, or secondary spiral families"
              type="button"
            >
              <Layers3 size={15} />
            </button>
          </div>
        </div>
        <div className="sphere-hud__stats">
          <span>Samples <strong>{controls.sampleCount}</strong></span>
          <span>Offsets <strong>{primaryOffset} / {secondaryOffset}</strong></span>
          <span>Golden angle <strong>{GOLDEN_ANGLE_DEGREES.toFixed(3)} deg</strong></span>
        </div>
      </div>

      <DemoScene
        engineConfig={{
          background: '#05080e',
          bloom: {intensity: 0.16, luminanceSmoothing: 0.44, luminanceThreshold: 0.78},
          camera: {far: 60, fov: 42, near: 0.1, position: [0, 0, 10.5]},
          vignette: {darkness: 0.34, offset: 0.34},
        }}
        orbitConfig={{enablePan: false, maxDistance: 14, minDistance: 6}}
      >
        <ambientLight intensity={0.42} />
        <directionalLight intensity={1.35} position={[-5, 7, 8]} />
        <FibonacciSphere
          fibonacciPair={fibonacciPair}
          flowSpeed={THREE.MathUtils.clamp(controls.flowSpeed, 0, 1)}
          layerMode={layerMode}
          lineOpacity={THREE.MathUtils.clamp(controls.lineOpacity, 0.04, 0.48)}
          palette={controls.palette as PaletteName}
          paused={paused}
          pointSize={THREE.MathUtils.clamp(controls.pointSize, 1, 6)}
          radius={THREE.MathUtils.clamp(controls.radius, 2.2, 4)}
          rotationSpeed={THREE.MathUtils.clamp(controls.rotationSpeed, 0, 0.3)}
          sampleCount={Math.max(610, Math.min(2584, Math.round(controls.sampleCount)))}
        />
      </DemoScene>
    </div>
  );
}
