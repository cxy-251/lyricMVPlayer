import {Loader} from '@react-three/drei';
import {CanvasProps} from '@react-three/fiber';
import {Bloom, ChromaticAberration, EffectComposer, Vignette} from '@react-three/postprocessing';
import type {HTMLAttributes, ReactNode} from 'react';
import {Suspense} from 'react';
import * as THREE from 'three';

import {SceneCanvas} from '../gallery/scene/SceneCanvas';

export interface Web3DEngineConfig {
  background?: THREE.ColorRepresentation;
  bloom?: {
    intensity: number;
    luminanceSmoothing: number;
    luminanceThreshold: number;
  };
  camera?: CanvasProps['camera'];
  chromaticAberration?: {offset: [number, number]};
  debug?: boolean;
  fog?: {color: THREE.ColorRepresentation; far: number; near: number};
  vignette?: {
    darkness: number;
    offset: number;
  };
}

export function Web3DEngine({
  children,
  config,
  ...containerProps
}: {
  children: ReactNode;
  config?: Web3DEngineConfig;
} & HTMLAttributes<HTMLDivElement>) {
  const cameraProps = config?.camera ?? {position: [0, 0, 8], fov: 50, near: 0.1, far: 50};
  const background = config?.background ?? '#010105';
  const debug = config?.debug ?? false;

  return (
    <div className="demo-viewport" style={{touchAction: 'none'}} {...containerProps}>
      <SceneCanvas background={background} camera={cameraProps} debug={debug}>
        <color attach="background" args={[background as any]} />
        {config?.fog ? <fog attach="fog" args={[config.fog.color, config.fog.near, config.fog.far]} /> : null}

        <Suspense fallback={null}>
          {children}
        </Suspense>

        {config?.bloom || config?.vignette || config?.chromaticAberration ? (
          <EffectComposer frameBufferType={THREE.UnsignedByteType} multisampling={0}>
            {config.bloom ? (
              <Bloom
                intensity={config.bloom.intensity}
                luminanceSmoothing={config.bloom.luminanceSmoothing}
                luminanceThreshold={config.bloom.luminanceThreshold}
                mipmapBlur
              />
            ) : (<></> as any)}
            {config.chromaticAberration ? <ChromaticAberration offset={new THREE.Vector2(config.chromaticAberration.offset[0], config.chromaticAberration.offset[1])} /> : (<></> as any)}
            {config.vignette ? <Vignette darkness={config.vignette.darkness} offset={config.vignette.offset} /> : (<></> as any)}
          </EffectComposer>
        ) : null}
      </SceneCanvas>
      <Loader 
        containerStyles={{ background: '#010105' }} 
        innerStyles={{ width: '30vw', maxWidth: '400px' }} 
        barStyles={{ background: '#00ffff', height: '4px' }} 
        dataStyles={{ color: '#00ffff', fontFamily: 'monospace', fontSize: '14px' }} 
      />
    </div>
  );
}
