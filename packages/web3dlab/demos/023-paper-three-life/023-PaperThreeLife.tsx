import React, {useMemo, useState} from 'react';
import { resolveCellularEffectConfig } from '@paper-to-video/content-pipeline';
import { buildCellularLifeCells } from './core/cellular-life-simulation';
import * as THREE from 'three';
import {useFrame, useThree} from '@react-three/fiber';
import {useControls} from 'leva';
import {OrthographicCamera} from '@react-three/drei';
import {DemoScene} from '../../core/DemoScene';


import {createLifeMeshes} from './core/createLifeMeshes';
import {updateLifeInstances} from './core/updateLifeInstances';

export function ThreeLifeEffect({ seed = 1, absoluteFrame, simulationFrame }: { seed?: number; absoluteFrame?: number; simulationFrame?: number }) {
  const { size, scene } = useThree();
  const helper = useMemo(() => new THREE.Object3D(), []);
  
  const config = useMemo(() => resolveCellularEffectConfig(undefined), []);

  const meshBundle = useMemo(() => {
    return createLifeMeshes({
      config,
      scene,
    });
  }, [config, scene]);

  React.useEffect(() => {
    return () => {
      if (!meshBundle) return;
      meshBundle.geometry.dispose();
      const disposeLayer = (layer: any) => {
        if (!layer) return;
        if (Array.isArray(layer.material)) {
          layer.material.forEach((m: any) => m.dispose());
        } else {
          layer.material.dispose();
        }
        scene.remove(layer.mesh);
        layer.mesh.dispose();
      };
      disposeLayer(meshBundle.birth);
      disposeLayer(meshBundle.primary);
      disposeLayer(meshBundle.secondary);
    };
  }, [meshBundle, scene]);

  useFrame((state) => {
    const resolvedFrame = simulationFrame ?? absoluteFrame;
    const timeInSeconds = resolvedFrame !== undefined ? resolvedFrame / 60 : state.clock.elapsedTime;
    const frame = timeInSeconds * 60;
    
    const cells = buildCellularLifeCells({
      cols: Math.max(1, Math.round(config.cellColumns)),
      rows: Math.max(1, Math.round(config.cellRows)),
      globalFrame: frame,
      activationFrame: 0,
      seed,
      stepEveryFrames: config.stepEveryFrames,
    });

    updateLifeInstances({
      cells,
      config,
      helper,
      height: size.height,
      meshes: meshBundle,
      width: size.width,
    });
  });

  return (
    <>
      <OrthographicCamera makeDefault left={0} right={size.width} top={size.height} bottom={0} near={-100} far={100} position={[0, 0, 10]} />
    </>
  );
}

export default function Demo023PaperThreeLife() {
  const { showStats } = useControls('Debug', { showStats: false });
  
  return (
    <DemoScene
      debug={showStats}
      engineConfig={{
        background: '#000000',
      }}
      orbitControls={false}
    >
      <ThreeLifeEffect seed={1} />
    </DemoScene>
  );
}
