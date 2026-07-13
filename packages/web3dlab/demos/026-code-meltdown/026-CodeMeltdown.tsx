import {useFrame, useThree} from '@react-three/fiber';
import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

const SOURCE_LINES = [
  'function visualModule(seed, time, pointer) {',
  '  const uv = domainWarp(pointer.xy + time * 0.08);',
  '  const heat = fbm(uv * 2.4 + seed);',
  '  const glyph = mix("CODE", "MELTDOWN", heat);',
  '  return bloom(soften(glyph, heat));',
  '}',
  '',
  'const frame = visualModule(seed, time, pointer);',
  'renderer.present(frame);',
];

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

uniform sampler2D uCodeTexture;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uPointerHeat;
uniform float uTime;
uniform float uFlowSpeed;
uniform float uHeatRadius;
uniform float uMeltStrength;
uniform float uTurbulence;
uniform float uTrailLength;
uniform float uAmbientHeat;
uniform vec3 uColdColor;
uniform vec3 uHotColor;

float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  vec2 smoothLocal = local * local * (3.0 - 2.0 * local);
  return mix(
    mix(hash(cell), hash(cell + vec2(1.0, 0.0)), smoothLocal.x),
    mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), smoothLocal.x),
    smoothLocal.y
  );
}

float fbm(vec2 point) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 4; octave++) {
    value += noise(point) * amplitude;
    point = mat2(1.7, 1.1, -1.1, 1.7) * point + 0.17;
    amplitude *= 0.5;
  }
  return value;
}

