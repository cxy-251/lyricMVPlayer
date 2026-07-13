import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type MetaballControls = {
  blobCount: number;
  cohesion: number;
  glow: number;
  flowSpeed: number;
  mergeSoftness: number;
};

type Blob = {
  phase: number;
  position: THREE.Vector2;
  radius: number;
  velocity: THREE.Vector2;
};

const MAX_BLOBS = 12;

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
uniform float uAspect;
uniform float uTime;
uniform float uGlow;
uniform float uMergeSoftness;
uniform int uBlobCount;
uniform vec4 uBlobs[${MAX_BLOBS}];

float roundedBox(vec2 point, vec2 halfSize, float radius) {
  vec2 q = abs(point) - halfSize + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}

float liquidField(vec2 point) {
  float field = 0.0;
  for (int index = 0; index < ${MAX_BLOBS}; index++) {
    if (index >= uBlobCount) continue;
    vec2 delta = point - uBlobs[index].xy;
    field += uBlobs[index].z * uBlobs[index].z / (dot(delta, delta) + 0.0012);
  }
  return field;
}

void main() {
  vec2 point = (vUv - 0.5) * vec2(uAspect, 1.0);
  float shellDistance = roundedBox(point, vec2(0.292, 0.462), 0.072);
  float screenDistance = roundedBox(point, vec2(0.265, 0.435), 0.058);
  float shell = 1.0 - smoothstep(-0.002, 0.004, shellDistance);
  float screen = 1.0 - smoothstep(-0.002, 0.004, screenDistance);

  vec3 background = mix(vec3(0.006, 0.009, 0.015), vec3(0.018, 0.028, 0.04), 1.0 - length(point) * 0.55);
  float rim = smoothstep(0.018, -0.006, shellDistance) - smoothstep(0.002, -0.02, screenDistance);
  vec3 shellColor = mix(vec3(0.025, 0.028, 0.038), vec3(0.18, 0.2, 0.24), rim);
  vec3 screenColor = mix(vec3(0.004, 0.004, 0.012), vec3(0.014, 0.008, 0.028), vUv.y);

  float field = liquidField(point);
  float threshold = 0.94 - uMergeSoftness * 0.16;
  float liquid = smoothstep(threshold - 0.07, threshold + 0.07, field) * screen;
  float outerGlow = smoothstep(threshold - 0.48, threshold - 0.05, field) * (1.0 - liquid) * screen;
  float epsilon = 0.0028;
  vec2 gradient = vec2(
    liquidField(point + vec2(epsilon, 0.0)) - liquidField(point - vec2(epsilon, 0.0)),
    liquidField(point + vec2(0.0, epsilon)) - liquidField(point - vec2(0.0, epsilon))
  );
  vec3 normal = normalize(vec3(-gradient * 0.22, 1.0));
  vec3 lightDirection = normalize(vec3(-0.5, 0.72, 0.8));
  float highlight = pow(max(dot(normal, lightDirection), 0.0), 18.0);
  float edge = smoothstep(0.0, 0.12, abs(field - threshold));
  edge = 1.0 - edge;

  float flow = 0.5 + 0.5 * sin(point.y * 8.0 - point.x * 5.0 + uTime * 0.34);
  vec3 cyan = vec3(0.04, 0.65, 0.95);
  vec3 magenta = vec3(0.96, 0.08, 0.52);
  vec3 liquidColor = mix(magenta, cyan, clamp(point.y + 0.55 + flow * 0.18, 0.0, 1.0));
  liquidColor *= 0.52 + min(field, 2.2) * 0.24;
  liquidColor += vec3(1.0, 0.72, 0.9) * highlight * 0.9;
  liquidColor += vec3(0.45, 0.9, 1.0) * edge * 0.3;

  vec3 color = background;
  color = mix(color, shellColor, shell);
  color = mix(color, screenColor, screen);
  color += mix(magenta, cyan, flow) * outerGlow * uGlow * 0.34;
  color = mix(color, liquidColor, liquid);
  float glass = smoothstep(0.72, 0.0, abs(point.x + point.y * 0.18 + 0.17)) * screen * 0.055;
  color += glass;
  gl_FragColor = vec4(color, 1.0);
}
`;

const createBlobs = (): Blob[] => Array.from({length: MAX_BLOBS}, (_, index) => {
  const t = index / (MAX_BLOBS - 1);
  return {
    phase: index * 1.71,
    position: new THREE.Vector2(Math.sin(index * 2.1) * 0.08, 0.32 - t * 0.64),
    radius: 0.072 + ((index * 7) % 5) * 0.008,
    velocity: new THREE.Vector2(),
  };
});

function LiquidPhone({controls}: {controls: MetaballControls}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const draggingRef = useRef(false);
  const blobsRef = useRef(createBlobs());
  const uniforms = useMemo(() => ({
    uAspect: {value: 1},
    uTime: {value: 0},
    uGlow: {value: 1},
    uMergeSoftness: {value: 0.5},
    uBlobCount: {value: 8},
    uBlobs: {value: Array.from({length: MAX_BLOBS}, () => new THREE.Vector4())},
  }), []);

  useEffect(() => {
    const release = () => {
      draggingRef.current = false;
    };
    window.addEventListener('pointerup', release);
    return () => window.removeEventListener('pointerup', release);
  }, []);

  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;
    const dt = Math.min(delta, 0.035);
    const time = state.clock.elapsedTime;
    const aspect = state.size.width / Math.max(1, state.size.height);
    const pointer = new THREE.Vector2(state.pointer.x * aspect * 0.5, state.pointer.y * 0.5);
    const count = Math.round(controls.blobCount);
    const damping = Math.exp(-(2.6 + controls.cohesion * 2.4) * dt);

    blobsRef.current.forEach((blob, index) => {
      const t = count === 1 ? 0.5 : index / Math.max(1, count - 1);
      const target = new THREE.Vector2(
        Math.sin(time * controls.flowSpeed * 0.62 + blob.phase) * 0.105,
        0.32 - t * 0.64 + Math.sin(time * controls.flowSpeed + blob.phase * 0.7) * 0.025,
      );
      blob.velocity.addScaledVector(target.sub(blob.position), (1.4 + controls.cohesion * 2.8) * dt);
      if (draggingRef.current && Math.abs(pointer.x) < 0.27 && Math.abs(pointer.y) < 0.44) {
        const pull = pointer.clone().sub(blob.position);
        const distance = pull.length();
        if (distance < 0.42) blob.velocity.addScaledVector(pull.normalize(), (1 - distance / 0.42) * 2.8 * dt);
      }
      blob.velocity.multiplyScalar(damping);
      blob.position.addScaledVector(blob.velocity, dt * 3.2);
      blob.position.x = THREE.MathUtils.clamp(blob.position.x, -0.2, 0.2);
      blob.position.y = THREE.MathUtils.clamp(blob.position.y, -0.36, 0.36);
      const uniform = material.uniforms.uBlobs.value[index] as THREE.Vector4;
      uniform.set(blob.position.x, blob.position.y, blob.radius, blob.phase);
    });

    material.uniforms.uAspect.value = aspect;
    material.uniforms.uTime.value = time;
    material.uniforms.uGlow.value = controls.glow;
    material.uniforms.uMergeSoftness.value = controls.mergeSoftness;
    material.uniforms.uBlobCount.value = count;
  });

  return (
    <mesh
      frustumCulled={false}
      onPointerDown={(event) => {
        event.stopPropagation();
        draggingRef.current = true;
      }}
      onPointerLeave={() => {
        draggingRef.current = false;
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
    >
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={materialRef} depthTest={false} depthWrite={false} fragmentShader={fragmentShader} toneMapped={false} uniforms={uniforms} vertexShader={vertexShader} />
    </mesh>
  );
}

export default function Demo043MetaballLiquidUI() {
  const controls = useControls('Metaball Liquid UI', {
    blobCount: {value: 8, min: 5, max: 12, step: 1, label: 'Liquid nodes'},
    cohesion: {value: 0.72, min: 0.25, max: 1.15, step: 0.01, label: 'Chain cohesion'},
    glow: {value: 0.92, min: 0.35, max: 1.35, step: 0.01, label: 'Edge glow'},
    flowSpeed: {value: 0.68, min: 0.15, max: 1.25, step: 0.01, label: 'Flow speed'},
    mergeSoftness: {value: 0.56, min: 0.15, max: 0.9, step: 0.01, label: 'Merge softness'},
  }) as MetaballControls;

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#020407'}}>
      <DemoScene
        engineConfig={{background: '#020407', camera: {position: [0, 0, 1], fov: 50, near: 0.1, far: 10}}}
        orbitControls={false}
      >
        <LiquidPhone controls={controls} />
      </DemoScene>
      <div style={dragLabelStyle}>PRESS + DRAG LIQUID</div>
    </div>
  );
}

const dragLabelStyle = {
  position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)',
  color: 'rgba(190,225,240,0.55)', pointerEvents: 'none',
  fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 10, letterSpacing: '0.08em',
} as const;
