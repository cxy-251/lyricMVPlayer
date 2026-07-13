import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type UniverseControls = {
  dustCount: number;
  bundleWidth: number;
  scanSpeed: number;
  scanWidth: number;
  pointSize: number;
  rotationSpeed: number;
};

type UniverseGeometry = {
  points: THREE.BufferGeometry;
  lines: THREE.BufferGeometry;
};

const CLUSTERS = [
  new THREE.Vector3(-2.45, -1.05, -1.35),
  new THREE.Vector3(-2.05, 1.45, 0.7),
  new THREE.Vector3(-0.55, -1.65, 1.55),
  new THREE.Vector3(-0.15, 0.45, -1.95),
  new THREE.Vector3(1.15, 1.55, 1.05),
  new THREE.Vector3(2.35, -0.75, 0.35),
  new THREE.Vector3(0.85, -0.35, 2.15),
  new THREE.Vector3(-0.75, 0.75, -0.05),
];

const FILAMENTS = [
  [0, 7], [7, 4], [4, 5], [5, 6], [6, 2], [2, 0],
  [1, 7], [1, 3], [3, 5], [3, 0], [7, 6], [2, 7],
] as const;

const fract = (value: number) => value - Math.floor(value);
const hash = (value: number) => fract(Math.sin(value * 12.9898) * 43758.5453);

function filamentCurve(start: THREE.Vector3, end: THREE.Vector3, index: number) {
  const direction = end.clone().sub(start);
  const normal = direction.clone().cross(new THREE.Vector3(0.31, 1, 0.17)).normalize();
  const lift = normal.multiplyScalar((hash(index + 11) - 0.5) * 1.15);
  return new THREE.CatmullRomCurve3([
    start,
    start.clone().lerp(end, 0.34).add(lift),
    start.clone().lerp(end, 0.68).addScaledVector(lift, -0.55),
    end,
  ]);
}

function createUniverseGeometry(dustCount: number, bundleWidth: number): UniverseGeometry {
  const linePositions: number[] = [];
  const lineSeeds: number[] = [];
  const pointPositions: number[] = [];
  const pointSeeds: number[] = [];

  FILAMENTS.forEach(([startIndex, endIndex], filamentIndex) => {
    const curve = filamentCurve(CLUSTERS[startIndex], CLUSTERS[endIndex], filamentIndex);
    const sampleCount = 34;
    for (let strand = -1; strand <= 1; strand++) {
      let previous: THREE.Vector3 | null = null;
      for (let sample = 0; sample <= sampleCount; sample++) {
        const t = sample / sampleCount;
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        const side = tangent.clone().cross(new THREE.Vector3(0.17, 1, 0.29)).normalize();
        point.addScaledVector(side, strand * bundleWidth * Math.sin(Math.PI * t));
        if (previous) {
          linePositions.push(previous.x, previous.y, previous.z, point.x, point.y, point.z);
          lineSeeds.push(fract(filamentIndex * 0.137 + t), fract(filamentIndex * 0.137 + t + 0.02));
        }
        previous = point;
      }
    }
  });

  for (let index = 0; index < dustCount; index++) {
    const filamentIndex = index % FILAMENTS.length;
    const [startIndex, endIndex] = FILAMENTS[filamentIndex];
    const curve = filamentCurve(CLUSTERS[startIndex], CLUSTERS[endIndex], filamentIndex);
    const t = hash(index * 4.13 + 3);
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const side = tangent.clone().cross(new THREE.Vector3(0.17, 1, 0.29)).normalize();
    const up = side.clone().cross(tangent).normalize();
    const envelope = 0.18 + Math.sin(Math.PI * t) * bundleWidth * 2.2;
    const radius = Math.pow(hash(index * 7.31 + 19), 2) * envelope;
    const angle = hash(index * 11.73 + 31) * Math.PI * 2;
    point.addScaledVector(side, Math.cos(angle) * radius);
    point.addScaledVector(up, Math.sin(angle) * radius);
    pointPositions.push(point.x, point.y, point.z);
    pointSeeds.push(hash(index * 19.11 + 47));
  }

  CLUSTERS.forEach((cluster, clusterIndex) => {
    for (let index = 0; index < 42; index++) {
      const radius = Math.pow(hash(clusterIndex * 97 + index * 5.7), 2.2) * 0.42;
      const theta = hash(clusterIndex * 31 + index * 9.1) * Math.PI * 2;
      const phi = Math.acos(hash(clusterIndex * 53 + index * 13.7) * 2 - 1);
      pointPositions.push(
        cluster.x + Math.sin(phi) * Math.cos(theta) * radius,
        cluster.y + Math.cos(phi) * radius,
        cluster.z + Math.sin(phi) * Math.sin(theta) * radius,
      );
      pointSeeds.push(0.8 + hash(clusterIndex * 71 + index) * 0.2);
    }
  });

  const points = new THREE.BufferGeometry();
  points.setAttribute('position', new THREE.Float32BufferAttribute(pointPositions, 3));
  points.setAttribute('aSeed', new THREE.Float32BufferAttribute(pointSeeds, 1));
  const lines = new THREE.BufferGeometry();
  lines.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  lines.setAttribute('aSeed', new THREE.Float32BufferAttribute(lineSeeds, 1));
  return {points, lines};
}

