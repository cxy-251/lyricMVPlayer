import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

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
uniform vec2 uPointer;
uniform float uWarp;
uniform float uLineDensity;
uniform float uSpeed;
uniform float uNeon;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    value += noise(p) * amp;
    p = mat2(1.72, 1.03, -1.03, 1.72) * p + 0.13;
    amp *= 0.52;
  }
  return value;
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  vec2 pointer = uPointer * 0.75;
  float t = uTime * uSpeed;

  vec2 q = uv;
  q += vec2(fbm(q * 1.7 + t * 0.18), fbm(q * 1.9 - t * 0.16)) * uWarp;
  q += normalize(uv - pointer + 0.0001) * exp(-length(uv - pointer) * 2.4) * 0.22;

  float field = fbm(q * 2.4 + vec2(t * 0.2, -t * 0.12));
  field += 0.5 * sin((q.x + q.y) * uLineDensity + t * 2.0);
  field += 0.35 * sin(length(q - pointer) * 16.0 - t * 3.0);

  float bands = smoothstep(0.46, 0.5, abs(sin(field * 4.4)));
  float glow = pow(1.0 - abs(fract(field * 2.0) - 0.5) * 2.0, 5.0);
  float core = exp(-length(uv - pointer) * 3.0);

  vec3 color = mix(uColorA, uColorB, smoothstep(-0.2, 1.0, field));
  color = mix(color, uColorC, bands * 0.62 + core * 0.35);
  color += (glow + core * 0.8) * uNeon * vec3(0.42, 0.9, 1.0);
  color *= 0.18 + bands * 0.85 + glow * 0.95;
  color += vec3(0.012, 0.016, 0.032);

  float vignette = smoothstep(1.35, 0.25, length(uv));
  gl_FragColor = vec4(color * vignette, 1.0);
}
`;

function FluidNeonPlane({controls}: {controls: any}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: {value: 0},
      uPointer: {value: new THREE.Vector2(0, 0)},
      uWarp: {value: controls.warp},
      uLineDensity: {value: controls.lineDensity},
      uSpeed: {value: controls.speed},
      uNeon: {value: controls.neon},
      uColorA: {value: new THREE.Color(controls.colorA)},
      uColorB: {value: new THREE.Color(controls.colorB)},
      uColorC: {value: new THREE.Color(controls.colorC)},
    }),
    [],
  );

  useFrame((state) => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uPointer.value.set(state.pointer.x, state.pointer.y);
    u.uWarp.value = controls.warp;
    u.uLineDensity.value = controls.lineDensity;
    u.uSpeed.value = controls.speed;
    u.uNeon.value = controls.neon;
    u.uColorA.value.set(controls.colorA);
    u.uColorB.value.set(controls.colorB);
    u.uColorC.value.set(controls.colorC);
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function Demo027FluidNeonShader() {
  const controls = useControls('Fluid Neon Shader', {
    speed: {value: 0.62, min: 0, max: 2, step: 0.01},
    warp: {value: 0.38, min: 0, max: 1.4, step: 0.01},
    lineDensity: {value: 7.4, min: 2, max: 18, step: 0.1},
    neon: {value: 1.05, min: 0, max: 2.5, step: 0.01},
    colorA: '#4217ff',
    colorB: '#ff3bd5',
    colorC: '#34f5ff',
  });

  return (
    <DemoScene
      engineConfig={{
        background: '#02030a',
        camera: {position: [0, 0, 1], fov: 50, near: 0.1, far: 10},
      }}
      orbitControls={false}
    >
      <FluidNeonPlane controls={controls} />
    </DemoScene>
  );
}
