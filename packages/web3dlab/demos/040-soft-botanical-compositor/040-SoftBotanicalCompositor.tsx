import {useGLTF} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

import botanicalGlbUrl from './assets/soft_botanical.glb?url';

type BotanicalControls = {
  branchReveal: number;
  fruitGlow: number;
  sway: number;
  softness: number;
};

const TOTAL_BRANCHES = 12;

const cloneMaterial = (material: THREE.Material | THREE.Material[]) => (
  Array.isArray(material) ? material.map(item => item.clone()) : material.clone()
);

const getBranchIndex = (name: string) => {
  const match = /(?:branch|fruit|bud)_(\d{2})/.exec(name);
  return match ? Number(match[1]) : -1;
};

function BlenderBotanicalAsset({controls}: {controls: BotanicalControls}) {
  const {scene} = useGLTF(botanicalGlbUrl);
  const groupRef = useRef<THREE.Group>(null);

  const model = useMemo(() => {
    const clonedScene = scene.clone(true);
    clonedScene.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = cloneMaterial(mesh.material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    });
    return clonedScene;
  }, [scene]);

  useEffect(() => {
    const center = (TOTAL_BRANCHES - 1) / 2;
    model.traverse(object => {
      const branchIndex = getBranchIndex(object.name);
      if (branchIndex >= 0) {
        object.visible = Math.abs(branchIndex - center) <= controls.branchReveal / 2;
      }

      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(material => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return;
        if (object.name.startsWith('fruit_')) {
          material.emissive.set('#ff5f94');
          material.emissiveIntensity = 0.05 + controls.fruitGlow * 0.22;
          material.roughness = 0.34;
        } else if (object.name.startsWith('bud_')) {
          material.emissive.set('#ffb07a');
          material.emissiveIntensity = 0.04 + controls.fruitGlow * 0.12;
        } else if (object.name.startsWith('branch_')) {
          material.emissive.set('#fff6e8');
          material.emissiveIntensity = 0.015 + controls.softness * 0.035;
        }
        material.needsUpdate = true;
      });
    });
  }, [controls.branchReveal, controls.fruitGlow, controls.softness, model]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const elapsed = state.clock.elapsedTime;
    groupRef.current.rotation.y = Math.sin(elapsed * 0.3) * controls.sway * 0.07;
    groupRef.current.rotation.z = Math.sin(elapsed * 0.22) * controls.sway * 0.03;
    groupRef.current.scale.setScalar(1.02 + Math.sin(elapsed * 0.18) * controls.softness * 0.01);
  });

  return (
    <group ref={groupRef} position={[0, -0.05, 0]} scale={1.05}>
      <primitive object={model} />
    </group>
  );
}

export default function Demo040SoftBotanicalCompositor() {
  const controls = useControls('Soft Botanical Compositor', {
    branchReveal: {value: 12, min: 4, max: 12, step: 1},
    fruitGlow: {value: 0.86, min: 0, max: 1.6, step: 0.01},
    sway: {value: 0.82, min: 0, max: 1.6, step: 0.01},
    softness: {value: 0.9, min: 0, max: 1.6, step: 0.01},
  }) as BotanicalControls;

  return (
    <DemoScene
      engineConfig={{
        background: '#f4f0ec',
        camera: {position: [0, 0.1, 6.2], fov: 42, near: 0.1, far: 30},
        bloom: {intensity: 0.55 * controls.softness, luminanceSmoothing: 0.62, luminanceThreshold: 0.18},
        vignette: {darkness: 0.18, offset: 0.42},
      }}
      orbitConfig={{autoRotate: true, autoRotateSpeed: 0.28, minDistance: 4, maxDistance: 10}}
    >
      <ambientLight intensity={0.9} />
      <pointLight position={[2.2, 3.8, 4.2]} intensity={2.3} color="#fff7ee" />
      <pointLight position={[-3, -1.2, 2]} intensity={1.1} color="#ffd7e3" />
      <BlenderBotanicalAsset controls={controls} />
    </DemoScene>
  );
}

useGLTF.preload(botanicalGlbUrl);