const pointVertexShader = `
uniform float uTime;
uniform float uScanSpeed;
uniform float uScanWidth;
uniform float uPointSize;
attribute float aSeed;
varying float vPulse;
varying float vSeed;

void main() {
  float scan = mix(-2.7, 2.7, fract(uTime * uScanSpeed * 0.1));
  vPulse = exp(-pow(abs(position.z - scan) / max(0.03, uScanWidth), 1.4));
  vSeed = aSeed;
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  float twinkle = 0.82 + 0.18 * sin(uTime * (0.8 + aSeed) + aSeed * 31.0);
  gl_PointSize = clamp(uPointSize * twinkle * (0.55 + aSeed * 0.65 + vPulse * 1.35) * (8.0 / max(2.0, -viewPosition.z)), 1.0, 8.0);
  gl_Position = projectionMatrix * viewPosition;
}
`;

const pointFragmentShader = `
precision highp float;
varying float vPulse;
varying float vSeed;

void main() {
  float radius = length(gl_PointCoord - 0.5);
  float core = 1.0 - smoothstep(0.08, 0.2, radius);
  float halo = 1.0 - smoothstep(0.12, 0.5, radius);
  vec3 cold = mix(vec3(0.06, 0.28, 0.62), vec3(0.12, 0.76, 1.0), vSeed);
  vec3 color = mix(cold, vec3(0.88, 0.98, 1.0), vPulse * 0.85 + core * 0.18);
  gl_FragColor = vec4(color, (halo * 0.42 + core * 0.58) * (0.42 + vPulse * 0.58));
}
`;

const lineVertexShader = `
uniform float uTime;
uniform float uScanSpeed;
uniform float uScanWidth;
attribute float aSeed;
varying float vPulse;
varying float vFlow;

void main() {
  float scan = mix(-2.7, 2.7, fract(uTime * uScanSpeed * 0.1));
  vPulse = exp(-pow(abs(position.z - scan) / max(0.03, uScanWidth), 1.4));
  vFlow = pow(0.5 + 0.5 * sin(aSeed * 38.0 - uTime * 1.4), 10.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const lineFragmentShader = `
precision highp float;
varying float vPulse;
varying float vFlow;

