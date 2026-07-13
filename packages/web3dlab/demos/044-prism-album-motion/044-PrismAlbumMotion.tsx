import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type ThinFilmControls = {
  filmThickness: number;
  thicknessVariation: number;
  refractiveIndex: number;
  flowSpeed: number;
  surfaceTension: number;
  reflection: number;
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
uniform float uFilmThickness;
uniform float uThicknessVariation;
uniform float uRefractiveIndex;
uniform float uFlowSpeed;
uniform float uSurfaceTension;
uniform float uReflection;
uniform vec2 uPointer;

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

float valueNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);
  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

float thicknessField(vec2 point) {
  float tensionScale = mix(4.8, 1.8, uSurfaceTension);
  vec2 flow = vec2(uTime * uFlowSpeed * 0.12, -uTime * uFlowSpeed * 0.08);
  float field = valueNoise(point * tensionScale + flow) * 0.58;
  field += valueNoise(point * tensionScale * 2.07 - flow * 1.4) * 0.27;
  field += valueNoise(point * tensionScale * 4.13 + flow * 0.7) * 0.15;
  float drainage = smoothstep(-0.9, 0.85, point.y) * 0.24;
  return field - drainage;
}

vec3 thinFilmInterference(float thicknessNm, float cosineAngle) {
  const vec3 wavelengths = vec3(650.0, 510.0, 475.0);
  vec3 phase = 12.5663706 * uRefractiveIndex * thicknessNm * cosineAngle / wavelengths;
  vec3 constructive = 0.5 + 0.5 * cos(phase + 3.14159265);
  constructive = pow(constructive, vec3(1.35));
  return constructive;
}

void main() {
  vec2 point = (vUv - 0.5) * 2.0;
  point.x *= uAspect;
  float radius = length(point);
  float membrane = 1.0 - smoothstep(0.78, 0.8, radius);
  float field = thicknessField(point);
  float epsilon = 0.004;
  vec2 gradient = vec2(
    thicknessField(point + vec2(epsilon, 0.0)) - thicknessField(point - vec2(epsilon, 0.0)),
    thicknessField(point + vec2(0.0, epsilon)) - thicknessField(point - vec2(0.0, epsilon))
  ) / (2.0 * epsilon);
  vec3 normal = normalize(vec3(-gradient * uThicknessVariation * 0.0024, 1.0));
  vec3 viewDirection = normalize(vec3(uPointer * 0.42, 1.0));
  float cosineAngle = clamp(dot(normal, viewDirection), 0.16, 1.0);
  float thicknessNm = max(20.0, uFilmThickness + (field - 0.5) * uThicknessVariation);
  vec3 interference = thinFilmInterference(thicknessNm, cosineAngle);
  float fresnel = pow(1.0 - cosineAngle, 3.2);
  float broadHighlight = pow(max(dot(normal, normalize(vec3(-0.5, 0.65, 0.8))), 0.0), 16.0);

  vec3 background = mix(vec3(0.006, 0.012, 0.022), vec3(0.018, 0.006, 0.028), vUv.y);
  background += vec3(0.025, 0.06, 0.1) * exp(-3.4 * radius);
  vec3 reflected = interference * (0.3 + uReflection * 0.74);
  reflected += vec3(0.45, 0.75, 1.0) * fresnel * 0.42;
  reflected += vec3(1.0, 0.92, 0.78) * broadHighlight * 0.34;
  reflected *= 0.62 + smoothstep(0.82, 0.15, radius) * 0.38;
  float rim = 1.0 - smoothstep(0.0, 0.035, abs(radius - 0.79));
  vec3 color = mix(background, reflected, membrane * 0.94);
  color += vec3(0.5, 0.72, 0.95) * rim * 0.36;
  gl_FragColor = vec4(color, 1.0);
}
`;

function ThinFilmMembrane({controls}: {controls: ThinFilmControls}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: {value: 0}, uAspect: {value: 1}, uFilmThickness: {value: 420},
    uThicknessVariation: {value: 190}, uRefractiveIndex: {value: 1.33},
    uFlowSpeed: {value: 0.2}, uSurfaceTension: {value: 0.62}, uReflection: {value: 0.78},
    uPointer: {value: new THREE.Vector2()},
  }), []);

  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uAspect.value = state.size.width / Math.max(1, state.size.height);
    material.uniforms.uFilmThickness.value = controls.filmThickness;
    material.uniforms.uThicknessVariation.value = controls.thicknessVariation;
    material.uniforms.uRefractiveIndex.value = controls.refractiveIndex;
    material.uniforms.uFlowSpeed.value = controls.flowSpeed;
    material.uniforms.uSurfaceTension.value = controls.surfaceTension;
    material.uniforms.uReflection.value = controls.reflection;
    material.uniforms.uPointer.value.set(state.pointer.x, state.pointer.y);
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={materialRef} depthTest={false} depthWrite={false} fragmentShader={fragmentShader} toneMapped={false} uniforms={uniforms} vertexShader={vertexShader} />
    </mesh>
  );
}

export default function Demo044PrismAlbumMotion() {
  const controls = useControls('Thin-Film Interference', {
    filmThickness: {value: 420, min: 120, max: 900, step: 5, label: 'Mean thickness (nm)'},
    thicknessVariation: {value: 190, min: 20, max: 380, step: 5, label: 'Thickness variation'},
    refractiveIndex: {value: 1.33, min: 1.2, max: 1.65, step: 0.01, label: 'Film refractive index'},
    flowSpeed: {value: 0.22, min: 0, max: 0.72, step: 0.01, label: 'Thickness flow'},
    surfaceTension: {value: 0.62, min: 0.15, max: 1, step: 0.01, label: 'Surface tension'},
    reflection: {value: 0.78, min: 0.3, max: 1.15, step: 0.01, label: 'Reflected intensity'},
  }) as ThinFilmControls;

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#02050a'}}>
      <DemoScene
        engineConfig={{background: '#02050a', camera: {position: [0, 0, 1], fov: 50, near: 0.1, far: 10}}}
        orbitControls={false}
      >
        <ThinFilmMembrane controls={controls} />
      </DemoScene>
      <div style={filmLegendStyle}>
        <strong>THIN FILM · RGB PHASE</strong>
        <span>650 nm</span><span>510 nm</span><span>475 nm</span>
      </div>
    </div>
  );
}

const filmLegendStyle = {
  position: 'absolute', left: 18, bottom: 18, display: 'flex', gap: 10, alignItems: 'center',
  padding: '8px 10px', border: '1px solid rgba(130,202,255,0.18)', borderRadius: 6,
  background: 'rgba(3,7,14,0.78)', color: '#849eaf', pointerEvents: 'none',
  fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 10,
} as const;
