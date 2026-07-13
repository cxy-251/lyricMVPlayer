import {useFBO} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type ReactionControls = {
  feed: number;
  kill: number;
  diffusionU: number;
  diffusionV: number;
  stepsPerFrame: number;
  brushRadius: number;
  contrast: number;
};

const SIMULATION_SIZE = 512;

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const simulationFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uFeed;
uniform float uKill;
uniform float uDiffusionU;
uniform float uDiffusionV;
uniform vec2 uBrush;
uniform float uBrushRadius;
uniform float uBrushActive;

vec2 sampleState(vec2 offset) {
  return texture2D(uState, fract(vUv + offset * uTexel)).rg;
}

void main() {
  vec2 center = sampleState(vec2(0.0));
  vec2 laplacian = sampleState(vec2(1.0, 0.0)) * 0.2
    + sampleState(vec2(-1.0, 0.0)) * 0.2
    + sampleState(vec2(0.0, 1.0)) * 0.2
    + sampleState(vec2(0.0, -1.0)) * 0.2
    + sampleState(vec2(1.0, 1.0)) * 0.05
    + sampleState(vec2(-1.0, 1.0)) * 0.05
    + sampleState(vec2(1.0, -1.0)) * 0.05
    + sampleState(vec2(-1.0, -1.0)) * 0.05
    - center;
  float u = center.r;
  float v = center.g;
  float reaction = u * v * v;
  u += uDiffusionU * laplacian.r - reaction + uFeed * (1.0 - u);
  v += uDiffusionV * laplacian.g + reaction - (uFeed + uKill) * v;
  float brush = 1.0 - smoothstep(uBrushRadius * 0.55, uBrushRadius, distance(vUv, uBrush));
  v = mix(v, 0.96, brush * uBrushActive);
  u = mix(u, 0.08, brush * uBrushActive);
  gl_FragColor = vec4(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0), 0.0, 1.0);
}
`;

const displayFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uContrast;

void main() {
  vec2 state = texture2D(uState, vUv).rg;
  float concentration = clamp((state.g - state.r * 0.24) * uContrast, 0.0, 1.0);
  float edge = abs(texture2D(uState, vUv + vec2(uTexel.x, 0.0)).g - texture2D(uState, vUv - vec2(uTexel.x, 0.0)).g)
    + abs(texture2D(uState, vUv + vec2(0.0, uTexel.y)).g - texture2D(uState, vUv - vec2(0.0, uTexel.y)).g);
  vec3 deep = vec3(0.008, 0.018, 0.028);
  vec3 cyan = vec3(0.02, 0.58, 0.68);
  vec3 coral = vec3(0.94, 0.24, 0.32);
  vec3 cream = vec3(1.0, 0.86, 0.62);
  vec3 color = mix(deep, cyan, smoothstep(0.02, 0.42, concentration));
  color = mix(color, coral, smoothstep(0.42, 0.75, concentration));
  color = mix(color, cream, smoothstep(0.74, 1.0, concentration));
  color += vec3(0.32, 0.9, 1.0) * edge * 2.4;
  float vignette = 1.0 - smoothstep(0.48, 1.15, length(vUv * 2.0 - 1.0));
  gl_FragColor = vec4(color * (0.62 + vignette * 0.38), 1.0);
}
`;

