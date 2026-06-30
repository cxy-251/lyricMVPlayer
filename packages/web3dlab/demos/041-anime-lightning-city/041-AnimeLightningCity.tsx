import {useGLTF} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useMemo, useRef, useState} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

import cityGlbUrl from './assets/anime_lightning_city.glb?url';

type LightningControls = {
  boltCount: number;
  intensity: number;
  shake: number;
  branches: number;
};

type BoltTube = {
  color: string;
  curve: THREE.CatmullRomCurve3;
  id: string;
  opacity: number;
  radius: number;
};

const cloneMaterial = (material: THREE.Material | THREE.Material[]) => (
  Array.isArray(material) ? material.map(item => item.clone()) : material.clone()
);

const createRandom = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const makeBoltTubes = (controls: LightningControls, tick: number): BoltTube[] => {
  const random = createRandom(9301 + tick * 101 + controls.boltCount * 17 + controls.branches * 31);
  const tubes: BoltTube[] = [];
  const segments = 11;

  for (let boltIndex = 0; boltIndex < controls.boltCount; boltIndex += 1) {
    const lineT = controls.boltCount === 1 ? 0.5 : boltIndex / (controls.boltCount - 1);
    const startX = -3.05 + lineT * 6.1 + (random() - 0.5) * 0.18;
    const endX = startX + (random() - 0.5) * 0.72;
    const points = Array.from({length: segments + 1}, (_, index) => {
      const t = index / segments;
      const taper = 1 - Math.abs(t - 0.5) * 0.85;
      return new THREE.Vector3(
        startX + (endX - startX) * t + (random() - 0.5) * 0.54 * taper,
        2.65 - t * 3.72 + (random() - 0.5) * 0.1,
        0.08 + (random() - 0.5) * 0.36,
      );
    });

    tubes.push({
      color: '#3f8cff',
      curve: new THREE.CatmullRomCurve3(points),
      id: `bolt-${tick}-${boltIndex}-glow`,
      opacity: 0.22 + controls.intensity * 0.08,
      radius: 0.048,
    });
    tubes.push({
      color: '#f8fbff',
      curve: new THREE.CatmullRomCurve3(points),
      id: `bolt-${tick}-${boltIndex}-core`,
      opacity: 0.72,
      radius: 0.012,
    });

    for (let branchIndex = 0; branchIndex < controls.branches; branchIndex += 1) {
      const anchorIndex = 2 + Math.floor(random() * (segments - 3));
      const anchor = points[anchorIndex];
      const direction = random() > 0.5 ? 1 : -1;
      const end = anchor.clone().add(new THREE.Vector3(
        direction * (0.28 + random() * 0.68),
        -0.16 - random() * 0.62,
        (random() - 0.5) * 0.52,
      ));
      const mid = anchor.clone().lerp(end, 0.55).add(new THREE.Vector3((random() - 0.5) * 0.22, (random() - 0.5) * 0.16, 0));
      tubes.push({
        color: branchIndex % 2 ? '#95caff' : '#ffffff',
        curve: new THREE.CatmullRomCurve3([anchor, mid, end]),
        id: `bolt-${tick}-${boltIndex}-branch-${branchIndex}`,
        opacity: 0.38 + controls.intensity * 0.08,
        radius: 0.007,
      });
    }
  }

  return tubes;
};

function BlenderCityAsset() {
  const {scene} = useGLTF(cityGlbUrl);
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

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.18) * 0.018;
  });

  return (
    <group ref={groupRef} position={[0, -1.42, -0.35]} scale={0.92}>
      <primitive object={model} />
    </group>
  );
}

function StormBackdrop() {
  return (
    <group>
      <mesh position={[0, 0.65, -1.35]}>
        <planeGeometry args={[9.5, 6.2]} />
        <meshBasicMaterial color="#030816" />
      </mesh>
      <mesh position={[0, 1.35, -1.3]}>
        <planeGeometry args={[9.5, 2.6]} />
        <meshBasicMaterial color="#071b49" transparent opacity={0.72} />
      </mesh>
      <mesh position={[0, -1.15, -1.28]}>
        <planeGeometry args={[9.5, 1.6]} />
        <meshBasicMaterial color="#01030a" transparent opacity={0.95} />
      </mesh>
    </group>
  );
}

function LightningRig({controls}: {controls: LightningControls}) {
  const [tick, setTick] = useState(0);
  const lastTickRef = useRef(-1);
  const groupRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const stormLightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    const nextTick = Math.floor(elapsed * (6.5 + controls.intensity * 4.2));
    if (nextTick !== lastTickRef.current) {
      lastTickRef.current = nextTick;
      setTick(nextTick);
    }

    const flash = Math.max(0, Math.sin(elapsed * 10.8) - 0.42) * controls.intensity;
    const shake = controls.shake * flash * 0.035;
    if (groupRef.current) {
      groupRef.current.position.x = Math.sin(elapsed * 73) * shake;
      groupRef.current.position.y = Math.cos(elapsed * 61) * shake * 0.65;
    }
    if (flashRef.current) {
      const material = flashRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.min(0.3, flash * 0.14);
    }
    if (stormLightRef.current) {
      stormLightRef.current.intensity = 1.2 + flash * 8.5;
    }
  });

  const tubes = useMemo(
    () => makeBoltTubes(controls, tick),
    [controls.boltCount, controls.branches, controls.intensity, tick],
  );

  return (
    <group ref={groupRef}>
      <StormBackdrop />
      <ambientLight intensity={0.18} />
      <pointLight ref={stormLightRef} position={[0, 1.9, 2.8]} intensity={3.2} color="#74a8ff" distance={8} />
      <BlenderCityAsset />
      <group>
        {tubes.map(tube => (
          <mesh key={tube.id}>
            <tubeGeometry args={[tube.curve, 18, tube.radius, 5, false]} />
            <meshBasicMaterial color={tube.color} transparent opacity={tube.opacity} toneMapped={false} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <mesh ref={flashRef} position={[0, 0.38, 0.72]} renderOrder={20}>
        <planeGeometry args={[9.5, 5.8]} />
        <meshBasicMaterial color="#dbeafe" transparent opacity={0} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function Demo041AnimeLightningCity() {
  const controls = useControls('Anime Lightning City', {
    boltCount: {value: 5, min: 1, max: 12, step: 1},
    intensity: {value: 0.86, min: 0.2, max: 1.6, step: 0.01},
    shake: {value: 0.6, min: 0, max: 1.4, step: 0.01},
    branches: {value: 4, min: 0, max: 10, step: 1},
  }) as LightningControls;

  return (
    <DemoScene
      engineConfig={{
        background: '#020617',
        camera: {position: [0, 0.45, 7.1], fov: 44, near: 0.1, far: 40},
        bloom: {intensity: 0.85 * controls.intensity, luminanceSmoothing: 0.46, luminanceThreshold: 0.08},
        chromaticAberration: {offset: [0.0006 * controls.shake, 0.0009 * controls.shake]},
        vignette: {darkness: 0.48, offset: 0.34},
      }}
      orbitConfig={{autoRotate: false, enablePan: false, enableZoom: true, minDistance: 4.2, maxDistance: 11}}
    >
      <LightningRig controls={controls} />
    </DemoScene>
  );
}

useGLTF.preload(cityGlbUrl);
