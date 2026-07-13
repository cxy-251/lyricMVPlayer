import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type SdfControls = {
  shapeMorph: number;
  smoothUnion: number;
  twist: number;
  satelliteScale: number;
  rotationSpeed: number;
  roughness: number;
};

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

varying vec2 vUv;
uniform float uTime;
uniform float uAspect;
uniform float uShapeMorph;
uniform float uSmoothUnion;
uniform float uTwist;
uniform float uSatelliteScale;
uniform float uRotationSpeed;
uniform float uRoughness;
uniform vec2 uRotation;

mat2 rotate2d(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float smoothMinimum(float a, float b, float smoothing) {
  float h = clamp(0.5 + 0.5 * (b - a) / max(0.001, smoothing), 0.0, 1.0);
  return mix(b, a, h) - smoothing * h * (1.0 - h);
}

float roundedBox(vec3 point, vec3 halfSize, float radius) {
  vec3 q = abs(point) - halfSize + radius;
  return min(max(q.x, max(q.y, q.z)), 0.0) + length(max(q, 0.0)) - radius;
}

vec3 transformPoint(vec3 point) {
  point.xz *= rotate2d(uRotation.x + uTime * uRotationSpeed * 0.18);
  point.yz *= rotate2d(uRotation.y);
  point.xy *= rotate2d(point.z * uTwist * 0.42);
  return point;
}

float sceneDistance(vec3 worldPoint) {
  vec3 point = transformPoint(worldPoint);
  float sphere = length(point) - 0.92;
  float torus = length(vec2(length(point.xz) - 0.68, point.y)) - 0.29;
  float box = roundedBox(point, vec3(0.7), 0.2);
  float firstMorph = mix(sphere, torus, smoothstep(0.0, 0.5, uShapeMorph));
  float mainShape = mix(firstMorph, box, smoothstep(0.5, 1.0, uShapeMorph));

  vec3 satelliteA = point - vec3(cos(uTime * 0.72), sin(uTime * 0.54) * 0.42, sin(uTime * 0.72)) * 1.15;
  vec3 satelliteB = point - vec3(cos(uTime * 0.49 + 3.14), sin(uTime * 0.63) * 0.5, sin(uTime * 0.49 + 3.14)) * 1.08;
  float satellites = min(length(satelliteA) - 0.25 * uSatelliteScale, length(satelliteB) - 0.2 * uSatelliteScale);
  return smoothMinimum(mainShape, satellites, uSmoothUnion);
}

vec3 sceneNormal(vec3 point) {
  const float epsilon = 0.0015;
  vec2 h = vec2(epsilon, 0.0);
  return normalize(vec3(
    sceneDistance(point + h.xyy) - sceneDistance(point - h.xyy),
    sceneDistance(point + h.yxy) - sceneDistance(point - h.yxy),
    sceneDistance(point + h.yyx) - sceneDistance(point - h.yyx)
  ));
}

float softShadow(vec3 origin, vec3 direction) {
  float result = 1.0;
  float travel = 0.03;
  for (int step = 0; step < 32; step++) {
    float distanceToScene = sceneDistance(origin + direction * travel);
    result = min(result, 12.0 * distanceToScene / travel);
    travel += clamp(distanceToScene, 0.015, 0.16);
    if (distanceToScene < 0.001 || travel > 5.0) break;
  }
  return clamp(result, 0.0, 1.0);
}

float ambientOcclusion(vec3 point, vec3 normal) {
  float occlusion = 0.0;
  float weight = 1.0;
  for (int step = 1; step <= 5; step++) {
    float distanceFromSurface = 0.045 * float(step);
    occlusion += (distanceFromSurface - sceneDistance(point + normal * distanceFromSurface)) * weight;
    weight *= 0.58;
  }
  return clamp(1.0 - occlusion * 2.8, 0.0, 1.0);
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uAspect;
  vec3 rayOrigin = vec3(0.0, 0.0, 4.2);
  vec3 rayDirection = normalize(vec3(uv, -2.15));
  float travel = 0.0;
  float hitDistance = -1.0;
  for (int step = 0; step < 104; step++) {
    vec3 point = rayOrigin + rayDirection * travel;
    float distanceToScene = sceneDistance(point);
    if (distanceToScene < 0.0012) {
      hitDistance = travel;
      break;
    }
    travel += distanceToScene * 0.78;
    if (travel > 8.0) break;
  }

  vec3 background = mix(vec3(0.012, 0.018, 0.032), vec3(0.035, 0.012, 0.05), vUv.y);
  float halo = exp(-4.8 * length(uv));
  background += vec3(0.08, 0.14, 0.22) * halo;
  if (hitDistance < 0.0) {
    gl_FragColor = vec4(background, 1.0);
    return;
  }

  vec3 point = rayOrigin + rayDirection * hitDistance;
  vec3 normal = sceneNormal(point);
  vec3 viewDirection = -rayDirection;
  vec3 keyLight = normalize(vec3(-0.55, 0.72, 0.58));
  vec3 rimLight = normalize(vec3(0.72, -0.2, 0.54));
  float diffuse = max(dot(normal, keyLight), 0.0);
  float shadow = softShadow(point + normal * 0.006, keyLight);
  float ao = ambientOcclusion(point, normal);
  vec3 halfVector = normalize(keyLight + viewDirection);
  float specularPower = mix(92.0, 12.0, uRoughness);
  float specular = pow(max(dot(normal, halfVector), 0.0), specularPower);
  float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.2);
  float rim = pow(max(dot(normal, rimLight), 0.0), 3.0);

  float band = 0.5 + 0.5 * sin(point.y * 4.2 + point.x * 2.4 - uTime * 0.28);
  vec3 baseColor = mix(vec3(0.055, 0.32, 0.42), vec3(0.44, 0.08, 0.48), band);
  vec3 color = baseColor * (0.18 + diffuse * shadow * 0.82) * ao;
  color += vec3(0.68, 0.94, 1.0) * specular * mix(1.25, 0.42, uRoughness);
  color += vec3(0.08, 0.72, 0.95) * fresnel * 0.72;
  color += vec3(0.96, 0.22, 0.66) * rim * 0.24;
  float fog = smoothstep(3.3, 6.2, hitDistance);
  color = mix(color, background, fog * 0.5);
  gl_FragColor = vec4(color, 1.0);
}
`;

function SdfSculpture({controls}: {controls: SdfControls}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const draggingRef = useRef(false);
  const rotationRef = useRef(new THREE.Vector2(-0.35, -0.16));
  const previousPointerRef = useRef(new THREE.Vector2());
  const uniforms = useMemo(() => ({
    uTime: {value: 0}, uAspect: {value: 1}, uShapeMorph: {value: 0.3},
    uSmoothUnion: {value: 0.18}, uTwist: {value: 1}, uSatelliteScale: {value: 1},
    uRotationSpeed: {value: 0.2}, uRoughness: {value: 0.28}, uRotation: {value: new THREE.Vector2()},
  }), []);

  useEffect(() => {
    const release = () => {
      draggingRef.current = false;
    };
    window.addEventListener('pointerup', release);
    return () => window.removeEventListener('pointerup', release);
  }, []);

  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;
    if (draggingRef.current) {
      const deltaX = state.pointer.x - previousPointerRef.current.x;
      const deltaY = state.pointer.y - previousPointerRef.current.y;
      rotationRef.current.x += deltaX * 1.6;
      rotationRef.current.y += deltaY * 1.3;
    }
    previousPointerRef.current.copy(state.pointer);
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uAspect.value = state.size.width / Math.max(1, state.size.height);
    material.uniforms.uShapeMorph.value = controls.shapeMorph;
    material.uniforms.uSmoothUnion.value = controls.smoothUnion;
    material.uniforms.uTwist.value = controls.twist;
    material.uniforms.uSatelliteScale.value = controls.satelliteScale;
    material.uniforms.uRotationSpeed.value = controls.rotationSpeed;
    material.uniforms.uRoughness.value = controls.roughness;
    material.uniforms.uRotation.value.copy(rotationRef.current);
  });

  return (
    <mesh
      frustumCulled={false}
      onPointerDown={(event) => {
        event.stopPropagation();
        draggingRef.current = true;
        previousPointerRef.current.set(event.pointer.x, event.pointer.y);
      }}
    >
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={materialRef} depthTest={false} depthWrite={false} fragmentShader={fragmentShader} uniforms={uniforms} vertexShader={vertexShader} />
    </mesh>
  );
}

export default function Demo042ProbeDensityVisualControl() {
  const controls = useControls('SDF Sculpture', {
    shapeMorph: {value: 0.34, min: 0, max: 1, step: 0.01, label: 'Sphere → torus → box'},
    smoothUnion: {value: 0.2, min: 0.04, max: 0.42, step: 0.01, label: 'Smooth union'},
    twist: {value: 0.82, min: 0, max: 2.2, step: 0.01, label: 'Spatial twist'},
    satelliteScale: {value: 1, min: 0.45, max: 1.5, step: 0.01, label: 'Satellite bodies'},
    rotationSpeed: {value: 0.22, min: 0, max: 0.65, step: 0.01, label: 'Idle rotation'},
    roughness: {value: 0.26, min: 0.08, max: 0.62, step: 0.01, label: 'Surface roughness'},
  }) as SdfControls;

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#050714'}}>
      <DemoScene
        engineConfig={{background: '#050714', camera: {position: [0, 0, 1], fov: 50, near: 0.1, far: 10}}}
        orbitControls={false}
      >
        <SdfSculpture controls={controls} />
      </DemoScene>
      <div style={sdfLegendStyle}>
        <strong>SDF MORPHOLOGY</strong>
        <span>press + drag to rotate · 104 ray steps</span>
      </div>
    </div>
  );
}

const sdfLegendStyle = {
  position: 'absolute', left: 18, bottom: 18, display: 'grid', gap: 3,
  padding: '8px 10px', border: '1px solid rgba(95,209,255,0.2)', borderRadius: 6,
  background: 'rgba(5,7,20,0.78)', color: '#809eae', pointerEvents: 'none',
  fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 10,
} as const;
