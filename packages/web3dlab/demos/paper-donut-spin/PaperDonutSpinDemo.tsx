import React, {useMemo, useRef} from 'react';
import { resolveDonutEffectConfig } from '@paper-to-video/content-pipeline';
import * as THREE from 'three';
import {useFrame, useThree} from '@react-three/fiber';
import {useControls} from 'leva';
import {DemoScene} from '../../core/DemoScene';
import {createDonutMeshes} from './core/createDonutMeshes';

import {applyOrbitRig} from '../../shared/updateCameraRigs';
import type {DonutOrbitSeed} from './donut-spin.types';

const hashNoise = (value: number) => {
  const resolved = Math.sin(value * 12.9898) * 43758.5453;
  return resolved - Math.floor(resolved);
};

const buildOrbitSeeds = (count: number, seed: number): DonutOrbitSeed[] =>
  Array.from({length: count}, (_, index) => ({
    angle: hashNoise(seed * 101 + index * 3.7) * Math.PI * 2,
    lane: hashNoise(seed * 211 + index * 5.1),
    offset: hashNoise(seed * 307 + index * 7.9) * 2 - 1,
    pulse: hashNoise(seed * 401 + index * 11.3) * Math.PI * 2,
    speed: 0.7 + hashNoise(seed * 503 + index * 13.1) * 0.8,
  }));

export function DonutSpinEffect({ seed = 1, absoluteFrame, simulationFrame }: { seed?: number; absoluteFrame?: number; simulationFrame?: number }) {
  const { camera } = useThree();
  const rootGroup = useRef<THREE.Group>(null);
  const helper = useMemo(() => new THREE.Object3D(), []);
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);
  
  const config = useMemo(() => resolveDonutEffectConfig(undefined), []);
  const seeds = useMemo(() => buildOrbitSeeds(config.pearlCount, seed), [config.pearlCount, seed]);

  const bundle = useMemo(() => {
    const root = new THREE.Group();
    root.position.set(0, -1.02, 0);
    return { bundle: createDonutMeshes({
      pearlCount: config.pearlCount,
      primaryColor: config.primaryColor,
      radius: config.ringRadius,
      root: root,
      secondaryColor: config.secondaryColor,
      tubeRadius: config.tubeRadius,
    }), root };
  }, [config]);

  // Clean up geometries/materials on unmount
  React.useEffect(() => {
    return () => {
      bundle.bundle.bodyGeometry.dispose();
      bundle.bundle.bodyMaterial.dispose();
      bundle.bundle.glowGeometry.dispose();
      bundle.bundle.glowMaterial.dispose();
      bundle.bundle.wireGeometry.dispose();
      bundle.bundle.wireMaterial.dispose();
      bundle.bundle.pearlGeometry.dispose();
      bundle.bundle.pearlMaterial.dispose();
      bundle.bundle.shadowDisc.geometry.dispose();
      bundle.bundle.shadowDisc.material.dispose();
      bundle.bundle.haloDisc.geometry.dispose();
      bundle.bundle.haloDisc.material.dispose();
    };
  }, [bundle]);

  useFrame((state) => {
    const resolvedFrame = simulationFrame ?? absoluteFrame;
    const timeInSeconds = resolvedFrame !== undefined ? resolvedFrame / 60 : state.clock.elapsedTime;
    const time = timeInSeconds * 60 * 0.016 * config.spinSpeed + seed * 0.0017;
    
    bundle.bundle.bodyMaterial.color.set(config.primaryColor);
    bundle.bundle.bodyMaterial.emissive.set(config.secondaryColor).multiplyScalar(config.glowIntensity * 0.048);
    bundle.bundle.glowMaterial.color.set(config.secondaryColor);
    bundle.bundle.glowMaterial.opacity = 0.012 + config.glowIntensity * 0.018;
    bundle.bundle.wireMaterial.color.set(config.accentColor);
    bundle.bundle.wireMaterial.opacity = 0.14 + config.glowIntensity * 0.08;
    bundle.bundle.haloDisc.material.color.set(config.secondaryColor);
    bundle.bundle.shadowDisc.material.opacity = 0.1;
    bundle.bundle.haloDisc.material.opacity = 0;

    bundle.root.rotation.x = Math.sin(time * 0.42) * config.wobbleAmount * 0.38;
    bundle.root.rotation.y = time * 0.58 * config.spinSpeed;
    bundle.root.rotation.z = Math.cos(time * 0.33) * config.wobbleAmount * 0.24;

    applyOrbitRig({
      camera: camera as THREE.PerspectiveCamera,
      target: cameraTarget,
      time,
      orbitSpeed: 0.16 * config.orbitSpeed,
      radius: 7.45,
      radiusJitter: 0.12,
      centerY: 0.92,
      heightJitter: 0.05,
      lateralJitter: 0.14,
      targetY: -0.44,
      targetYJitter: 0.03,
      targetZ: 0,
      targetZJitter: 0.08,
    });

    const orbitRadius = config.ringRadius + config.tubeRadius * 1.42;
    seeds.forEach((s, index) => {
      const pearlTime = time * config.orbitSpeed * s.speed + s.pulse;
      const angle = s.angle + pearlTime;
      const wobble = Math.sin(pearlTime * 0.9 + s.offset) * config.wobbleAmount * 0.22;
      const radial = orbitRadius + Math.sin(pearlTime * 0.47 + s.lane * Math.PI * 2) * config.tubeRadius * 0.26;
      const scale = 0.72 + s.lane * 0.6 + Math.sin(pearlTime * 1.4) * 0.08;
      
      helper.position.set(
        Math.cos(angle) * radial,
        wobble,
        Math.sin(angle) * radial,
      );
      helper.scale.setScalar(scale);
      helper.updateMatrix();
      bundle.bundle.pearlMesh.setMatrixAt(index, helper.matrix);

      const color = new THREE.Color(config.secondaryColor).lerp(new THREE.Color(config.accentColor), s.lane * 0.72);
      bundle.bundle.pearlMesh.setColorAt(index, color);
    });
    
    bundle.bundle.pearlMesh.instanceMatrix.needsUpdate = true;
    if (bundle.bundle.pearlMesh.instanceColor) {
      bundle.bundle.pearlMesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <primitive object={bundle.root} />
      <primitive object={bundle.bundle.shadowDisc.mesh} />
      <primitive object={bundle.bundle.haloDisc.mesh} />
      <ambientLight intensity={0.68} color="#f0f4ff" />
      <directionalLight position={[5.4, 4.6, 6.2]} intensity={1.08} color="#ffffff" />
      <directionalLight position={[-5.2, 1.8, 4.8]} intensity={0.34} color="#ff8fd2" />
      <directionalLight position={[-3.5, 3.6, -5.6]} intensity={0.72} color="#7de7ff" />
      <fog attach="fog" args={[0x050913, 8, 22]} />
    </>
  );
}

export default function PaperDonutSpinDemo() {
  const { showStats } = useControls('Debug', { showStats: false });
  
  return (
    <DemoScene
      debug={showStats}
      engineConfig={{
        background: '#000000',
        camera: { fov: 34, far: 100, near: 0.1, position: [0, 0.92, 7.7] },
        bloom: { intensity: 0.22, luminanceThreshold: 0.38, luminanceSmoothing: 0.28 },
      }}
      orbitControls={false}
    >
      <DonutSpinEffect seed={1} />
    </DemoScene>
  );
}
