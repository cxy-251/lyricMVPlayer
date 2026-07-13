import {useGLTF} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

import botanicalGlbUrl from './assets/soft_botanical.glb?url';

type BotanicalControls = {
  signalSpeed: number;
  signalWidth: number;
  branchEnergy: number;
  fruitResponse: number;
  sway: number;
};

type SignalKind = 'branch' | 'fruit' | 'bud';

const cloneMaterial = (material: THREE.Material | THREE.Material[]) => (
  Array.isArray(material) ? material.map(item => item.clone()) : material.clone()
);

function installSignalShader(material: THREE.MeshStandardMaterial, kind: SignalKind) {
  material.color.set(kind === 'branch' ? '#173b39' : kind === 'fruit' ? '#4d1230' : '#58331c');
  material.emissive.set('#000000');
  material.metalness = kind === 'branch' ? 0.2 : 0.42;
  material.roughness = kind === 'branch' ? 0.55 : 0.28;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSignalTime = {value: 0};
    shader.uniforms.uSignalSpeed = {value: 0.16};
    shader.uniforms.uSignalWidth = {value: 0.1};
    shader.uniforms.uSignalEnergy = {value: 1};
    shader.uniforms.uResponse = {value: kind === 'fruit' ? 1.8 : kind === 'bud' ? 1.3 : 0.8};
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vSignalWorldPosition;\nvoid main() {')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n  vSignalWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform float uSignalTime;
uniform float uSignalSpeed;
uniform float uSignalWidth;
uniform float uSignalEnergy;
uniform float uResponse;
varying vec3 vSignalWorldPosition;
void main() {`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float signalHeight = clamp((vSignalWorldPosition.y + 1.75) / 3.55, 0.0, 1.0);
float signalHead = fract(uSignalTime * uSignalSpeed);
float signalDistance = abs(signalHeight - signalHead);
signalDistance = min(signalDistance, 1.0 - signalDistance);
float signalPulse = exp(-pow(signalDistance / max(0.025, uSignalWidth), 2.0));
float vessel = 0.62 + 0.38 * sin(vSignalWorldPosition.y * 18.0 + vSignalWorldPosition.x * 8.0 - uSignalTime * 2.0);
vec3 signalColor = mix(vec3(0.05, 0.78, 0.68), vec3(0.38, 1.0, 0.82), signalPulse);
totalEmissiveRadiance += signalColor * signalPulse * vessel * uSignalEnergy * uResponse;`,
      );
    material.userData.signalShader = shader;
  };
  material.customProgramCacheKey = () => `botanical-signal-${kind}`;
  material.needsUpdate = true;
}

function BotanicalSignalAsset({controls}: {controls: BotanicalControls}) {
  const {scene} = useGLTF(botanicalGlbUrl);
  const groupRef = useRef<THREE.Group>(null);
  const model = useMemo(() => {
    const clonedScene = scene.clone(true);
    clonedScene.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = cloneMaterial(mesh.material);
      const kind: SignalKind = object.name.startsWith('fruit_')
        ? 'fruit'
        : object.name.startsWith('bud_')
          ? 'bud'
          : 'branch';
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(material => {
        if (material instanceof THREE.MeshStandardMaterial) installSignalShader(material, kind);
      });
    });
    return clonedScene;
  }, [scene]);

  useEffect(() => () => {
    model.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(material => material.dispose());
    });
  }, [model]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    model.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(material => {
        const shader = material.userData.signalShader as THREE.WebGLProgramParametersWithUniforms | undefined;
        if (!shader) return;
        shader.uniforms.uSignalTime.value = time;
        shader.uniforms.uSignalSpeed.value = controls.signalSpeed;
        shader.uniforms.uSignalWidth.value = controls.signalWidth;
        shader.uniforms.uSignalEnergy.value = object.name.startsWith('fruit_')
          ? controls.fruitResponse
          : controls.branchEnergy;
      });
    });
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(time * 0.22) * controls.sway * 0.07;
      groupRef.current.rotation.z = Math.sin(time * 0.17) * controls.sway * 0.018;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.05, 0]} scale={1.08}>
      <primitive object={model} />
    </group>
  );
}

function RootEmitter({controls}: {controls: BotanicalControls}) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ringRef.current) return;
    const phase = (state.clock.elapsedTime * controls.signalSpeed) % 1;
    const scale = 0.5 + phase * 1.5;
    ringRef.current.scale.setScalar(scale);
    const material = ringRef.current.material as THREE.MeshBasicMaterial;
    material.opacity = (1 - phase) * 0.28 * controls.branchEnergy;
  });
  return (
    <group position={[0, -1.78, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.34, 48]} />
        <meshBasicMaterial color="#063b35" />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.31, 0.34, 64]} />
        <meshBasicMaterial blending={THREE.AdditiveBlending} color="#4dffe0" depthWrite={false} transparent />
      </mesh>
    </group>
  );
}

export default function Demo040SoftBotanicalCompositor() {
  const controls = useControls('Botanical Signal', {
    signalSpeed: {value: 0.16, min: 0.05, max: 0.42, step: 0.01, label: 'Signal velocity'},
    signalWidth: {value: 0.1, min: 0.04, max: 0.22, step: 0.01, label: 'Pulse width'},
    branchEnergy: {value: 1.05, min: 0.35, max: 1.6, step: 0.01, label: 'Vessel energy'},
    fruitResponse: {value: 1.25, min: 0.45, max: 1.8, step: 0.01, label: 'Fruit response'},
    sway: {value: 0.42, min: 0, max: 0.85, step: 0.01, label: 'Specimen sway'},
  }) as BotanicalControls;

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#020a09'}}>
      <DemoScene
        engineConfig={{
          background: '#020a09',
          bloom: {intensity: 0.72, luminanceSmoothing: 0.7, luminanceThreshold: 0.34},
          camera: {position: [0, 0.05, 5.8], fov: 40, near: 0.1, far: 30},
          fog: {color: '#020a09', near: 7, far: 14},
          vignette: {darkness: 0.52, offset: 0.26},
        }}
        orbitConfig={{autoRotate: false, enablePan: false, minDistance: 4, maxDistance: 9}}
      >
        <ambientLight intensity={0.22} />
        <directionalLight color="#b9ffe8" intensity={1.8} position={[3, 4, 4]} />
        <pointLight color="#ff4f9a" intensity={0.7} position={[-2.5, 0.8, 2]} />
        <RootEmitter controls={controls} />
        <BotanicalSignalAsset controls={controls} />
      </DemoScene>
      <div style={signalLegendStyle}>
        <strong>ROOT → CANOPY</strong>
        <span>vascular signal transport</span>
      </div>
    </div>
  );
}

const signalLegendStyle = {
  position: 'absolute', left: 18, bottom: 18, display: 'grid', gap: 3,
  padding: '8px 10px', border: '1px solid rgba(83,255,218,0.2)', borderRadius: 6,
  background: 'rgba(2,12,10,0.8)', color: '#7aa79e', pointerEvents: 'none',
  fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace', fontSize: 10,
} as const;

useGLTF.preload(botanicalGlbUrl);
