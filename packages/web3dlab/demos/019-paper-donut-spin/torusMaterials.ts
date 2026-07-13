import * as THREE from 'three';

import type {StreamlineData} from './torusDynamics';

const STREAMLINE_VERTEX_SHADER = `
  attribute float aPathT;
  attribute float aSeed;
  attribute float aSpeed;
  attribute float aRadius;
  attribute float aIntensity;
  varying float vPathT;
  varying float vSeed;
  varying float vSpeed;
  varying float vRadius;
  varying float vIntensity;
  varying float vViewDepth;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vPathT = aPathT;
    vSeed = aSeed;
    vSpeed = aSpeed;
    vRadius = aRadius;
    vIntensity = aIntensity;
    vViewDepth = -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const STREAMLINE_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uFlowSpeed;
  uniform float uTrailLength;
  uniform float uHeadWidth;
  uniform float uOpacity;
  uniform float uColorMode;
  varying float vPathT;
  varying float vSeed;
  varying float vSpeed;
  varying float vRadius;
  varying float vIntensity;
  varying float vViewDepth;

  void main() {
    float phase = fract(vPathT - uTime * uFlowSpeed + vSeed);
    float headWidth = max(0.006, uHeadWidth);
    float head = exp(-pow(phase / headWidth, 2.0));
    head += exp(-pow((phase - 1.0) / headWidth, 2.0));
    float trail = 1.0 - smoothstep(0.0, max(0.02, uTrailLength), phase);
    float pulse = 0.9 + 0.1 * sin(uTime * 1.8 + vSeed * 36.0);
    float depthFade = 1.0 - smoothstep(7.0, 18.0, vViewDepth);
    float alpha = (0.08 + trail * 0.62 + head * 1.35)
      * pulse * uOpacity * vIntensity * mix(0.68, 1.0, depthFade);

    vec3 cool = vec3(0.16, 0.58, 0.72);
    vec3 cyanWhite = vec3(0.78, 0.98, 1.0);
    vec3 velocityColor = mix(cool, cyanWhite, smoothstep(0.08, 0.9, vSpeed));
    vec3 radiusColor = mix(vec3(0.8, 1.0, 0.96), vec3(0.22, 0.62, 0.82), vRadius);
    vec3 color = velocityColor;
    if (uColorMode > 0.5 && uColorMode < 1.5) color = radiusColor;
    if (uColorMode > 1.5) color = vec3(0.74, 0.94, 1.0);
    color *= 0.62 + head * 1.8 + trail * 0.42;

    if (alpha < 0.012) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

const FRESNEL_VERTEX_SHADER = `
  varying vec3 vNormalW;
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FRESNEL_FRAGMENT_SHADER = `
  uniform float uOpacity;
  varying vec3 vNormalW;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - abs(dot(normalize(vNormalW), viewDirection)), 2.35);
    vec3 color = mix(vec3(0.01, 0.08, 0.1), vec3(0.18, 0.9, 1.0), fresnel);
    gl_FragColor = vec4(color, fresnel * uOpacity);
  }
`;

export function createStreamlineGeometry(data: StreamlineData) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('aPathT', new THREE.BufferAttribute(data.pathPositions, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(data.seeds, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(data.speeds, 1));
  geometry.setAttribute('aRadius', new THREE.BufferAttribute(data.radii, 1));
  geometry.setAttribute('aIntensity', new THREE.BufferAttribute(data.intensities, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createStreamlineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColorMode: {value: 0},
      uFlowSpeed: {value: 0.08},
      uHeadWidth: {value: 0.035},
      uOpacity: {value: 0.5},
      uTime: {value: 0},
      uTrailLength: {value: 0.22},
    },
    vertexShader: STREAMLINE_VERTEX_SHADER,
    fragmentShader: STREAMLINE_FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}

export function createFresnelMaterial(opacity: number) {
  return new THREE.ShaderMaterial({
    uniforms: {uOpacity: {value: opacity}},
    vertexShader: FRESNEL_VERTEX_SHADER,
    fragmentShader: FRESNEL_FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}
