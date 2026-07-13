import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type ChladniControls = {
  modeN: number;
  modeM: number;
  settling: number;
  vibration: number;
  frequency: number;
  particleCount: number;
  particleSize: number;
};

const modeFunction = `
float chladni(vec2 point, float modeN, float modeM) {
  float n = modeN;
  float m = abs(modeM - modeN) < 0.25 ? modeM + 1.0 : modeM;
  vec2 coordinate = (point + 1.0) * 1.5707963;
  return cos(n * coordinate.x) * cos(m * coordinate.y)
    - cos(m * coordinate.x) * cos(n * coordinate.y);
}
`;

const particleVertexShader = `
precision highp float;
attribute vec2 aOrigin;
attribute float aSeed;
uniform float uTime;
uniform float uModeN;
uniform float uModeM;
uniform float uSettling;
uniform float uVibration;
uniform float uFrequency;
uniform float uParticleSize;
varying float vSeed;
varying float vNode;
${modeFunction}

vec2 projectToNode(vec2 initialPoint) {
  vec2 point = initialPoint;
  const float epsilon = 0.006;
  for (int iteration = 0; iteration < 7; iteration++) {
    float field = chladni(point, uModeN, uModeM);
    vec2 gradient = vec2(
      chladni(point + vec2(epsilon, 0.0), uModeN, uModeM) - chladni(point - vec2(epsilon, 0.0), uModeN, uModeM),
      chladni(point + vec2(0.0, epsilon), uModeN, uModeM) - chladni(point - vec2(0.0, epsilon), uModeN, uModeM)
    ) / (2.0 * epsilon);
    vec2 correction = gradient * field / (dot(gradient, gradient) + 0.035);
    correction = clamp(correction, vec2(-0.085), vec2(0.085));
    point -= correction * 0.78;
    point = clamp(point, vec2(-0.98), vec2(0.98));
  }
  return point;
}

void main() {
  vec2 nodePoint = projectToNode(aOrigin);
  vec2 point = mix(aOrigin, nodePoint, uSettling);
  float nodeDistance = abs(chladni(point, uModeN, uModeM));
  float vibration = sin(uTime * uFrequency * 6.2831 + aSeed * 12.0) * uVibration;
  float height = 0.035 + vibration * (0.025 + nodeDistance * 0.08);
  vec3 position = vec3(point.x * 2.35, height, point.y * 2.35);
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(uParticleSize * (6.0 / max(2.0, -viewPosition.z)) * (0.75 + aSeed * 0.45), 1.0, 7.0);
  gl_Position = projectionMatrix * viewPosition;
  vSeed = aSeed;
  vNode = 1.0 - smoothstep(0.0, 0.12, nodeDistance);
}
`;

const particleFragmentShader = `
precision highp float;
varying float vSeed;
varying float vNode;
void main() {
  float radius = length(gl_PointCoord - 0.5);
  float alpha = 1.0 - smoothstep(0.24, 0.5, radius);
  float core = 1.0 - smoothstep(0.05, 0.2, radius);
  vec3 sand = mix(vec3(0.9, 0.46, 0.12), vec3(1.0, 0.84, 0.42), vSeed);
  vec3 color = mix(sand, vec3(0.76, 0.96, 1.0), vNode * 0.24 + core * 0.15);
  gl_FragColor = vec4(color, alpha * (0.72 + core * 0.28));
}
`;

const plateVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const plateFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uModeN;
uniform float uModeM;
uniform float uVibration;
uniform float uFrequency;
${modeFunction}
void main() {
  vec2 point = vUv * 2.0 - 1.0;
  float field = chladni(point, uModeN, uModeM);
  float oscillation = sin(uTime * uFrequency * 6.2831);
  float wave = field * oscillation;
  float node = 1.0 - smoothstep(0.018, 0.08, abs(field));
  vec3 negative = vec3(0.035, 0.08, 0.16);
  vec3 positive = vec3(0.18, 0.035, 0.16);
  vec3 color = mix(negative, positive, wave * 0.5 + 0.5);
  color *= 0.34 + uVibration * 0.42;
  color += vec3(0.18, 0.72, 0.82) * node * 0.18;
  gl_FragColor = vec4(color, 1.0);
}
`;

function ChladniPlate({controls}: {controls: ChladniControls}) {
  const particleMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const plateMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const smoothedModesRef = useRef(new THREE.Vector2(controls.modeN, controls.modeM));
  const geometry = useMemo(() => {
    const origins = new Float32Array(controls.particleCount * 2);
    const seeds = new Float32Array(controls.particleCount);
    for (let index = 0; index < controls.particleCount; index++) {
      const seedA = ((index * 16807) % 2147483647) / 2147483647;
      const seedB = ((index * 48271 + 17) % 2147483629) / 2147483629;
      origins[index * 2] = seedA * 1.94 - 0.97;
      origins[index * 2 + 1] = seedB * 1.94 - 0.97;
      seeds[index] = ((index * 69621 + 31) % 104729) / 104729;
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.BufferAttribute(new Float32Array(controls.particleCount * 3), 3));
    next.setAttribute('aOrigin', new THREE.BufferAttribute(origins, 2));
    next.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return next;
  }, [controls.particleCount]);
  const particleUniforms = useMemo(() => ({
    uTime: {value: 0}, uModeN: {value: 3}, uModeM: {value: 5}, uSettling: {value: 0.92},
    uVibration: {value: 0.18}, uFrequency: {value: 0.62}, uParticleSize: {value: 3.2},
  }), []);
  const plateUniforms = useMemo(() => ({
    uTime: {value: 0}, uModeN: {value: 3}, uModeM: {value: 5}, uVibration: {value: 0.18}, uFrequency: {value: 0.62},
  }), []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, delta) => {
    smoothedModesRef.current.x = THREE.MathUtils.damp(smoothedModesRef.current.x, controls.modeN, 4.5, delta);
    smoothedModesRef.current.y = THREE.MathUtils.damp(smoothedModesRef.current.y, controls.modeM, 4.5, delta);
    const materials = [particleMaterialRef.current, plateMaterialRef.current];
    materials.forEach(material => {
      if (!material) return;
      material.uniforms.uTime.value = state.clock.elapsedTime;
      material.uniforms.uModeN.value = smoothedModesRef.current.x;
      material.uniforms.uModeM.value = smoothedModesRef.current.y;
      material.uniforms.uVibration.value = controls.vibration;
      material.uniforms.uFrequency.value = controls.frequency;
    });
    if (particleMaterialRef.current) {
      particleMaterialRef.current.uniforms.uSettling.value = controls.settling;
      particleMaterialRef.current.uniforms.uParticleSize.value = controls.particleSize;
    }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.9, 4.9]} />
        <shaderMaterial ref={plateMaterialRef} fragmentShader={plateFragmentShader} uniforms={plateUniforms} vertexShader={plateVertexShader} />
      </mesh>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial ref={particleMaterialRef} blending={THREE.AdditiveBlending} depthWrite={false} fragmentShader={particleFragmentShader} transparent uniforms={particleUniforms} vertexShader={particleVertexShader} />
      </points>
      <mesh position={[0, -0.055, 0]}>
        <boxGeometry args={[5.06, 0.1, 5.06]} />
        <meshStandardMaterial color="#12171e" metalness={0.78} roughness={0.25} />
      </mesh>
      {[[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]].map(([x, z], index) => (
        <mesh key={index} position={[x, -0.24, z]}>
          <cylinderGeometry args={[0.08, 0.1, 0.38, 16]} />
          <meshStandardMaterial color="#26313b" metalness={0.82} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

export default function Demo045LenticularHoloCard() {
  const controls = useControls('Chladni Plate', {
    modeN: {value: 3, min: 1, max: 8, step: 1, label: 'Mode n'},
    modeM: {value: 5, min: 1, max: 8, step: 1, label: 'Mode m'},
    settling: {value: 0.94, min: 0, max: 1, step: 0.01, label: 'Node settling'},
    vibration: {value: 0.18, min: 0, max: 0.48, step: 0.01, label: 'Plate amplitude'},
    frequency: {value: 0.62, min: 0.15, max: 1.25, step: 0.01, label: 'Oscillation rate'},
    particleCount: {value: 26000, min: 8000, max: 42000, step: 2000, label: 'Sand grains'},
    particleSize: {value: 3.2, min: 1.8, max: 5.2, step: 0.1, label: 'Grain size'},
  }) as ChladniControls;

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#05070b'}}>
      <DemoScene
        engineConfig={{
          background: '#05070b',
          bloom: {intensity: 0.42, luminanceSmoothing: 0.62, luminanceThreshold: 0.54},
          camera: {position: [4.4, 4.1, 5.2], fov: 43, near: 0.1, far: 30},
          fog: {color: '#05070b', near: 10, far: 18},
        }}
        orbitConfig={{autoRotate: false, enablePan: false, minDistance: 5.5, maxDistance: 11}}
      >
        <ambientLight intensity={0.38} />
        <directionalLight color="#d9efff" intensity={1.7} position={[3, 6, 4]} />
        <ChladniPlate controls={controls} />
      </DemoScene>
      <div style={chladniLegendStyle}>
        <strong>CHLADNI MODE ({controls.modeN}, {controls.modeM})</strong>
        <span>sand converges where f(x,y) = 0</span>
      </div>
    </div>
  );
}

const chladniLegendStyle = {
  position: 'absolute', left: 18, bottom: 18, display: 'grid', gap: 3,
  padding: '8px 10px', border: '1px solid rgba(242,180,73,0.2)', borderRadius: 6,
  background: 'rgba(7,8,11,0.8)', color: '#a49373', pointerEvents: 'none',
  fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 10,
} as const;
