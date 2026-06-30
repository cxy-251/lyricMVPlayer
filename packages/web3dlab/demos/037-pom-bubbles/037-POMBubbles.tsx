import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type BubbleControls = {
  cellScale: number;
  depth: number;
  speed: number;
  colorShift: number;
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
uniform float uCellScale;
uniform float uDepth;
uniform float uSpeed;
uniform float uColorShift;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float voronoi(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      o = 0.5 + 0.5 * sin(uTime * uSpeed + 6.2831 * o);
      vec2 r = g + o - f;
      md = min(md, dot(r, r));
    }
  }
  return sqrt(md);
}

void main() {
  vec2 uv = vUv;
  vec2 centered = uv * 2.0 - 1.0;
  vec2 parallax = centered * uDepth * 0.16;
  float v1 = voronoi((uv + parallax) * uCellScale);
  float v2 = voronoi((uv - parallax * 0.45 + vec2(0.07, -0.03)) * (uCellScale * 1.6));
  float bubble = smoothstep(0.34, 0.1, v1) + smoothstep(0.18, 0.04, v2) * 0.55;
  float rim = smoothstep(0.12, 0.03, abs(v1 - 0.28));
  float highlight = pow(max(0.0, 1.0 - length(centered - vec2(-0.32, 0.34))), 6.0);
  vec3 base = mix(vec3(0.02, 0.01, 0.035), vec3(0.16, 0.05, 0.24), bubble);
  vec3 color = base + rim * vec3(0.35 + uColorShift, 0.9, 1.0 - uColorShift * 0.35) + highlight * vec3(1.0, 0.86, 0.62);
  float vignette = smoothstep(1.35, 0.2, length(centered));
  gl_FragColor = vec4(color * vignette, 1.0);
}
`;

function POMBubblesPlane({controls}: {controls: BubbleControls}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: {value: 0},
    uCellScale: {value: controls.cellScale},
    uDepth: {value: controls.depth},
    uSpeed: {value: controls.speed},
    uColorShift: {value: controls.colorShift},
  }), []);

  useFrame((state) => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uCellScale.value = controls.cellScale;
    u.uDepth.value = controls.depth;
    u.uSpeed.value = controls.speed;
    u.uColorShift.value = controls.colorShift;
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={materialRef} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} depthWrite={false} />
    </mesh>
  );
}

export default function Demo037POMBubbles() {
  const controls = useControls('POM Bubbles', {
    cellScale: {value: 10.5, min: 4, max: 22, step: 0.1},
    depth: {value: 0.82, min: 0, max: 1.8, step: 0.01},
    speed: {value: 0.48, min: 0, max: 1.8, step: 0.01},
    colorShift: {value: 0.18, min: 0, max: 0.8, step: 0.01},
  }) as BubbleControls;

  return (
    <DemoScene
      engineConfig={{background: '#030209', camera: {position: [0, 0, 1], fov: 50, near: 0.1, far: 10}}}
      orbitControls={false}
    >
      <POMBubblesPlane controls={controls} />
    </DemoScene>
  );
}
