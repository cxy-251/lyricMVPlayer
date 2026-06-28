import React, {useMemo, useRef} from 'react';
import { resolveRubiksEffectConfig } from '@paper-to-video/content-pipeline';
import * as THREE from 'three';
import {useFrame, useThree} from '@react-three/fiber';
import {useControls} from 'leva';
import {DemoScene} from '../../core/DemoScene';

import {createStageDisc} from '../../core/createStageDisc';
import {applyOrbitRig} from '../../core/updateCameraRigs';
import {buildRubiksSequenceCache, applyRubiksMoveProgress} from './core/applyRubiksMove';
import {createRubiksCubelets} from './core/createRubiksCubelets';
import {updateRubiksCubelets} from './core/updateRubiksCubelets';

const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

export function RubiksCubeEffect({ seed = 1, absoluteFrame, simulationFrame }: { seed?: number; absoluteFrame?: number; simulationFrame?: number }) {
  const { camera, scene } = useThree();
  const rootGroup = useRef<THREE.Group>(null);
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);
  
  const config = useMemo(() => resolveRubiksEffectConfig(undefined), []);
  const sequence = useMemo(() => buildRubiksSequenceCache(seed), [seed]);

  const bundle = useMemo(() => {
    const root = new THREE.Group();
    const cubeCore = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 1.85, 1.85),
      new THREE.MeshStandardMaterial({
        color: 0x090b0e,
        metalness: 0.08,
        roughness: 0.92,
      }),
    );
    cubeCore.scale.setScalar(1.36);
    root.add(cubeCore);

    const contactShadow = createStageDisc({
      color: 0x04070b,
      opacity: 0.22,
      radius: 2.68,
      y: -3.12,
    });
    const haloPlane = createStageDisc({
      additive: true,
      color: 0x153455,
      opacity: 0.07,
      radius: 4.6,
      scaleY: 0.94,
      y: -3.16,
      z: 0.08,
      segments: 64,
    });

    return {
      root,
      cubeCore,
      contactShadow,
      haloPlane,
      bundle: createRubiksCubelets({ root }),
    };
  }, []);

  React.useEffect(() => {
    scene.fog = new THREE.Fog(0x081019, 12, 28);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  React.useEffect(() => {
    return () => {
      bundle.bundle.cubelets.forEach((c) => {
        c.object.traverse((node: any) => {
          if (!node.isMesh) return;
          if (Array.isArray(node.material)) {
            node.material.forEach((m: any) => m.dispose());
          } else {
            node.material.dispose();
          }
        });
      });
      bundle.bundle.bodyGeometry.dispose();
      bundle.bundle.stickerGeometry.dispose();
      bundle.cubeCore.geometry.dispose();
      if (Array.isArray(bundle.cubeCore.material)) {
        bundle.cubeCore.material.forEach((m: any) => m.dispose());
      } else {
        (bundle.cubeCore.material as any).dispose();
      }
      bundle.contactShadow.geometry.dispose();
      bundle.contactShadow.material.dispose();
      bundle.haloPlane.geometry.dispose();
      bundle.haloPlane.material.dispose();
    };
  }, [bundle]);

  useFrame((state) => {
    const resolvedFrame = simulationFrame ?? absoluteFrame;
    const timeInSeconds = resolvedFrame !== undefined ? resolvedFrame / 60 : state.clock.elapsedTime;
    const frame = timeInSeconds * 60;
    
    const cycle = Math.max(1, config.turnFrames + config.holdFrames);
    const stepIndex = Math.floor(frame / cycle);
    const stepFrame = frame % cycle;
    const lastState = sequence.statesByStep[sequence.statesByStep.length - 1];

    let states = lastState;
    if (stepIndex < sequence.solve.length) {
      if (stepFrame < config.turnFrames) {
        const progress = easeInOutCubic(stepFrame / Math.max(1, config.turnFrames));
        states = applyRubiksMoveProgress(
          sequence.statesByStep[stepIndex],
          sequence.solve[stepIndex],
          progress,
        );
      } else {
        states = sequence.statesByStep[Math.min(stepIndex + 1, sequence.statesByStep.length - 1)];
      }
    }

    updateRubiksCubelets({
      cubieGap: config.cubieGap,
      cubelets: bundle.bundle.cubelets,
      states,
    });

    const time = frame * 0.018 + seed * 0.0061;
    const settleProgress = Math.min(1, frame / 96);
    const cameraRadius = 7.3 - settleProgress * 0.48;

    bundle.root.scale.setScalar(config.cubeScale);
    bundle.root.position.set(0, Math.sin(time * 0.72) * config.floatAmplitude, 0);
    bundle.root.rotation.set(
      -0.48 + Math.sin(time * 0.48) * config.cameraDrift * 0.32,
      0.62 + Math.cos(time * 0.31) * config.cameraDrift * 0.2,
      Math.sin(time * 0.58) * config.cameraDrift * 0.16,
    );

    applyOrbitRig({
      camera: camera as THREE.PerspectiveCamera,
      target: cameraTarget,
      time,
      orbitSpeed: 0.36,
      radius: cameraRadius,
      radiusJitter: 0.12,
      centerY: 4.15,
      heightJitter: config.cameraDrift * 1.9,
      targetY: 0.1,
      targetYJitter: 0.12,
    });

    bundle.contactShadow.mesh.scale.setScalar(1 + Math.sin(time * 0.64) * 0.03);
    bundle.haloPlane.mesh.scale.setScalar(1 + Math.cos(time * 0.38) * 0.04);
  });

  return (
    <>
      <primitive object={bundle.root} />
      <primitive object={bundle.contactShadow.mesh} />
      <primitive object={bundle.haloPlane.mesh} />
      <ambientLight intensity={1.42} color="#eaf1ff" />
      <hemisphereLight args={[0xf6fbff, 0x0b0f15, 1.1]} />
      <directionalLight position={[7, 9, 10]} intensity={1.42} color="#ffffff" />
      <directionalLight position={[-6, 2.5, 7]} intensity={0.42} color="#ffd4ab" />
      <directionalLight position={[-8, 5, -8]} intensity={0.96} color="#8fd2ff" />
    </>
  );
}

export default function Demo021PaperRubiksCube() {
  const { showStats } = useControls('Debug', { showStats: false });
  
  return (
    <DemoScene
      debug={showStats}
      engineConfig={{
        background: '#000000',
        camera: { fov: 34, far: 100, near: 0.1, position: [5.8, 4.2, 7.3] },
      }}
      orbitControls={false}
    >
      <RubiksCubeEffect seed={1} />
    </DemoScene>
  );
}
