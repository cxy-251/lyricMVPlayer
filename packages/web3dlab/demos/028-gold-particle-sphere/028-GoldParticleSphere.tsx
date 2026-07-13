import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const vertexShader = `
uniform float uTime;
uniform float uRadius;
uniform float uFacetSize;
uniform float uFacetScale;
uniform float uGoldCoverage;
uniform float uWaveAmplitude;
uniform float uWaveSpeed;

attribute vec3 aNormalDirection;
attribute float aSeed;
attribute float aScale;
attribute vec3 aBarycentric;

varying vec3 vBarycentric;
varying vec3 vColor;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying float vGold;

void main() {
  vec3 direction = normalize(aNormalDirection);
  float time = uTime * uWaveSpeed;
  float pattern = (
    sin(direction.y * 8.2 + time * 0.74)
    + sin((direction.x * 0.7 + direction.z) * 10.4 - time * 0.52)
    + sin((direction.x - direction.y * 0.35 + direction.z * 0.48) * 13.0 + time * 0.31)
  ) / 3.0;
  float threshold = mix(0.62, -0.62, uGoldCoverage);
  float gold = smoothstep(threshold - 0.14, threshold + 0.14, pattern);
  float pulse = 0.5 + 0.5 * sin(
    time * mix(1.4, 2.2, aSeed)
    + aSeed * 31.4
    + dot(direction, vec3(4.0, 7.0, 5.0))
  );
  float lift = uWaveAmplitude * (gold * mix(0.28, 1.0, pulse) + pattern * 0.18);

  vec3 referenceUp = abs(direction.y) > 0.94 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 tangent = normalize(cross(referenceUp, direction));
  vec3 bitangent = normalize(cross(direction, tangent));
  float spin = aSeed * 6.2831853 + time * mix(0.08, 0.22, aSeed);
  mat2 rotation = mat2(cos(spin), -sin(spin), sin(spin), cos(spin));
  vec2 local = rotation * position.xy * uFacetSize * uFacetScale * aScale;
  vec3 shellPosition = direction * (uRadius + lift)
    + tangent * local.x
    + bitangent * local.y;
  vec4 worldPosition = modelMatrix * vec4(shellPosition, 1.0);

  vec3 graphite = vec3(0.025, 0.027, 0.03);
  vec3 deepGold = vec3(0.43, 0.25, 0.035);
  vec3 brightGold = vec3(1.0, 0.72, 0.19);
  vColor = mix(graphite, mix(deepGold, brightGold, 0.35 + aSeed * 0.5), gold);
  vBarycentric = aBarycentric;
  vGold = gold;
  vWorldNormal = normalize(mat3(modelMatrix) * direction);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = `
precision highp float;

varying vec3 vBarycentric;
varying vec3 vColor;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying float vGold;