float sampleCode(vec2 uv) {
  vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return texture2D(uCodeTexture, uv).a * inside.x * inside.y;
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 aspectScale = vec2(aspect, 1.0);
  float time = uTime * uFlowSpeed;
  vec2 ambientPosition = vec2(
    0.5 + sin(time * 0.31) * 0.31,
    0.5 + cos(time * 0.24) * 0.27
  );
  float pointerDistance = length((vUv - uPointer) * aspectScale);
  float ambientDistance = length((vUv - ambientPosition) * aspectScale);
  float pointerHeat = (1.0 - smoothstep(0.0, uHeatRadius, pointerDistance)) * uPointerHeat;
  float ambientHeat = (1.0 - smoothstep(0.0, uHeatRadius * 0.82, ambientDistance)) * uAmbientHeat;
  float heat = clamp(max(pointerHeat, ambientHeat), 0.0, 1.0);

  float flowNoise = fbm(vec2(vUv.x * 15.0, vUv.y * 2.2 - time * 0.34));
  float fineNoise = noise(vec2(vUv.x * 42.0 + time * 0.16, vUv.y * 8.0));
  float melt = heat * heat * uMeltStrength * mix(0.3, 1.0, flowNoise);
  float horizontalDrift = (fineNoise - 0.5) * uTurbulence * heat * 0.055;
  vec2 meltedUv = vUv + vec2(horizontalDrift, melt);
  float glyph = sampleCode(meltedUv);
  float trail = 0.0;

  for (int index = 1; index <= 6; index++) {
    float stepIndex = float(index);
    if (stepIndex <= uTrailLength) {
      float progress = stepIndex / max(uTrailLength, 1.0);
      vec2 trailUv = meltedUv + vec2(
        horizontalDrift * progress * 0.4,
        stepIndex * (0.004 + heat * 0.008)
      );
      trail = max(trail, sampleCode(trailUv) * (1.0 - progress * 0.78));
    }
  }

  vec2 texel = 1.0 / max(uResolution, vec2(1.0));
  float glow = sampleCode(meltedUv + vec2(texel.x * 2.0, 0.0));
  glow += sampleCode(meltedUv - vec2(texel.x * 2.0, 0.0));
  glow += sampleCode(meltedUv + vec2(0.0, texel.y * 2.0));
  glow += sampleCode(meltedUv - vec2(0.0, texel.y * 2.0));
  glow *= 0.25;

  vec3 background = mix(vec3(0.006, 0.012, 0.027), vec3(0.018, 0.025, 0.052), vUv.y);
  vec3 codeColor = mix(uColdColor, uHotColor, pow(heat, 0.62));
  vec3 color = background;
  color += uColdColor * glyph * mix(0.42, 0.18, heat);
  color += codeColor * glyph * (0.38 + heat * 0.82);
  color += uHotColor * trail * heat * 0.85;
  color += codeColor * glow * (0.05 + heat * 0.24);

  float thermalHalo = exp(-ambientDistance * 8.0) * uAmbientHeat
    + exp(-pointerDistance * 7.0) * uPointerHeat;
  color += uHotColor * thermalHalo * 0.025;
  float vignette = 1.0 - smoothstep(0.28, 1.25, length((vUv - 0.5) * vec2(1.0, 0.86)));
  gl_FragColor = vec4(color * vignette, 1.0);
}
`;

type CodeMeltdownControls = {
  glyphSize: number;
  flowSpeed: number;
  heatRadius: number;
  meltStrength: number;
  turbulence: number;
  trailLength: number;
  ambientHeat: number;
  coldColor: string;
  hotColor: string;
};

function createCodeTexture(width: number, height: number, glyphSize: number) {
  const aspect = width / Math.max(height, 1);
  const maximumDimension = 1536;
  const textureWidth = Math.max(512, Math.round(aspect >= 1 ? maximumDimension : maximumDimension * aspect));
  const textureHeight = Math.max(512, Math.round(aspect >= 1 ? maximumDimension / aspect : maximumDimension));
  const canvas = document.createElement('canvas');
  canvas.width = textureWidth;
  canvas.height = textureHeight;
  const context = canvas.getContext('2d');

  if (context) {
    const scale = textureWidth / Math.max(width, 1);
    const fontSize = glyphSize * scale;
    const lineHeight = fontSize * 1.28;
    const rows = Math.ceil(textureHeight / lineHeight) + 1;
    context.clearRect(0, 0, textureWidth, textureHeight);
    context.fillStyle = '#ffffff';
    context.font = `600 ${fontSize}px "SFMono-Regular", Menlo, Consolas, monospace`;
    context.textAlign = 'left';
    context.textBaseline = 'middle';

    for (let row = 0; row < rows; row++) {
      const sourceLine = SOURCE_LINES[row % SOURCE_LINES.length];
      const repeatedLine = `${sourceLine}    `.repeat(8);
      context.fillText(repeatedLine, 0, (row + 0.5) * lineHeight);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function CodeMeltdownPlane({controls}: {controls: CodeMeltdownControls}) {
  const {gl, size} = useThree();
  const pointerActive = useRef(false);
  const pointerHeat = useRef(0);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const codeTexture = useMemo(
    () => createCodeTexture(size.width, size.height, controls.glyphSize),
    [controls.glyphSize, size.height, size.width],
  );
  const uniforms = useMemo(
    () => ({
      uCodeTexture: {value: codeTexture},
      uResolution: {value: new THREE.Vector2(size.width, size.height)},
      uPointer: {value: new THREE.Vector2(0.5, 0.5)},
      uPointerHeat: {value: 0},
      uTime: {value: 0},
      uFlowSpeed: {value: 0.7},
      uHeatRadius: {value: 0.2},
      uMeltStrength: {value: 0.12},
      uTurbulence: {value: 0.7},
      uTrailLength: {value: 4},
      uAmbientHeat: {value: 0.3},
      uColdColor: {value: new THREE.Color('#48d9ff')},
      uHotColor: {value: new THREE.Color('#ff6a2a')},
    }),
    [codeTexture, size.height, size.width],
  );

  useEffect(() => {
    const canvas = gl.domElement;
    const activate = () => {
      pointerActive.current = true;
    };
    const deactivate = () => {
      pointerActive.current = false;
    };
    canvas.addEventListener('pointermove', activate, {passive: true});
    canvas.addEventListener('pointerleave', deactivate, {passive: true});
    return () => {
      canvas.removeEventListener('pointermove', activate);
      canvas.removeEventListener('pointerleave', deactivate);
    };
  }, [gl]);

  useEffect(() => () => codeTexture.dispose(), [codeTexture]);

  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;
    pointerHeat.current = THREE.MathUtils.damp(
      pointerHeat.current,
      pointerActive.current ? 1 : 0,
      8,
      delta,
    );
    const current = material.uniforms;
    current.uTime.value = state.clock.elapsedTime;
    current.uResolution.value.set(state.size.width, state.size.height);
    current.uPointer.value.set(state.pointer.x * 0.5 + 0.5, state.pointer.y * 0.5 + 0.5);
    current.uPointerHeat.value = pointerHeat.current;
    current.uFlowSpeed.value = controls.flowSpeed;
    current.uHeatRadius.value = controls.heatRadius;
    current.uMeltStrength.value = controls.meltStrength;
    current.uTurbulence.value = controls.turbulence;
    current.uTrailLength.value = controls.trailLength;
    current.uAmbientHeat.value = controls.ambientHeat;
    current.uColdColor.value.set(controls.coldColor);
    current.uHotColor.value.set(controls.hotColor);
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        depthTest={false}
        depthWrite={false}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        vertexShader={vertexShader}
      />
    </mesh>
  );
}

export default function Demo026CodeMeltdown() {
  const controls = useControls('Code Meltdown', {
    glyphSize: {value: 15, min: 11, max: 22, step: 1, label: 'Glyph size'},
    flowSpeed: {value: 0.7, min: 0.15, max: 1.4, step: 0.05, label: 'Heat flow speed'},
    heatRadius: {value: 0.2, min: 0.09, max: 0.32, step: 0.01, label: 'Heat radius'},
    meltStrength: {value: 0.12, min: 0.03, max: 0.24, step: 0.01, label: 'Melt distance'},
    turbulence: {value: 0.7, min: 0, max: 1.4, step: 0.05, label: 'Flow turbulence'},
    trailLength: {value: 4, min: 0, max: 6, step: 1, label: 'Melt trail'},
    ambientHeat: {value: 0.3, min: 0, max: 0.65, step: 0.01, label: 'Ambient heat'},
    coldColor: {value: '#48d9ff', label: 'Cold code'},
    hotColor: {value: '#ff6a2a', label: 'Molten code'},
  });

  return (
    <DemoScene
      engineConfig={{
        background: '#02040a',
        camera: {position: [0, 0, 1], fov: 50, near: 0.1, far: 10},
      }}
      orbitControls={false}
    >
      <CodeMeltdownPlane controls={controls} />
    </DemoScene>
  );
}
