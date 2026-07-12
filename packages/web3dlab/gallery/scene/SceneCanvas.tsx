import {AdaptiveDpr, Preload} from '@react-three/drei';
import {Canvas} from '@react-three/fiber';
import type {CanvasProps} from '@react-three/fiber';
import type {ReactNode} from 'react';
import * as THREE from 'three';

export function SceneCanvas({
  background = '#03040b',
  camera,
  children,
}: {
  background?: THREE.ColorRepresentation;
  camera?: CanvasProps['camera'];
  children: ReactNode;
}) {
  return (
    <Canvas
      camera={camera ?? {position: [0, 1.1, 8.4], fov: 54, near: 0.1, far: 60}}
      dpr={[1, 1.75]}
      gl={{antialias: false, alpha: false, powerPreference: 'high-performance'}}
      onCreated={({gl, scene}) => {
        gl.setClearColor(background, 1);
        scene.background = new THREE.Color(background);
      }}
    >
      {children}
      <AdaptiveDpr pixelated />
      <Preload all />
    </Canvas>
  );
}
