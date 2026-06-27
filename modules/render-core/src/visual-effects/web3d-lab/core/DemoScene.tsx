import {OrbitControls} from '@react-three/drei';
import type {ReactNode} from 'react';
import {Web3DEngine, Web3DEngineConfig} from './Web3DEngine';

interface DemoSceneProps {
  children: ReactNode;
  controls?: any; // Leva controls (if needed for global stuff)
  debug?: boolean;
  engineConfig?: Partial<Web3DEngineConfig>;
  orbitControls?: boolean;
  orbitConfig?: {
    autoRotate?: boolean;
    autoRotateSpeed?: number;
    enablePan?: boolean;
    enableZoom?: boolean;
    minDistance?: number;
    maxDistance?: number;
  };
}

const DEFAULT_ENGINE_CONFIG: Web3DEngineConfig = {
  background: '#010103',
  camera: {fov: 45, far: 50, near: 0.1, position: [0, 0, 10]},
};

/**
 * A higher-level wrapper for Demos that sets up Web3DEngine and standard OrbitControls automatically.
 */
export function DemoScene({
  children,
  debug = false,
  engineConfig = {},
  orbitControls = true,
  orbitConfig = {},
}: DemoSceneProps) {
  const finalConfig: Web3DEngineConfig = {
    ...DEFAULT_ENGINE_CONFIG,
    ...engineConfig,
    debug,
  };

  return (
    <Web3DEngine config={finalConfig}>
      {orbitControls && (
        <OrbitControls
          makeDefault
          enablePan={orbitConfig.enablePan ?? false}
          enableZoom={orbitConfig.enableZoom ?? true}
          enableRotate={true}
          autoRotate={orbitConfig.autoRotate ?? false}
          autoRotateSpeed={orbitConfig.autoRotateSpeed ?? 2.0}
          minDistance={orbitConfig.minDistance ?? 2}
          maxDistance={orbitConfig.maxDistance ?? 30}
        />
      )}
      {children}
    </Web3DEngine>
  );
}
