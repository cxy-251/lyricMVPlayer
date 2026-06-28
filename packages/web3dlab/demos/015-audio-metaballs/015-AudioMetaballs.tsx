import React, { useRef, useState } from 'react';
import { useControls } from 'leva';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { DemoScene } from '../../core/DemoScene';
import { RaymarchQuad } from '../../core/RaymarchMaterial';
import { useAudioVisualizer } from '../../core/hooks/useAudioVisualizer';

import audioMetaballsSDF from './shaders/audioMetaballsSDF.glsl?raw';
import audioMetaballsColor from './shaders/audioMetaballsColor.glsl?raw';

function AudioReactiveScene({ controls }: { controls: any }) {
  const audio = useAudioVisualizer();
  const bassUniformRef = useRef({ value: 0 });
  const texUniformRef = useRef({ 
    value: (() => {
      const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
      tex.needsUpdate = true;
      return tex;
    })() 
  });

  useFrame(() => {
    if (audio.isPlaying && audio.texture) {
      const bass = audio.update();
      // Smooth the bass slightly so it doesn't jitter too fast
      if (bass !== undefined) {
        bassUniformRef.current.value += (bass - bassUniformRef.current.value) * 0.2;
      }
      texUniformRef.current.value = audio.texture;
    }
  });

  return (
    <>
      {!audio.isPlaying ? (
        <Html center>
          <div style={{
            background: 'rgba(0,255,100,0.2)', padding: '20px', borderRadius: '10px',
            color: 'white', cursor: 'pointer', border: '1px solid #00ff66', fontFamily: 'sans-serif',
            whiteSpace: 'nowrap'
          }} onClick={audio.start}>
            WAITING FOR AUDIO FEATURES
          </div>
        </Html>
      ) : (
        <Html center position={[0, -5, 0]}>
          <div style={{
            background: 'rgba(255,0,0,0.2)', padding: '10px 20px', borderRadius: '10px',
            color: 'white', cursor: 'pointer', border: '1px solid #ff0055', fontFamily: 'sans-serif',
            whiteSpace: 'nowrap'
          }} onClick={audio.stop}>
            STOP AUDIO FEATURES
          </div>
        </Html>
      )}

      <RaymarchQuad 
        sceneSDF={audioMetaballsSDF}
        colorCode={audioMetaballsColor}
        uniforms={{
          uRadius: { value: controls.orbitRadius },
          uSmoothness: { value: controls.smoothness },
          uColor: { value: new THREE.Color(controls.color) },
          uAudioTex: texUniformRef.current,
          uBassScale: bassUniformRef.current
        }}
        blending={THREE.NoBlending}
      />
    </>
  );
}

export default function Demo015AudioMetaballs() {
  const controls = useControls('Audio Metaballs', {
    orbitRadius: { value: 1.2, min: 0.0, max: 5.0, step: 0.1 },
    smoothness: { value: 1.5, min: 0.1, max: 3.0, step: 0.1 },
    color: '#00ffee'
  });

  return (
    <DemoScene
      engineConfig={{
        background: '#0a050a',
        camera: { position: [0, 0, 15], fov: 45 }
      }}
      orbitConfig={{
        autoRotate: true,
        autoRotateSpeed: 1.0
      }}
    >
      <AudioReactiveScene controls={controls} />
    </DemoScene>
  );
}
