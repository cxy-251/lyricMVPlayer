import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type AuroraControls = {
  solarWind: number;
  curtainCount: number;
  fieldCurvature: number;
  altitude: number;
  curtainThickness: number;
  colorMix: number;
  exposure: number;
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
uniform float uSolarWind;
uniform float uCurtainCount;
uniform float uFieldCurvature;
uniform float uAltitude;
uniform float uCurtainThickness;
uniform float uColorMix;
uniform float uExposure;
uniform vec2 uPointer;

float hash31(vec3 point) {
  point = fract(point * 0.1031);
  point += dot(point, point.yzx + 33.33);
  return fract((point.x + point.y) * point.z);
}

float noise3(vec3 point) {
  vec3 cell = floor(point);
  vec3 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);
  return mix(
    mix(mix(hash31(cell), hash31(cell + vec3(1,0,0)), local.x), mix(hash31(cell + vec3(0,1,0)), hash31(cell + vec3(1,1,0)), local.x), local.y),
    mix(mix(hash31(cell + vec3(0,0,1)), hash31(cell + vec3(1,0,1)), local.x), mix(hash31(cell + vec3(0,1,1)), hash31(cell + vec3(1,1,1)), local.x), local.y),
    local.z
  );
}

float starField(vec2 point) {
  vec2 grid = point * 150.0;
  vec2 cell = floor(grid);
  vec2 local = fract(grid) - 0.5;
  float seed = hash31(vec3(cell, 4.2));
  vec2 position = vec2(hash31(vec3(cell, 7.1)), hash31(vec3(cell, 12.7))) - 0.5;
  float star = pow(max(0.0, 1.0 - length(local - position * 0.76) * 18.0), 5.0);
  return star * step(0.975, seed) * (0.6 + seed);
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uAspect;
  vec3 background = mix(vec3(0.002, 0.006, 0.018), vec3(0.008, 0.018, 0.052), smoothstep(-1.0, 0.8, uv.y));
  background += vec3(0.52, 0.68, 0.92) * starField(uv + uPointer * 0.025);
  float horizon = exp(-abs(uv.y + 0.72) * 16.0);
  background += vec3(0.03, 0.14, 0.2) * horizon * 0.34;

  vec3 accumulated = vec3(0.0);
  float transmittance = 1.0;
  for (int step = 0; step < 48; step++) {
    float depth = (float(step) + 0.5) / 48.0;
    float z = depth * 4.2;
    vec3 point = vec3(
      uv.x * (0.72 + z * 0.12) + uPointer.x * z * 0.035,
      uv.y * (0.82 + z * 0.08) + uAltitude + uPointer.y * 0.05,
      z
    );
    float wind = uTime * uSolarWind * 0.18;
    float distortion = noise3(vec3(point.x * 0.7, point.y * 1.2, point.z * 0.32 + wind)) - 0.5;
    distortion += (noise3(vec3(point.x * 1.8 - wind, point.y * 2.2, point.z * 0.55)) - 0.5) * 0.35;
    float magneticCurve = point.y * point.y * uFieldCurvature * 0.42;
    float phase = point.x * uCurtainCount + distortion * 4.2 + magneticCurve + wind * 2.0;
    float sheet = exp(-abs(sin(phase)) / max(0.025, uCurtainThickness));
    float vertical = smoothstep(-0.78, -0.12, point.y) * smoothstep(1.08, 0.18, point.y);
    float folds = 0.58 + noise3(vec3(point.x * 0.8, point.y * 3.0 - wind, point.z * 0.24)) * 0.62;
    float density = sheet * vertical * folds * 0.085;
    vec3 green = vec3(0.08, 1.0, 0.48);
    vec3 violet = vec3(0.48, 0.22, 1.0);
    float spectralHeight = smoothstep(-0.15, 0.85, point.y) * uColorMix;
    vec3 emission = mix(green, violet, spectralHeight);
    emission += vec3(0.08, 0.34, 1.0) * depth * uColorMix * 0.3;
    accumulated += transmittance * emission * density;
    transmittance *= 1.0 - density * 0.72;
  }
  vec3 color = background + accumulated * uExposure;
  float vignette = 1.0 - smoothstep(0.55, 1.48, length(uv / vec2(max(1.0, uAspect), 1.0)));
  gl_FragColor = vec4(color * (0.62 + vignette * 0.38), 1.0);
}
`;

function AuroraVolume({controls}: {controls: AuroraControls}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: {value: 0}, uAspect: {value: 1}, uSolarWind: {value: 0.32}, uCurtainCount: {value: 7},
    uFieldCurvature: {value: 0.65}, uAltitude: {value: 0.15}, uCurtainThickness: {value: 0.14},
    uColorMix: {value: 0.62}, uExposure: {value: 1.1}, uPointer: {value: new THREE.Vector2()},
  }), []);
  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uAspect.value = state.size.width / Math.max(1, state.size.height);
    material.uniforms.uSolarWind.value = controls.solarWind;
    material.uniforms.uCurtainCount.value = controls.curtainCount;
    material.uniforms.uFieldCurvature.value = controls.fieldCurvature;
    material.uniforms.uAltitude.value = controls.altitude;
    material.uniforms.uCurtainThickness.value = controls.curtainThickness;
    material.uniforms.uColorMix.value = controls.colorMix;
    material.uniforms.uExposure.value = controls.exposure;
    material.uniforms.uPointer.value.set(state.pointer.x, state.pointer.y);
  });
  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={materialRef} depthTest={false} depthWrite={false} fragmentShader={fragmentShader} toneMapped={false} uniforms={uniforms} vertexShader={vertexShader} />
    </mesh>
  );
}

export default function Demo054VisualInspectorControlLayer() {
  const controls = useControls('Aurora Volume', {
    solarWind: {value: 0.32, min: 0.05, max: 0.85, step: 0.01, label: 'Solar wind speed'},
    curtainCount: {value: 7, min: 3, max: 13, step: 1, label: 'Magnetic curtains'},
    fieldCurvature: {value: 0.65, min: 0, max: 1.4, step: 0.01, label: 'Field-line curvature'},
    altitude: {value: 0.15, min: -0.25, max: 0.42, step: 0.01, label: 'Emission altitude'},
    curtainThickness: {value: 0.14, min: 0.06, max: 0.28, step: 0.01, label: 'Curtain thickness'},
    colorMix: {value: 0.62, min: 0, max: 1, step: 0.01, label: 'Violet altitude mix'},
    exposure: {value: 1.1, min: 0.5, max: 1.7, step: 0.01, label: 'Volume exposure'},
  }) as AuroraControls;
  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#01030a'}}>
      <DemoScene engineConfig={{background: '#01030a', camera: {position: [0, 0, 1], fov: 50, near: 0.1, far: 10}}} orbitControls={false}>
        <AuroraVolume controls={controls} />
      </DemoScene>
      <div style={auroraLegendStyle}><strong>48-LAYER EMISSION</strong><span>move pointer to shift the volume view</span></div>
    </div>
  );
}

const auroraLegendStyle = {
  position: 'absolute', left: 18, bottom: 18, display: 'flex', gap: 10, padding: '8px 10px',
  border: '1px solid rgba(91,238,177,0.18)', borderRadius: 6, background: 'rgba(2,6,13,0.76)',
  color: '#799991', pointerEvents: 'none', fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 10,
} as const;
