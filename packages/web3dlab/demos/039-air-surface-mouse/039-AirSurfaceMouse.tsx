import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type AirSurfaceControls = {
  refraction: number;
  rippleStrength: number;
  gridScale: number;
  speed: number;
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
uniform vec2 uPointer;
uniform float uRefraction;
uniform float uRippleStrength;
uniform float uGridScale;
uniform float uSpeed;
uniform float uInteraction;
uniform float uAspect;

float grid(vec2 uv) {
  vec2 g = abs(fract(uv) - 0.5);
  float line = min(g.x, g.y);
  return 1.0 - smoothstep(0.0, 0.025, line);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  vec2 pointer = uPointer;
  vec2 delta = uv - pointer;
  delta.x *= uAspect;
  float d = length(delta);
  float t = uTime * uSpeed;
  float ripple = sin(d * 32.0 - t * 6.0) * exp(-d * 3.2) * uRippleStrength * uInteraction;
  vec2 normalLike = normalize(uv - pointer + 0.0001) * ripple;
  vec2 refracted = uv + normalLike * uRefraction + vec2(sin(uv.y * 8.0 + t), cos(uv.x * 7.0 - t)) * 0.012;

  float g1 = grid(refracted * uGridScale);
  float g2 = grid(refracted * uGridScale * 0.5 + 0.25);
  float membrane = (1.0 - smoothstep(0.08, 0.95, d)) * 0.45 * uInteraction + abs(ripple) * 1.4;
  float rim = pow(1.0 - abs(uv.x * 0.12 + uv.y * 0.08), 2.0);
  vec3 base = vec3(0.015, 0.022, 0.032);
  vec3 color = base + vec3(0.32, 0.86, 1.0) * (g1 * 0.28 + g2 * 0.12 + membrane * 0.42);
  color += vec3(1.0, 0.92, 0.72) * pow(max(0.0, ripple), 2.0) * 2.2;
  color += rim * vec3(0.02, 0.04, 0.055);
  float vignette = 1.0 - smoothstep(0.2, 1.45, length(uv));
  gl_FragColor = vec4(color * vignette, 1.0);
}
`;

function AirSurfacePlane({controls}: {controls: AirSurfaceControls}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const previousPointerRef = useRef(new THREE.Vector2());
  const currentPointerRef = useRef(new THREE.Vector2());
  const interactionRef = useRef(0);
  const uniforms = useMemo(() => ({
    uTime: {value: 0},
    uPointer: {value: new THREE.Vector2(0, 0)},
    uRefraction: {value: controls.refraction},
    uRippleStrength: {value: controls.rippleStrength},
    uGridScale: {value: controls.gridScale},
    uSpeed: {value: controls.speed},
    uInteraction: {value: 0},
    uAspect: {value: 1},
  }), []);

  useFrame((state, delta) => {
    if (!materialRef.current) return;
    const pointer = currentPointerRef.current.set(state.pointer.x, state.pointer.y);
    const velocity = pointer.distanceTo(previousPointerRef.current) / Math.max(delta, 0.001);
    previousPointerRef.current.copy(pointer);
    interactionRef.current = THREE.MathUtils.damp(
      interactionRef.current,
      Math.min(1, velocity * 0.08),
      velocity > 0.08 ? 14 : 4.5,
      delta,
    );
    const u = materialRef.current.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uPointer.value.set(state.pointer.x, state.pointer.y);
    u.uRefraction.value = controls.refraction;
    u.uRippleStrength.value = controls.rippleStrength;
    u.uGridScale.value = controls.gridScale;
    u.uSpeed.value = controls.speed;
    u.uInteraction.value = interactionRef.current;
    u.uAspect.value = state.size.width / Math.max(1, state.size.height);
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={materialRef} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} depthWrite={false} />
    </mesh>
  );
}

export default function Demo039AirSurfaceMouse() {
  const controls = useControls('Air Surface Mouse', {
    refraction: {value: 0.72, min: 0.15, max: 1.2, step: 0.01, label: 'Refraction offset'},
    rippleStrength: {value: 0.42, min: 0.12, max: 0.8, step: 0.01, label: 'Membrane force'},
    gridScale: {value: 9.5, min: 5, max: 16, step: 0.1, label: 'Reference grid'},
    speed: {value: 0.7, min: 0.2, max: 1.3, step: 0.01, label: 'Wave propagation'},
  }) as AirSurfaceControls;

  return (
    <DemoScene
      engineConfig={{background: '#02050a', camera: {position: [0, 0, 1], fov: 50, near: 0.1, far: 10}}}
      orbitControls={false}
    >
      <AirSurfacePlane controls={controls} />
    </DemoScene>
  );
}
