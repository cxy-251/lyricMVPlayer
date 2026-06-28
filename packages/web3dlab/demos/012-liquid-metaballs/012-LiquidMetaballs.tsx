import React from 'react';
import { useControls } from 'leva';
import * as THREE from 'three';
import { DemoScene } from '../../core/DemoScene';
import { RaymarchQuad } from '../../core/RaymarchMaterial';

import metaballsSDF from './shaders/metaballsSDF.glsl?raw';
import metaballsColor from './shaders/metaballsColor.glsl?raw';

function MetaballScene({ controls }: { controls: any }) {
  // Pass the pointer uniform manually using a mouse move event or raycaster
  // For simplicity, we just use useFrame and camera in a real app,
  // but here we can just use the sceneSDF directly.

  return (
    <DemoScene
      engineConfig={{
        background: '#0a0a0f',
        camera: { position: [0, 0, 15], fov: 45 }
      }}
      orbitConfig={{
        autoRotate: true,
        autoRotateSpeed: 1.0
      }}
    >
      <RaymarchQuad 
        sceneSDF={metaballsSDF}
        colorCode={metaballsColor}
        uniforms={{
          uRadius: { value: controls.orbitRadius },
          uSmoothness: { value: controls.smoothness },
          uColor: { value: new THREE.Color(controls.color) },
          uPointer: { value: new THREE.Vector3(0, 0, 0) } // Can be updated interactively
        }}
        blending={THREE.NoBlending}
      />
    </DemoScene>
  );
}

export default function Demo012LiquidMetaballs() {
  const controls = useControls('Metaballs SDF', {
    orbitRadius: { value: 0.8, min: 0.0, max: 5.0, step: 0.1 },
    smoothness: { value: 1.5, min: 0.1, max: 3.0, step: 0.1 },
    color: '#00ddff'
  });

  return <MetaballScene controls={controls} />;
}