function createSeedTexture(seed: number) {
  const data = new Uint8Array(SIMULATION_SIZE * SIMULATION_SIZE * 4);
  for (let y = 0; y < SIMULATION_SIZE; y++) {
    for (let x = 0; x < SIMULATION_SIZE; x++) {
      const index = (y * SIMULATION_SIZE + x) * 4;
      let u = 255;
      let v = 0;
      for (let spot = 0; spot < 14; spot++) {
        const cx = ((spot * 83 + seed * 37) % 431) + 40;
        const cy = ((spot * 137 + seed * 61) % 431) + 40;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy < 90 + (spot % 4) * 42) {
          u = 18;
          v = 242;
        }
      }
      data[index] = u;
      data[index + 1] = v;
      data[index + 2] = 0;
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, SIMULATION_SIZE, SIMULATION_SIZE, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function ReactionField({controls, resetSeed}: {controls: ReactionControls; resetSeed: number}) {
  const targetA = useFBO(SIMULATION_SIZE, SIMULATION_SIZE, {depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType});
  const targetB = useFBO(SIMULATION_SIZE, SIMULATION_SIZE, {depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType});
  const displayMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const draggingRef = useRef(false);
  const seedTexture = useMemo(() => createSeedTexture(resetSeed), [resetSeed]);
  const sourceRef = useRef<THREE.Texture>(seedTexture);
  const nextTargetRef = useRef(targetA);
  const simulationScene = useMemo(() => new THREE.Scene(), []);
  const simulationCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const simulationMaterial = useMemo(() => new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    vertexShader,
    fragmentShader: simulationFragmentShader,
    uniforms: {
      uState: {value: seedTexture}, uTexel: {value: new THREE.Vector2(1 / SIMULATION_SIZE, 1 / SIMULATION_SIZE)},
      uFeed: {value: 0.0367}, uKill: {value: 0.0649}, uDiffusionU: {value: 0.2}, uDiffusionV: {value: 0.1},
      uBrush: {value: new THREE.Vector2(0.5, 0.5)}, uBrushRadius: {value: 0.025}, uBrushActive: {value: 0},
    },
  }), [seedTexture]);
  const displayUniforms = useMemo(() => ({
    uState: {value: seedTexture}, uTexel: {value: new THREE.Vector2(1 / SIMULATION_SIZE, 1 / SIMULATION_SIZE)}, uContrast: {value: 1.45},
  }), [seedTexture]);

  useEffect(() => {
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simulationMaterial);
    simulationScene.add(quad);
    return () => {
      simulationScene.remove(quad);
      quad.geometry.dispose();
      simulationMaterial.dispose();
    };
  }, [simulationMaterial, simulationScene]);

  useEffect(() => {
    sourceRef.current = seedTexture;
    nextTargetRef.current = targetA;
    return () => seedTexture.dispose();
  }, [seedTexture, targetA]);

  useEffect(() => {
    const release = () => { draggingRef.current = false; };
    window.addEventListener('pointerup', release);
    return () => window.removeEventListener('pointerup', release);
  }, []);

  useFrame((state) => {
    const renderer = state.gl;
    const previousTarget = renderer.getRenderTarget();
    simulationMaterial.uniforms.uFeed.value = controls.feed;
    simulationMaterial.uniforms.uKill.value = controls.kill;
    simulationMaterial.uniforms.uDiffusionU.value = controls.diffusionU;
    simulationMaterial.uniforms.uDiffusionV.value = controls.diffusionV;
    simulationMaterial.uniforms.uBrush.value.set(state.pointer.x * 0.5 + 0.5, state.pointer.y * 0.5 + 0.5);
    simulationMaterial.uniforms.uBrushRadius.value = controls.brushRadius;
    simulationMaterial.uniforms.uBrushActive.value = draggingRef.current ? 1 : 0;
    for (let step = 0; step < Math.round(controls.stepsPerFrame); step++) {
      simulationMaterial.uniforms.uState.value = sourceRef.current;
      renderer.setRenderTarget(nextTargetRef.current);
      renderer.render(simulationScene, simulationCamera);
      sourceRef.current = nextTargetRef.current.texture;
      nextTargetRef.current = nextTargetRef.current === targetA ? targetB : targetA;
    }
    renderer.setRenderTarget(previousTarget);
    if (displayMaterialRef.current) {
      displayMaterialRef.current.uniforms.uState.value = sourceRef.current;
      displayMaterialRef.current.uniforms.uContrast.value = controls.contrast;
    }
  });

  return (
    <mesh
      frustumCulled={false}
      onPointerDown={(event) => { event.stopPropagation(); draggingRef.current = true; }}
    >
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={displayMaterialRef} depthTest={false} depthWrite={false} fragmentShader={displayFragmentShader} uniforms={displayUniforms} vertexShader={vertexShader} />
    </mesh>
  );
}

export default function Demo050WeatherSnowScene() {
  const [resetSeed, setResetSeed] = useState(1);
  const controls = useControls('Gray-Scott Reaction', {
    feed: {value: 0.0367, min: 0.015, max: 0.07, step: 0.0001, label: 'Feed rate F'},
    kill: {value: 0.0649, min: 0.035, max: 0.075, step: 0.0001, label: 'Kill rate K'},
    diffusionU: {value: 0.2, min: 0.12, max: 0.28, step: 0.005, label: 'Diffusion U'},
    diffusionV: {value: 0.1, min: 0.05, max: 0.16, step: 0.005, label: 'Diffusion V'},
    stepsPerFrame: {value: 7, min: 1, max: 14, step: 1, label: 'Solver steps/frame'},
    brushRadius: {value: 0.026, min: 0.008, max: 0.07, step: 0.002, label: 'Injection radius'},
    contrast: {value: 1.45, min: 0.8, max: 2.2, step: 0.01, label: 'Chemical contrast'},
  }) as ReactionControls;

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#02050a'}}>
      <DemoScene engineConfig={{background: '#02050a', camera: {position: [0, 0, 1], fov: 50, near: 0.1, far: 10}}} orbitControls={false}>
        <ReactionField controls={controls} resetSeed={resetSeed} />
      </DemoScene>
      <div style={reactionControlsStyle}>
        <button onClick={() => setResetSeed(value => value + 1)} style={resetButtonStyle} type="button">Reset field</button>
        <span>PRESS + DRAG TO INJECT V</span>
      </div>
    </div>
  );
}

const reactionControlsStyle = {
  position: 'absolute', left: '50%', bottom: 18, display: 'flex', alignItems: 'center', gap: 10,
  transform: 'translateX(-50%)', padding: 7, border: '1px solid rgba(89,222,231,0.2)', borderRadius: 6,
  background: 'rgba(3,8,13,0.8)', color: '#789ba3', fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 10,
} as const;

const resetButtonStyle = {
  border: '1px solid rgba(89,222,231,0.3)', borderRadius: 5, background: 'rgba(89,222,231,0.08)',
  color: '#d8f5f4', cursor: 'pointer', padding: '7px 9px', font: 'inherit', fontWeight: 700,
} as const;
