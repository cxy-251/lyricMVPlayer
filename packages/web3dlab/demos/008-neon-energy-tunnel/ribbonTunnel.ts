import * as THREE from 'three';

import type {FlightPathData} from './flightPath';

export type RailPaletteName = 'Original Neon' | 'Cool Plasma' | 'Solar Spectrum';

const PALETTES: Record<RailPaletteName, string[]> = {
  'Original Neon': ['#ff3d91', '#ff9f43', '#ffe066', '#4de8ff', '#806cff', '#40e6a1'],
  'Cool Plasma': ['#45f0d1', '#3cc9ff', '#697cff', '#c45cff', '#70ff9b'],
  'Solar Spectrum': ['#ff4d4d', '#ff8736', '#ffd45c', '#fff0ae', '#ff5f9e'],
};

const RIBBON_VERTEX_SHADER = `
  attribute float aSide;
  attribute float aPath;
  attribute float aPhase;
  varying float vSide;
  varying float vPath;
  varying float vPhase;
  varying vec3 vColor;

  void main() {
    vSide = aSide;
    vPath = aPath;
    vPhase = aPhase;
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RIBBON_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uGlow;
  uniform float uPulseSpeed;
  varying float vSide;
  varying float vPath;
  varying float vPhase;
  varying vec3 vColor;

  void main() {
    float across = clamp(1.0 - abs(vSide), 0.0, 1.0);
    float core = pow(across, 2.3);
    float halo = pow(across, 0.46);
    float finePulse = 0.5 + 0.5 * sin(vPath * 1320.0 - uTime * 8.4 * uPulseSpeed + vPhase);
    float longPulse = 0.5 + 0.5 * sin(vPath * 76.0 - uTime * 2.2 * uPulseSpeed + vPhase * 1.7);
    float pulse = 0.42 + finePulse * 0.2 + longPulse * 0.62;
    float intensity = (core * 2.0 + halo * 0.42) * pulse * uGlow;
    vec3 color = vColor * intensity;
    float alpha = clamp((core * 0.82 + halo * 0.3) * pulse, 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`;

const colorForRibbon = (palette: RailPaletteName, index: number, count: number) => {
  const colors = PALETTES[palette];
  const scaled = index / Math.max(1, count) * colors.length;
  const firstIndex = Math.floor(scaled) % colors.length;
  const secondIndex = (firstIndex + 1) % colors.length;
  return new THREE.Color(colors[firstIndex]).lerp(
    new THREE.Color(colors[secondIndex]),
    scaled - Math.floor(scaled),
  );
};

export function createRibbonTunnelGeometry({
  path,
  palette,
  ribbonCount,
  ribbonWidth,
  tunnelRadius,
  weave,
}: {
  path: FlightPathData;
  palette: RailPaletteName;
  ribbonCount: number;
  ribbonWidth: number;
  tunnelRadius: number;
  weave: number;
}) {
  const samplesPerRibbon = path.segments + 1;
  const vertexCount = ribbonCount * samplesPerRibbon * 2;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const sides = new Float32Array(vertexCount);
  const pathPositions = new Float32Array(vertexCount);
  const phases = new Float32Array(vertexCount);
  const indices = new Uint32Array(ribbonCount * path.segments * 6);
  const point = new THREE.Vector3();
  const radial = new THREE.Vector3();
  const lateral = new THREE.Vector3();
  const center = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  let vertexCursor = 0;
  let indexCursor = 0;

  for (let ribbonIndex = 0; ribbonIndex < ribbonCount; ribbonIndex += 1) {
    const baseAngle = ribbonIndex / ribbonCount * Math.PI * 2;
    const phase = ribbonIndex * 2.399963229728653;
    const color = colorForRibbon(palette, ribbonIndex, ribbonCount);
    const frequency = 2 + ribbonIndex % 5;

    for (let sampleIndex = 0; sampleIndex <= path.segments; sampleIndex += 1) {
      const progress = sampleIndex / path.segments;
      const angle = baseAngle
        + Math.sin(progress * Math.PI * 2 * frequency + phase) * weave
        + Math.sin(progress * Math.PI * 22 + phase * 0.7) * weave * 0.12;
      const ripple = 1 + Math.sin(progress * Math.PI * 26 + phase) * 0.015;
      path.curve.getPointAt(progress % 1, point);
      radial.copy(path.frames.normals[sampleIndex]).multiplyScalar(Math.cos(angle));
      radial.addScaledVector(path.frames.binormals[sampleIndex], Math.sin(angle));
      lateral.copy(path.frames.normals[sampleIndex]).multiplyScalar(-Math.sin(angle));
      lateral.addScaledVector(path.frames.binormals[sampleIndex], Math.cos(angle));
      center.copy(point).addScaledVector(radial, tunnelRadius * ripple);

      for (const side of [-1, 1]) {
        vertex.copy(center).addScaledVector(lateral, ribbonWidth * side * 0.5);
        const positionOffset = vertexCursor * 3;
        positions[positionOffset] = vertex.x;
        positions[positionOffset + 1] = vertex.y;
        positions[positionOffset + 2] = vertex.z;
        colors[positionOffset] = color.r;
        colors[positionOffset + 1] = color.g;
        colors[positionOffset + 2] = color.b;
        sides[vertexCursor] = side;
        pathPositions[vertexCursor] = progress;
        phases[vertexCursor] = phase;
        vertexCursor += 1;
      }
    }

    const ribbonVertexStart = ribbonIndex * samplesPerRibbon * 2;
    for (let segmentIndex = 0; segmentIndex < path.segments; segmentIndex += 1) {
      const current = ribbonVertexStart + segmentIndex * 2;
      const next = current + 2;
      indices[indexCursor++] = current;
      indices[indexCursor++] = current + 1;
      indices[indexCursor++] = next;
      indices[indexCursor++] = next;
      indices[indexCursor++] = current + 1;
      indices[indexCursor++] = next + 1;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSide', new THREE.BufferAttribute(sides, 1));
  geometry.setAttribute('aPath', new THREE.BufferAttribute(pathPositions, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createRibbonTunnelMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: {value: 0},
      uGlow: {value: 1},
      uPulseSpeed: {value: 1},
    },
    vertexShader: RIBBON_VERTEX_SHADER,
    fragmentShader: RIBBON_FRAGMENT_SHADER,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}
