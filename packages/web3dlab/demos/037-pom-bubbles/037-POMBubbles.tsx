import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type BubbleControls = {
  bubbleDensity: number;
  reliefDepth: number;
  viewResponse: number;
  surfaceMotion: number;
  rimStrength: number;
  iridescence: number;
};

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;

varying vec2 vUv;
uniform float uTime;
uniform float uBubbleDensity;
uniform float uReliefDepth;
uniform float uViewResponse;
uniform float uSurfaceMotion;
uniform float uRimStrength;
uniform float uIridescence;
uniform vec2 uPointer;
uniform vec2 uResolution;

vec2 hash2(vec2 point) {
  point = vec2(dot(point, vec2(127.1, 311.7)), dot(point, vec2(269.5, 183.3)));
  return fract(sin(point) * 43758.5453);
}

vec3 bubbleCell(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  float nearest = 8.0;
  float second = 8.0;
  float seedValue = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 seed = hash2(cell + offset);
      vec2 center = 0.5 + (seed - 0.5) * 0.38;
      center += sin(uTime * uSurfaceMotion + seed * 6.2831) * 0.045;
      float distanceToBubble = length(offset + center - local) / mix(0.82, 1.12, seed.x);
      if (distanceToBubble < nearest) {
        second = nearest;
        nearest = distanceToBubble;
        seedValue = seed.y;
      } else if (distanceToBubble < second) {
        second = distanceToBubble;
      }
    }
  }
  return vec3(nearest, second - nearest, seedValue);
}

float heightField(vec2 uv) {
  vec3 cell = bubbleCell(uv * uBubbleDensity);
  float radius = mix(0.37, 0.49, cell.z);
  float dome = sqrt(max(0.0, 1.0 - pow(cell.x / radius, 2.0)));
  float membrane = smoothstep(0.015, 0.11, cell.y) * 0.12;
  return clamp(dome + membrane, 0.0, 1.0);
}

vec2 parallaxOcclusion(vec2 uv, vec3 viewDirection, out float selfShadow) {
  const float layerCount = 28.0;
  float layerDepth = 1.0 / layerCount;
  vec2 deltaUv = viewDirection.xy / max(0.32, viewDirection.z) * uReliefDepth / layerCount;
  vec2 currentUv = uv;
  float rayDepth = 0.0;
  float sampledHeight = heightField(currentUv);
  for (int layer = 0; layer < 28; layer++) {
    if (rayDepth >= sampledHeight) break;
    currentUv -= deltaUv;
    rayDepth += layerDepth;
    sampledHeight = heightField(currentUv);
  }
  vec2 previousUv = currentUv + deltaUv;
  float afterDepth = sampledHeight - rayDepth;
  float beforeDepth = heightField(previousUv) - rayDepth + layerDepth;
  float weight = afterDepth / max(0.0001, afterDepth - beforeDepth);
  selfShadow = smoothstep(0.0, 0.34, rayDepth - sampledHeight + 0.08);
  return mix(currentUv, previousUv, clamp(weight, 0.0, 1.0));
}

