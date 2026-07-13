import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type DoubleSlitControls = {
  wavelength: number;
  slitSeparation: number;
  slitWidth: number;
  coherence: number;
  phaseOffset: number;
  propagationSpeed: number;
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
uniform float uWavelength;
uniform float uSlitSeparation;
uniform float uSlitWidth;
uniform float uCoherence;
uniform float uPhaseOffset;
uniform float uPropagationSpeed;

void main() {
  vec2 point = (vUv - 0.5) * 2.0;
  point.x *= uAspect;
  float barrierX = -0.28;
  float screenX = min(0.92, uAspect * 0.72);
  vec2 slitA = vec2(barrierX, uSlitSeparation * 0.5);
  vec2 slitB = vec2(barrierX, -uSlitSeparation * 0.5);
  float waveNumber = 6.2831853 / max(0.04, uWavelength);
  float timePhase = uTime * uPropagationSpeed * 4.0;

  vec3 color = vec3(0.004, 0.008, 0.016);
  float incidentPhase = cos(waveNumber * (point.x - barrierX) - timePhase);
  float incidentMask = 1.0 - smoothstep(barrierX - 0.02, barrierX + 0.02, point.x);
  color += mix(vec3(0.03, 0.12, 0.2), vec3(0.08, 0.5, 0.75), incidentPhase * 0.5 + 0.5) * incidentMask * 0.34;
  float incidentCrest = pow(max(0.0, incidentPhase), 18.0) * incidentMask;
  color += vec3(0.18, 0.72, 1.0) * incidentCrest * 0.52;

  float distanceA = length(point - slitA);
  float distanceB = length(point - slitB);
  float waveA = cos(waveNumber * distanceA - timePhase);
  float waveB = cos(waveNumber * distanceB - timePhase + uPhaseOffset);
  float apertureA = exp(-abs(point.y - slitA.y) * 1.8);
  float apertureB = exp(-abs(point.y - slitB.y) * 1.8);
  float amplitude = (waveA * apertureA + waveB * apertureB) * 0.5;
  float probability = clamp((waveA * waveA + waveB * waveB + 2.0 * uCoherence * waveA * waveB) * 0.25, 0.0, 1.0);
  float propagated = smoothstep(barrierX, barrierX + 0.04, point.x);
  vec3 negative = vec3(0.15, 0.04, 0.34);
  vec3 positive = vec3(0.02, 0.54, 0.72);
  color += mix(negative, positive, amplitude * 0.5 + 0.5) * probability * propagated * 0.78;
  color += vec3(0.42, 0.86, 1.0) * pow(probability, 4.0) * propagated * 0.34;

  float slitOpening = max(
    1.0 - smoothstep(uSlitWidth * 0.45, uSlitWidth * 0.55, abs(point.y - slitA.y)),
    1.0 - smoothstep(uSlitWidth * 0.45, uSlitWidth * 0.55, abs(point.y - slitB.y))
  );
  float barrier = (1.0 - smoothstep(0.008, 0.018, abs(point.x - barrierX))) * (1.0 - slitOpening);
  color = mix(color, vec3(0.52, 0.61, 0.7), barrier * 0.78);
  float slitGlow = (1.0 - smoothstep(0.01, 0.04, abs(point.x - barrierX))) * slitOpening;
  color += vec3(0.42, 0.88, 1.0) * slitGlow * 0.8;

  float detector = 1.0 - smoothstep(0.006, 0.014, abs(point.x - screenX));
  float distanceToCenter = sqrt((screenX - barrierX) * (screenX - barrierX) + point.y * point.y);
  float sineTheta = point.y / max(0.001, distanceToCenter);
  float beta = 3.14159265 * uSlitWidth * sineTheta / max(0.04, uWavelength);
  float alpha = 3.14159265 * uSlitSeparation * sineTheta / max(0.04, uWavelength) + uPhaseOffset * 0.5;
  float envelope = abs(beta) < 0.001 ? 1.0 : pow(sin(beta) / beta, 2.0);
  float fringe = envelope * pow(cos(alpha), 2.0);
  color += mix(vec3(0.12, 0.18, 0.24), vec3(0.72, 0.94, 1.0), fringe) * detector * (0.3 + fringe * 1.4);
  float vignette = 1.0 - smoothstep(0.55, 1.45, length(point / vec2(max(1.0, uAspect), 1.0)));
  gl_FragColor = vec4(color * (0.65 + vignette * 0.35), 1.0);
}
`;

function DoubleSlitField({controls}: {controls: DoubleSlitControls}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: {value: 0}, uAspect: {value: 1}, uWavelength: {value: 0.14},
    uSlitSeparation: {value: 0.34}, uSlitWidth: {value: 0.085}, uCoherence: {value: 0.95},
    uPhaseOffset: {value: 0}, uPropagationSpeed: {value: 0.72},
  }), []);
  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uAspect.value = state.size.width / Math.max(1, state.size.height);
    material.uniforms.uWavelength.value = controls.wavelength;
    material.uniforms.uSlitSeparation.value = controls.slitSeparation;
    material.uniforms.uSlitWidth.value = controls.slitWidth;
    material.uniforms.uCoherence.value = controls.coherence;
    material.uniforms.uPhaseOffset.value = controls.phaseOffset;
    material.uniforms.uPropagationSpeed.value = controls.propagationSpeed;
  });
  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={materialRef} depthTest={false} depthWrite={false} fragmentShader={fragmentShader} toneMapped={false} uniforms={uniforms} vertexShader={vertexShader} />
    </mesh>
  );
}

export default function Demo052HandPulledThoughtSculpture() {
  const controls = useControls('Double-Slit Field', {
    wavelength: {value: 0.14, min: 0.065, max: 0.26, step: 0.005, label: 'Wavelength λ'},
    slitSeparation: {value: 0.34, min: 0.16, max: 0.62, step: 0.01, label: 'Slit separation d'},
    slitWidth: {value: 0.085, min: 0.035, max: 0.16, step: 0.005, label: 'Slit width a'},
    coherence: {value: 0.95, min: 0, max: 1, step: 0.01, label: 'Coherence'},
    phaseOffset: {value: 0, min: -Math.PI, max: Math.PI, step: 0.05, label: 'Relative phase'},
    propagationSpeed: {value: 0.72, min: 0.15, max: 1.25, step: 0.01, label: 'Wave animation'},
  }) as DoubleSlitControls;
  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#01040a'}}>
      <DemoScene engineConfig={{background: '#01040a', camera: {position: [0, 0, 1], fov: 50, near: 0.1, far: 10}}} orbitControls={false}>
        <DoubleSlitField controls={controls} />
      </DemoScene>
      <div style={waveLegendStyle}><strong>ψ = ψ₁ + ψ₂</strong><span>I ∝ |ψ|²</span><span>detector →</span></div>
    </div>
  );
}

const waveLegendStyle = {
  position: 'absolute', left: 18, bottom: 18, display: 'flex', gap: 12, padding: '8px 10px',
  border: '1px solid rgba(99,201,240,0.18)', borderRadius: 6, background: 'rgba(2,7,13,0.78)',
  color: '#7992a2', pointerEvents: 'none', fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 10,
} as const;