void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  vec3 lightDirection = normalize(vec3(2.6, 3.8, 4.2) - vWorldPosition);
  float diffuse = max(dot(normal, lightDirection), 0.0);
  vec3 halfDirection = normalize(lightDirection + viewDirection);
  float specular = pow(max(dot(normal, halfDirection), 0.0), mix(18.0, 52.0, vGold));
  float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.3);
  float nearestEdge = min(min(vBarycentric.x, vBarycentric.y), vBarycentric.z);
  float edgeWidth = fwidth(nearestEdge) * 1.25;
  float edge = 1.0 - smoothstep(edgeWidth, edgeWidth * 2.4, nearestEdge);

  vec3 color = vColor * (0.34 + diffuse * 0.72);
  color += vec3(1.0, 0.75, 0.28) * specular * (0.16 + vGold * 0.72);
  color += mix(vec3(0.09), vec3(0.92, 0.56, 0.12), vGold) * rim * 0.34;
  color += mix(vec3(0.1), vec3(1.0, 0.74, 0.24), vGold) * edge * (0.12 + vGold * 0.28);
  gl_FragColor = vec4(color, 1.0);
}
`;

type GoldSphereControls = {
  triangleCount: number;
  facetScale: number;
  goldCoverage: number;
  waveAmplitude: number;
  waveSpeed: number;
  rotationSpeed: number;
};

const fract = (value: number) => value - Math.floor(value);

function createTriangleShell(count: number) {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([
        0, 0.62, 0,
        -0.54, -0.31, 0,
        0.54, -0.31, 0,
      ]),
      3,
    ),
  );
  geometry.setAttribute(
    'aBarycentric',
    new THREE.BufferAttribute(
      new Float32Array([
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
      ]),
      3,
    ),
  );

  const normalDirections = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const scales = new Float32Array(count);

  for (let index = 0; index < count; index++) {
    const y = 1 - (2 * (index + 0.5)) / count;
    const radial = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = index * GOLDEN_ANGLE;
    normalDirections[index * 3] = Math.cos(angle) * radial;
    normalDirections[index * 3 + 1] = y;
    normalDirections[index * 3 + 2] = Math.sin(angle) * radial;
    seeds[index] = fract(Math.sin(index * 73.31 + 19.7) * 11358.5453);
    scales[index] = 0.76 + fract(Math.sin(index * 17.17 + 3.4) * 491.2) * 0.38;
  }

  geometry.setAttribute(
    'aNormalDirection',
    new THREE.InstancedBufferAttribute(normalDirections, 3),
  );
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
  geometry.instanceCount = count;
  return geometry;
}

function GoldTriangleSphere({controls}: {controls: GoldSphereControls}) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const count = Math.round(controls.triangleCount / 100) * 100;
  const geometry = useMemo(() => createTriangleShell(count), [count]);
  const uniforms = useMemo(
    () => ({
      uTime: {value: 0},
      uRadius: {value: 1.72},
      uFacetSize: {value: 7 / Math.sqrt(count)},
      uFacetScale: {value: 0.82},
      uGoldCoverage: {value: 0.52},
      uWaveAmplitude: {value: 0.07},
      uWaveSpeed: {value: 0.42},
    }),
    [count],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const material = materialRef.current;
    if (!group || !material) return;
    group.rotation.y += delta * controls.rotationSpeed * 0.32;
    group.rotation.x = -0.1 + Math.sin(state.clock.elapsedTime * 0.19) * 0.045;
    const current = material.uniforms;
    current.uTime.value = state.clock.elapsedTime;
    current.uFacetScale.value = controls.facetScale;
    current.uGoldCoverage.value = controls.goldCoverage;
    current.uWaveAmplitude.value = controls.waveAmplitude;
    current.uWaveSpeed.value = controls.waveSpeed;
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[1.64, 64, 48]} />
        <meshPhysicalMaterial
          clearcoat={0.55}
          clearcoatRoughness={0.2}
          color="#050608"
          metalness={0.88}
          roughness={0.25}
        />
      </mesh>
      <mesh geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          ref={materialRef}
          fragmentShader={fragmentShader}
          side={THREE.DoubleSide}
          toneMapped={false}
          uniforms={uniforms}
          vertexShader={vertexShader}
        />
      </mesh>
    </group>
  );
}

export default function Demo028GoldParticleSphere() {
  const controls = useControls('Gold Particle Sphere', {
    triangleCount: {value: 1800, min: 700, max: 3000, step: 100, label: 'Triangle density'},
    facetScale: {value: 0.82, min: 0.58, max: 1, step: 0.01, label: 'Facet coverage'},
    goldCoverage: {value: 0.52, min: 0.15, max: 0.85, step: 0.01, label: 'Gold coverage'},
    waveAmplitude: {value: 0.07, min: 0, max: 0.16, step: 0.005, label: 'Surface lift'},
    waveSpeed: {value: 0.42, min: 0.08, max: 0.9, step: 0.01, label: 'Gold flow speed'},
    rotationSpeed: {value: 0.38, min: 0, max: 0.9, step: 0.01, label: 'Sphere rotation'},
  }) as GoldSphereControls;

  return (
    <DemoScene
      engineConfig={{
        background: '#030405',
        bloom: {intensity: 0.38, luminanceSmoothing: 0.5, luminanceThreshold: 0.72},
        camera: {position: [0, 0.15, 5.6], fov: 44, near: 0.1, far: 30},
        vignette: {darkness: 0.44, offset: 0.3},
      }}
      orbitConfig={{autoRotate: false, enablePan: false, minDistance: 4.2, maxDistance: 9}}
    >
      <ambientLight intensity={0.28} />
      <pointLight color="#ffe2a0" intensity={4.4} position={[2.8, 3.4, 4.2]} />
      <pointLight color="#49607d" intensity={1.2} position={[-3.2, -1.8, 2.4]} />
      <GoldTriangleSphere controls={controls} />
    </DemoScene>
  );
}