void main() {
  vec3 color = mix(vec3(0.025, 0.16, 0.42), vec3(0.12, 0.82, 1.0), vPulse + vFlow * 0.45);
  gl_FragColor = vec4(color, 0.18 + vPulse * 0.5 + vFlow * 0.24);
}
`;

function CosmicWeb({controls}: {controls: UniverseControls}) {
  const groupRef = useRef<THREE.Group>(null);
  const scanPlaneRef = useRef<THREE.Mesh>(null);
  const pointMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const lineMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(
    () => createUniverseGeometry(controls.dustCount, controls.bundleWidth),
    [controls.bundleWidth, controls.dustCount],
  );
  const pointUniforms = useMemo(() => ({
    uTime: {value: 0}, uScanSpeed: {value: 0.3}, uScanWidth: {value: 0.2}, uPointSize: {value: 3},
  }), []);
  const lineUniforms = useMemo(() => ({
    uTime: {value: 0}, uScanSpeed: {value: 0.3}, uScanWidth: {value: 0.2},
  }), []);

  useEffect(() => () => {
    geometry.points.dispose();
    geometry.lines.dispose();
  }, [geometry]);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    if (groupRef.current) groupRef.current.rotation.y += delta * controls.rotationSpeed * 0.14;
    if (scanPlaneRef.current) {
      scanPlaneRef.current.position.z = THREE.MathUtils.lerp(-2.7, 2.7, (time * controls.scanSpeed * 0.1) % 1);
    }
    if (pointMaterialRef.current) {
      pointMaterialRef.current.uniforms.uTime.value = time;
      pointMaterialRef.current.uniforms.uScanSpeed.value = controls.scanSpeed;
      pointMaterialRef.current.uniforms.uScanWidth.value = controls.scanWidth;
      pointMaterialRef.current.uniforms.uPointSize.value = controls.pointSize;
    }
    if (lineMaterialRef.current) {
      lineMaterialRef.current.uniforms.uTime.value = time;
      lineMaterialRef.current.uniforms.uScanSpeed.value = controls.scanSpeed;
      lineMaterialRef.current.uniforms.uScanWidth.value = controls.scanWidth;
    }
  });

  return (
    <group ref={groupRef} rotation={[-0.16, -0.35, 0]}>
      <lineSegments geometry={geometry.lines} frustumCulled={false}>
        <shaderMaterial ref={lineMaterialRef} blending={THREE.AdditiveBlending} depthWrite={false} fragmentShader={lineFragmentShader} transparent uniforms={lineUniforms} vertexShader={lineVertexShader} />
      </lineSegments>
      <points geometry={geometry.points} frustumCulled={false}>
        <shaderMaterial ref={pointMaterialRef} blending={THREE.AdditiveBlending} depthWrite={false} fragmentShader={pointFragmentShader} transparent uniforms={pointUniforms} vertexShader={pointVertexShader} />
      </points>
      {CLUSTERS.map((position, index) => (
        <group key={index} position={position}>
          <mesh>
            <sphereGeometry args={[0.055 + (index % 3) * 0.012, 18, 12]} />
            <meshBasicMaterial color={index % 2 ? '#bdefff' : '#5ccfff'} toneMapped={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.18, 18, 12]} />
            <meshBasicMaterial blending={THREE.AdditiveBlending} color="#38bfff" depthWrite={false} opacity={0.08} transparent />
          </mesh>
        </group>
      ))}
      <mesh ref={scanPlaneRef}>
        <planeGeometry args={[5.8, 5.8]} />
        <meshBasicMaterial color="#55dfff" depthWrite={false} opacity={0.028} side={THREE.DoubleSide} transparent />
      </mesh>
    </group>
  );
}

export default function Demo036SimulationUniverse() {
  const controls = useControls('Cosmic Web', {
    dustCount: {value: 720, min: 240, max: 1200, step: 48, label: 'Matter samples'},
    bundleWidth: {value: 0.1, min: 0.035, max: 0.22, step: 0.005, label: 'Filament bundle'},
    scanSpeed: {value: 0.3, min: 0.05, max: 0.65, step: 0.01, label: 'Slice speed'},
    scanWidth: {value: 0.2, min: 0.06, max: 0.42, step: 0.01, label: 'Slice thickness'},
    pointSize: {value: 3, min: 1.6, max: 4.8, step: 0.1, label: 'Matter glow'},
    rotationSpeed: {value: 0.18, min: 0, max: 0.5, step: 0.01, label: 'Field rotation'},
  }) as UniverseControls;

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#01040a'}}>
      <DemoScene
        engineConfig={{
          background: '#01040a',
          bloom: {intensity: 0.7, luminanceSmoothing: 0.64, luminanceThreshold: 0.48},
          camera: {position: [0, 0.15, 8.4], fov: 46, near: 0.1, far: 30},
          fog: {color: '#01040a', near: 8, far: 16},
        }}
        orbitConfig={{autoRotate: false, enablePan: false, minDistance: 5.5, maxDistance: 13}}
      >
        <CosmicWeb controls={controls} />
      </DemoScene>
      <aside style={legendStyle}>
        <strong style={{color: '#f4fcff'}}>COSMIC WEB · DEPTH SLICE</strong>
        <span><i style={{...legendDot, background: '#7ee7ff'}} />cluster cores</span>
        <span><i style={{...legendDot, background: '#256da6'}} />curved matter filaments</span>
        <span><i style={{...legendDot, background: '#c8f8ff'}} />active tomography samples</span>
      </aside>
    </div>
  );
}

const legendDot = {
  display: 'inline-block', width: 6, height: 6, marginRight: 7, borderRadius: '50%',
} as const;

const legendStyle = {
  position: 'absolute', left: 18, bottom: 18, display: 'grid', gap: 5,
  padding: '10px 12px', border: '1px solid rgba(78,219,255,0.2)', borderRadius: 7,
  background: 'rgba(3,9,19,0.78)', color: '#9fc7d8', pointerEvents: 'none',
  fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 10, lineHeight: 1.45,
} as const;
