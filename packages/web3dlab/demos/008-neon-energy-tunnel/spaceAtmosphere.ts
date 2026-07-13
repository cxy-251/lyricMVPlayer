import * as THREE from 'three';

import type {FlightPathData} from './flightPath';

const POINT_VERTEX_SHADER = `
  attribute float aSize;
  attribute float aPhase;
  uniform float uPixelRatio;
  uniform float uPointScale;
  varying float vPhase;
  varying vec3 vColor;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vPhase = aPhase;
    vColor = color;
    float distanceScale = clamp(uPointScale / max(12.0, -viewPosition.z), 0.62, 4.2);
    gl_PointSize = aSize * uPixelRatio * distanceScale;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const POINT_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uBrightness;
  uniform float uTwinkle;
  varying float vPhase;
  varying vec3 vColor;

  void main() {
    vec2 centered = gl_PointCoord - 0.5;
    float radius = length(centered) * 2.0;
    float alpha = 1.0 - smoothstep(0.28, 1.0, radius);
    float twinkle = mix(1.0, 0.62 + 0.38 * sin(uTime * 1.7 + vPhase), uTwinkle);
    float core = 1.0 - smoothstep(0.0, 0.3, radius);
    vec3 color = vColor * uBrightness * twinkle * (1.0 + core * 1.4);
    gl_FragColor = vec4(color, alpha * twinkle);
  }
`;

function createRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function createPointGeometry(count: number) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  return {colors, geometry, phases, positions, sizes};
}

export function createStarFieldGeometry(count: number, seed = 8128) {
  const random = createRandom(seed);
  const {colors, geometry, phases, positions, sizes} = createPointGeometry(count);
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const radius = THREE.MathUtils.lerp(220, 950, Math.pow(random(), 0.58));
    const azimuth = random() * Math.PI * 2;
    const vertical = random() * 2 - 1;
    const horizontal = Math.sqrt(1 - vertical * vertical);
    const positionOffset = index * 3;
    positions[positionOffset] = Math.cos(azimuth) * horizontal * radius;
    positions[positionOffset + 1] = vertical * radius;
    positions[positionOffset + 2] = Math.sin(azimuth) * horizontal * radius;

    const warmth = random();
    color.set(warmth > 0.82 ? '#ffd8be' : warmth < 0.18 ? '#b8d9ff' : '#f5f7ff');
    colors[positionOffset] = color.r;
    colors[positionOffset + 1] = color.g;
    colors[positionOffset + 2] = color.b;
    sizes[index] = THREE.MathUtils.lerp(0.7, 2.35, Math.pow(random(), 2.2));
    phases[index] = random() * Math.PI * 2;
  }

  geometry.computeBoundingSphere();
  return geometry;
}

export function createTunnelSparkGeometry({
  count,
  path,
  seed = 6208,
  tunnelRadius,
}: {
  count: number;
  path: FlightPathData;
  seed?: number;
  tunnelRadius: number;
}) {
  const random = createRandom(seed);
  const {colors, geometry, phases, positions, sizes} = createPointGeometry(count);
  const point = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const progress = random();
    const frameIndex = Math.min(path.segments, Math.floor(progress * path.segments));
    const angle = random() * Math.PI * 2;
    const radius = tunnelRadius * THREE.MathUtils.lerp(0.12, 0.95, Math.sqrt(random()));
    path.curve.getPointAt(progress, point);
    offset.copy(path.frames.normals[frameIndex]).multiplyScalar(Math.cos(angle) * radius);
    offset.addScaledVector(path.frames.binormals[frameIndex], Math.sin(angle) * radius);
    point.add(offset);

    const positionOffset = index * 3;
    positions[positionOffset] = point.x;
    positions[positionOffset + 1] = point.y;
    positions[positionOffset + 2] = point.z;
    color.set(random() > 0.78 ? '#ffe2bd' : '#f4f7ff');
    colors[positionOffset] = color.r;
    colors[positionOffset + 1] = color.g;
    colors[positionOffset + 2] = color.b;
    sizes[index] = THREE.MathUtils.lerp(0.4, 1.4, random());
    phases[index] = random() * Math.PI * 2;
  }

  geometry.computeBoundingSphere();
  return geometry;
}

export function createSpacePointMaterial({
  brightness,
  pixelRatio,
  pointScale,
  twinkle,
}: {
  brightness: number;
  pixelRatio: number;
  pointScale: number;
  twinkle: number;
}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBrightness: {value: brightness},
      uPixelRatio: {value: pixelRatio},
      uPointScale: {value: pointScale},
      uTime: {value: 0},
      uTwinkle: {value: twinkle},
    },
    vertexShader: POINT_VERTEX_SHADER,
    fragmentShader: POINT_FRAGMENT_SHADER,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}
