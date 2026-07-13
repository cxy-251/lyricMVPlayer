import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type LensingControls = {
  einsteinRadius: number;
  ellipticity: number;
  sourceOffset: number;
  starDensity: number;
  clusterGlow: number;
  drift: number;
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
uniform float uEinsteinRadius;
uniform float uEllipticity;
uniform float uSourceOffset;
uniform float uStarDensity;
uniform float uClusterGlow;
uniform float uDrift;
uniform vec2 uPointer;

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

vec3 starField(vec2 point) {
  vec2 grid = point * mix(85.0, 170.0, uStarDensity);
  vec2 cell = floor(grid);
  vec2 local = fract(grid) - 0.5;
  float random = hash21(cell);
  vec2 starPosition = vec2(hash21(cell + 2.7), hash21(cell + 8.1)) - 0.5;
  float distanceToStar = length(local - starPosition * 0.72);
  float star = pow(max(0.0, 1.0 - distanceToStar * 16.0), 5.0) * step(0.965, random);
  vec3 tint = mix(vec3(0.46, 0.68, 1.0), vec3(1.0, 0.72, 0.48), hash21(cell + 19.0));
  return tint * star * (0.7 + random * 1.4);
}

float galaxy(vec2 point, vec2 center, float angle, vec2 scale) {
  vec2 delta = point - center;
  float c = cos(angle);
  float s = sin(angle);
  delta = mat2(c, -s, s, c) * delta;
  float radius = length(delta / scale);
  float spiral = 0.5 + 0.5 * cos(atan(delta.y, delta.x) * 2.0 - radius * 5.0);
  return exp(-radius * radius * 2.2) * (0.48 + spiral * 0.52);
}

void main() {
  vec2 point = (vUv - 0.5) * 2.0;
  point.x *= uAspect;
  vec2 lensCenter = uPointer * vec2(uAspect, 1.0) * 0.12;
  vec2 theta = point - lensCenter;
  theta.x *= 1.0 + uEllipticity;
  theta.y *= 1.0 - uEllipticity;
  float radiusSquared = dot(theta, theta) + 0.0015;
  vec2 deflection = theta * (uEinsteinRadius * uEinsteinRadius / radiusSquared);
  deflection.x /= 1.0 + uEllipticity;
  deflection.y /= 1.0 - uEllipticity;
  vec2 source = point - deflection;
  source += vec2(uSourceOffset, sin(uTime * uDrift * 0.12) * 0.025);

  vec3 color = vec3(0.0025, 0.004, 0.011);
  color += starField(source + vec2(uTime * uDrift * 0.002, 0.0));
  float blueGalaxy = galaxy(source, vec2(0.22, 0.03), 0.34, vec2(0.18, 0.055));
  float amberGalaxy = galaxy(source, vec2(-0.38, -0.24), -0.62, vec2(0.13, 0.045));
  float violetGalaxy = galaxy(source, vec2(0.06, 0.42), 1.1, vec2(0.1, 0.035));
  color += vec3(0.22, 0.62, 1.0) * blueGalaxy * 1.8;
  color += vec3(1.0, 0.5, 0.18) * amberGalaxy * 1.35;
  color += vec3(0.72, 0.28, 1.0) * violetGalaxy * 1.2;

  float radius = sqrt(radiusSquared);
  float cluster = exp(-radius * 4.2) * uClusterGlow;
  float core = exp(-radius * radius * 34.0);
  color += vec3(0.48, 0.72, 0.9) * cluster * 0.26;
  color += vec3(0.95, 0.83, 0.68) * core * 0.14;
  float criticalCurve = 1.0 - smoothstep(0.004, 0.016, abs(radius - uEinsteinRadius));
  color += vec3(0.18, 0.42, 0.68) * criticalCurve * 0.1;
  float vignette = 1.0 - smoothstep(0.45, 1.5, length(point));
  gl_FragColor = vec4(color * (0.58 + vignette * 0.42), 1.0);
}
`;

function LensingField({controls}: {controls: LensingControls}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: {value: 0}, uAspect: {value: 1}, uEinsteinRadius: {value: 0.32},
    uEllipticity: {value: 0.1}, uSourceOffset: {value: 0.06}, uStarDensity: {value: 0.68},
    uClusterGlow: {value: 0.72}, uDrift: {value: 0.2}, uPointer: {value: new THREE.Vector2()},
  }), []);
  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uAspect.value = state.size.width / Math.max(1, state.size.height);
    material.uniforms.uEinsteinRadius.value = controls.einsteinRadius;
    material.uniforms.uEllipticity.value = controls.ellipticity;
    material.uniforms.uSourceOffset.value = controls.sourceOffset;
    material.uniforms.uStarDensity.value = controls.starDensity;
    material.uniforms.uClusterGlow.value = controls.clusterGlow;
    material.uniforms.uDrift.value = controls.drift;
    material.uniforms.uPointer.value.set(state.pointer.x, state.pointer.y);
  });
  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={materialRef} depthTest={false} depthWrite={false} fragmentShader={fragmentShader} toneMapped={false} uniforms={uniforms} vertexShader={vertexShader} />
    </mesh>
  );
}

export default function Demo051ReferenceCameraConsole() {
  const controls = useControls('Gravitational Lensing', {
    einsteinRadius: {value: 0.32, min: 0.12, max: 0.58, step: 0.01, label: 'Einstein radius'},
    ellipticity: {value: 0.1, min: 0, max: 0.28, step: 0.01, label: 'Lens ellipticity'},
    sourceOffset: {value: 0.06, min: -0.32, max: 0.32, step: 0.01, label: 'Source alignment'},
    starDensity: {value: 0.68, min: 0.2, max: 1, step: 0.01, label: 'Background stars'},
    clusterGlow: {value: 0.72, min: 0, max: 1.2, step: 0.01, label: 'Lens cluster glow'},
    drift: {value: 0.2, min: 0, max: 0.7, step: 0.01, label: 'Source drift'},
  }) as LensingControls;
  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#010208'}}>
      <DemoScene engineConfig={{background: '#010208', camera: {position: [0, 0, 1], fov: 50, near: 0.1, far: 10}}} orbitControls={false}>
        <LensingField controls={controls} />
      </DemoScene>
      <div style={lensingLegendStyle}><strong>θE {controls.einsteinRadius.toFixed(2)}</strong><span>move pointer to offset lens mass</span></div>
    </div>
  );
}

const lensingLegendStyle = {
  position: 'absolute', left: 18, bottom: 18, display: 'flex', gap: 10, padding: '8px 10px',
  border: '1px solid rgba(116,174,224,0.18)', borderRadius: 6, background: 'rgba(2,5,13,0.78)',
  color: '#7890a3', pointerEvents: 'none', fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 10,
} as const;