void main() {
  vec2 pointer = vec2(uPointer.x * uResolution.x / max(1.0, uResolution.y), uPointer.y);
  vec3 viewDirection = normalize(vec3(pointer * uViewResponse, 1.0));
  float selfShadow = 0.0;
  vec2 uv = parallaxOcclusion(vUv, viewDirection, selfShadow);
  float height = heightField(uv);
  vec2 texel = vec2(0.0018, 0.0028);
  float left = heightField(uv - vec2(texel.x, 0.0));
  float right = heightField(uv + vec2(texel.x, 0.0));
  float down = heightField(uv - vec2(0.0, texel.y));
  float up = heightField(uv + vec2(0.0, texel.y));
  vec3 normal = normalize(vec3((left - right) * 7.5, (down - up) * 7.5, 0.3));
  vec3 lightDirection = normalize(vec3(-0.45, 0.58, 0.82));
  vec3 halfVector = normalize(lightDirection + viewDirection);
  float diffuse = max(dot(normal, lightDirection), 0.0);
  float specular = pow(max(dot(normal, halfVector), 0.0), 76.0);
  float broadSpecular = pow(max(dot(normal, halfVector), 0.0), 12.0);
  float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.5);
  vec3 cell = bubbleCell(uv * uBubbleDensity);
  float seam = 1.0 - smoothstep(0.025, 0.1, cell.y);

  vec3 deep = vec3(0.012, 0.018, 0.045);
  vec3 cyan = vec3(0.04, 0.46, 0.68);
  vec3 violet = vec3(0.34, 0.09, 0.56);
  float spectrum = 0.5 + 0.5 * sin(cell.z * 8.0 + normal.x * 2.4 + uTime * 0.12);
  vec3 body = mix(cyan, violet, spectrum * uIridescence);
  vec3 color = mix(deep, body, smoothstep(0.02, 0.72, height));
  color *= 0.28 + diffuse * 0.7;
  color *= 1.0 - selfShadow * 0.28;
  color += vec3(0.55, 0.92, 1.0) * broadSpecular * 0.24;
  color += vec3(1.0, 0.8, 0.48) * specular * 1.35;
  color += mix(vec3(0.18, 0.78, 1.0), vec3(0.78, 0.22, 1.0), spectrum) * fresnel * uRimStrength * 0.55;
  color += vec3(0.08, 0.42, 0.58) * seam * 0.22;
  float edgeMask = smoothstep(0.0, 0.025, vUv.x) * smoothstep(0.0, 0.025, vUv.y)
    * smoothstep(0.0, 0.025, 1.0 - vUv.x) * smoothstep(0.0, 0.025, 1.0 - vUv.y);
  gl_FragColor = vec4(color * edgeMask, 1.0);
}
`;

function POMSample({controls}: {controls: BubbleControls}) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: {value: 0},
    uBubbleDensity: {value: 8},
    uReliefDepth: {value: 0.12},
    uViewResponse: {value: 0.42},
    uSurfaceMotion: {value: 0.25},
    uRimStrength: {value: 0.8},
    uIridescence: {value: 0.7},
    uPointer: {value: new THREE.Vector2()},
    uResolution: {value: new THREE.Vector2(1, 1)},
  }), []);

  useFrame((state, delta) => {
    const material = materialRef.current;
    if (material) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
      material.uniforms.uBubbleDensity.value = controls.bubbleDensity;
      material.uniforms.uReliefDepth.value = controls.reliefDepth;
      material.uniforms.uViewResponse.value = controls.viewResponse;
      material.uniforms.uSurfaceMotion.value = controls.surfaceMotion;
      material.uniforms.uRimStrength.value = controls.rimStrength;
      material.uniforms.uIridescence.value = controls.iridescence;
      material.uniforms.uPointer.value.set(state.pointer.x, state.pointer.y);
      material.uniforms.uResolution.value.set(state.size.width, state.size.height);
    }
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, state.pointer.x * 0.16, 5, delta);
      groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, -state.pointer.y * 0.1 - 0.04, 5, delta);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, -0.035]}>
        <planeGeometry args={[5.44, 3.34]} />
        <meshStandardMaterial color="#070914" metalness={0.72} roughness={0.32} />
      </mesh>
      <mesh>
        <planeGeometry args={[5.28, 3.18]} />
        <shaderMaterial ref={materialRef} fragmentShader={fragmentShader} uniforms={uniforms} vertexShader={vertexShader} />
      </mesh>
    </group>
  );
}

export default function Demo037POMBubbles() {
  const controls = useControls('POM Bubble Relief', {
    bubbleDensity: {value: 8, min: 4.5, max: 12, step: 0.1, label: 'Bubble density'},
    reliefDepth: {value: 0.12, min: 0.035, max: 0.2, step: 0.005, label: 'Virtual depth'},
    viewResponse: {value: 0.42, min: 0.15, max: 0.68, step: 0.01, label: 'Parallax response'},
    surfaceMotion: {value: 0.25, min: 0, max: 0.58, step: 0.01, label: 'Membrane drift'},
    rimStrength: {value: 0.82, min: 0.3, max: 1.15, step: 0.01, label: 'Fresnel rim'},
    iridescence: {value: 0.72, min: 0, max: 1, step: 0.01, label: 'Iridescence'},
  }) as BubbleControls;

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#03040a'}}>
      <DemoScene
        engineConfig={{
          background: '#03040a',
          bloom: {intensity: 0.38, luminanceSmoothing: 0.55, luminanceThreshold: 0.62},
          camera: {position: [0, 0, 5.9], fov: 46, near: 0.1, far: 20},
          vignette: {darkness: 0.5, offset: 0.22},
        }}
        orbitControls={false}
      >
        <ambientLight intensity={0.45} />
        <pointLight color="#8de9ff" intensity={2.2} position={[-2.5, 3, 4]} />
        <POMSample controls={controls} />
      </DemoScene>
      <div style={sampleLabelStyle}>
        <strong>28-LAYER POM</strong>
        <span>one flat plane · virtual relief follows view angle</span>
      </div>
    </div>
  );
}

const sampleLabelStyle = {
  position: 'absolute', left: '50%', bottom: 18, display: 'flex', gap: 10, alignItems: 'center',
  transform: 'translateX(-50%)', padding: '8px 11px', border: '1px solid rgba(123,220,255,0.18)',
  borderRadius: 6, background: 'rgba(4,6,14,0.78)', color: '#8198ab', pointerEvents: 'none',
  fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 10,
} as const;
