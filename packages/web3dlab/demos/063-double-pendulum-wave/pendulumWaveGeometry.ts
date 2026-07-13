import * as THREE from 'three';

import {MAX_TRAIL_SAMPLES, TrailRingBuffer} from './doublePendulumPhysics';

export const MAX_RIBBONS = 40;
export const MAX_PARTICLES = 48;

export interface RibbonGeometryParameters {
  lineWidth: number;
  ribbonCount: number;
  ribbonSpacing: number;
  trailLength: number;
  waveAmplitude: number;
  waveFrequency: number;
}

interface RibbonBuffers {
  position: Float32Array;
  side: Float32Array;
  progress: Float32Array;
  ribbon: Float32Array;
  speed: Float32Array;
  index: Uint16Array;
}

interface ParticleBuffers {
  position: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
}

export function createRibbonGeometry() {
  const vertexCapacity = MAX_RIBBONS * MAX_TRAIL_SAMPLES * 2;
  const buffers: RibbonBuffers = {
    position: new Float32Array(vertexCapacity * 3),
    side: new Float32Array(vertexCapacity),
    progress: new Float32Array(vertexCapacity),
    ribbon: new Float32Array(vertexCapacity),
    speed: new Float32Array(vertexCapacity),
    index: new Uint16Array(MAX_RIBBONS * (MAX_TRAIL_SAMPLES - 1) * 6),
  };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(buffers.position, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aSide', new THREE.BufferAttribute(buffers.side, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aProgress', new THREE.BufferAttribute(buffers.progress, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aRibbon', new THREE.BufferAttribute(buffers.ribbon, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(buffers.speed, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(new THREE.BufferAttribute(buffers.index, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 8);
  geometry.drawRange.count = 0;
  geometry.userData.pendulumWaveBuffers = buffers;
  return geometry;
}

export function updateRibbonGeometry(
  geometry: THREE.BufferGeometry,
  history: TrailRingBuffer,
  parameters: RibbonGeometryParameters,
  elapsedTime: number,
) {
  const buffers = geometry.userData.pendulumWaveBuffers as RibbonBuffers;
  const visibleCount = Math.min(history.size, Math.round(parameters.trailLength), MAX_TRAIL_SAMPLES);
  const ribbonCount = Math.min(MAX_RIBBONS, Math.max(1, Math.round(parameters.ribbonCount)));
  if (visibleCount < 2) {
    geometry.drawRange.count = 0;
    return 0;
  }

  const halfRibbonCount = Math.max(1, (ribbonCount - 1) * 0.5);
  let vertexCursor = 0;
  let indexCursor = 0;

  for (let ribbonIndex = 0; ribbonIndex < ribbonCount; ribbonIndex++) {
    const centeredRibbon = ribbonIndex - (ribbonCount - 1) * 0.5;
    const normalizedRibbon = centeredRibbon / halfRibbonCount;
    const sourceMix = 0.03 + Math.abs(normalizedRibbon) * 0.22;
    const ribbonVertexStart = vertexCursor;

    for (let sampleIndex = 0; sampleIndex < visibleCount; sampleIndex++) {
      const progress = sampleIndex / (visibleCount - 1);
      const historyIndex = history.indexAt(sampleIndex, visibleCount);
      const previousHistoryIndex = history.indexAt(Math.max(0, sampleIndex - 1), visibleCount);
      const nextHistoryIndex = history.indexAt(Math.min(visibleCount - 1, sampleIndex + 1), visibleCount);

      const baseX = history.x2[historyIndex] + (history.x1[historyIndex] - history.x2[historyIndex]) * sourceMix;
      const baseY = history.y2[historyIndex] + (history.y1[historyIndex] - history.y2[historyIndex]) * sourceMix;
      const previousX = history.x2[previousHistoryIndex] + (
        history.x1[previousHistoryIndex] - history.x2[previousHistoryIndex]
      ) * sourceMix;
      const previousY = history.y2[previousHistoryIndex] + (
        history.y1[previousHistoryIndex] - history.y2[previousHistoryIndex]
      ) * sourceMix;
      const nextX = history.x2[nextHistoryIndex] + (
        history.x1[nextHistoryIndex] - history.x2[nextHistoryIndex]
      ) * sourceMix;
      const nextY = history.y2[nextHistoryIndex] + (
        history.y1[nextHistoryIndex] - history.y2[nextHistoryIndex]
      ) * sourceMix;
      const tangentXRaw = nextX - previousX;
      const tangentYRaw = nextY - previousY;
      const tangentLength = Math.max(0.00001, Math.hypot(tangentXRaw, tangentYRaw));
      const tangentX = tangentXRaw / tangentLength;
      const tangentY = tangentYRaw / tangentLength;
      const normalX = -tangentY;
      const normalY = tangentX;
      const envelope = 0.2 + 0.8 * Math.pow(Math.sin(progress * Math.PI), 0.72);
      const phase = progress * parameters.waveFrequency * Math.PI * 2
        + ribbonIndex * 0.49 + elapsedTime * 0.42;
      const waveFactor = 1 + Math.sin(phase) * parameters.waveAmplitude;
      const normalOffset = centeredRibbon * parameters.ribbonSpacing * envelope * waveFactor;
      const weaveOffset = Math.sin(phase * 0.53 + centeredRibbon * 0.31)
        * parameters.ribbonSpacing * 0.42 * envelope;
      const bowlLift = Math.abs(normalizedRibbon) * Math.abs(normalizedRibbon)
        * parameters.ribbonSpacing * ribbonCount * 0.15 * (0.25 + progress * 0.75);
      const centerX = baseX + normalX * normalOffset + tangentX * weaveOffset;
      const centerY = baseY + normalY * normalOffset + tangentY * weaveOffset + bowlLift;
      const localWidth = parameters.lineWidth * (
        0.82 + 0.24 * Math.min(1, history.speed[historyIndex]) + history.curvature[historyIndex] * 0.18
      );

      for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
        const side = sideIndex === 0 ? -1 : 1;
        const positionOffset = vertexCursor * 3;
        buffers.position[positionOffset] = centerX + normalX * localWidth * side;
        buffers.position[positionOffset + 1] = centerY + normalY * localWidth * side;
        buffers.position[positionOffset + 2] = -0.008 * Math.abs(normalizedRibbon);
        buffers.side[vertexCursor] = side;
        buffers.progress[vertexCursor] = progress;
        buffers.ribbon[vertexCursor] = ribbonIndex;
        buffers.speed[vertexCursor] = history.speed[historyIndex];
        vertexCursor += 1;
      }
    }

    for (let sampleIndex = 0; sampleIndex < visibleCount - 1; sampleIndex++) {
      const a = ribbonVertexStart + sampleIndex * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      buffers.index[indexCursor++] = a;
      buffers.index[indexCursor++] = b;
      buffers.index[indexCursor++] = c;
      buffers.index[indexCursor++] = b;
      buffers.index[indexCursor++] = d;
      buffers.index[indexCursor++] = c;
    }
  }

  for (const attributeName of ['position', 'aSide', 'aProgress', 'aRibbon', 'aSpeed']) {
    (geometry.getAttribute(attributeName) as THREE.BufferAttribute).needsUpdate = true;
  }
  if (geometry.index) geometry.index.needsUpdate = true;
  geometry.setDrawRange(0, indexCursor);
  return vertexCursor;
}

export function createParticleGeometry() {
  const buffers: ParticleBuffers = {
    position: new Float32Array(MAX_PARTICLES * 3),
    size: new Float32Array(MAX_PARTICLES),
    alpha: new Float32Array(MAX_PARTICLES),
  };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(buffers.position, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(buffers.size, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(buffers.alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 8);
  geometry.drawRange.count = 0;
  geometry.userData.pendulumParticleBuffers = buffers;
  return geometry;
}

export function updateParticleGeometry(
  geometry: THREE.BufferGeometry,
  history: TrailRingBuffer,
  particleCountValue: number,
  trailLength: number,
  elapsedTime: number,
) {
  const buffers = geometry.userData.pendulumParticleBuffers as ParticleBuffers;
  const visibleCount = Math.min(history.size, Math.round(trailLength), MAX_TRAIL_SAMPLES);
  const particleCount = Math.min(MAX_PARTICLES, Math.max(0, Math.round(particleCountValue)));
  if (visibleCount < 2 || particleCount === 0) {
    geometry.drawRange.count = 0;
    return;
  }

  for (let particleIndex = 0; particleIndex < particleCount; particleIndex++) {
    const speed = 0.035 + (particleIndex % 7) * 0.006;
    const progress = (particleIndex / particleCount + elapsedTime * speed) % 1;
    const logicalIndex = Math.min(visibleCount - 1, Math.floor(progress * (visibleCount - 1)));
    const historyIndex = history.indexAt(logicalIndex, visibleCount);
    const previousIndex = history.indexAt(Math.max(0, logicalIndex - 1), visibleCount);
    const nextIndex = history.indexAt(Math.min(visibleCount - 1, logicalIndex + 1), visibleCount);
    const tangentX = history.x2[nextIndex] - history.x2[previousIndex];
    const tangentY = history.y2[nextIndex] - history.y2[previousIndex];
    const tangentLength = Math.max(0.00001, Math.hypot(tangentX, tangentY));
    const lane = ((particleIndex % 5) - 2) * 0.012;
    const offset = particleIndex * 3;
    buffers.position[offset] = history.x2[historyIndex] - tangentY / tangentLength * lane;
    buffers.position[offset + 1] = history.y2[historyIndex] + tangentX / tangentLength * lane;
    buffers.position[offset + 2] = 0.045;
    buffers.size[particleIndex] = 5.5 + (particleIndex % 4) * 1.15;
    buffers.alpha[particleIndex] = 0.42 + history.curvature[historyIndex] * 0.58;
  }

  (geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  (geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
  (geometry.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
  geometry.setDrawRange(0, particleCount);
}
