import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useControls } from 'leva';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

import { DemoScene } from '../../core/DemoScene';
import { AutoShaderMaterial } from '../../core/AutoShaderMaterial';
import { useAudioVisualizer } from '../../core/hooks/useAudioVisualizer';
import sdfMathGLSL from '../../core/shaders/sdfMath.glsl?raw';
import ferrofluidVert from './shaders/ferrofluid.vert?raw';
import ferrofluidFrag from './shaders/ferrofluid.frag?raw';

/**
 * Audio Ferrofluid Core
 * 
 * [Purpose / Foundation Usage]
 * Demonstrates a highly premium, audio-reactive Raymarching liquid metal shader.
 * Uses `useAudioVisualizer` as the lyric audio feature texture boundary,
 * driving a 3D Simplex noise displacement field over an SDF sphere.
 * 
 * [Architecture Assembly]
 * - `useAudioVisualizer` for externally injected audio feature textures.
 * - `<AutoShaderMaterial>` for rendering a full-screen Raymarching quad.
 * - Raw GLSL for organic surface displacement and Iridescent Chrome reflection shading.
 */

// We use a custom full-screen quad because we need highly specialized material rendering 
// (chrome/liquid metal) that the generic RaymarchMaterial doesn't support.
function FerrofluidScene({ controls }: { controls: any }) {
  const audio = useAudioVisualizer({ fftSize: 512 });
  const texUniformRef = useRef({ 
    value: (() => {
      const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
      tex.needsUpdate = true;
      return tex;
    })() 
  });
  
  useFrame(() => {
    if (audio.isPlaying && audio.texture) {
      audio.update();
      texUniformRef.current.value = audio.texture;
    }
  });

  return (
    <>
      {!audio.isPlaying ? (
        <Html center position={[0, -3, 0]}>
          <div style={{
            background: 'rgba(200,200,255,0.05)', padding: '15px 30px', borderRadius: '30px',
            color: '#fff', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)',
            fontFamily: 'sans-serif', fontSize: '14px', letterSpacing: '2px', backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease'
          }} onClick={audio.start}
             onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
             onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(200,200,255,0.05)'}
          >
            WAITING FOR AUDIO FEATURES
          </div>
        </Html>
      ) : (
        <Html center position={[0, -4, 0]}>
          <div style={{
            background: 'rgba(255,0,0,0.1)', padding: '10px 20px', borderRadius: '30px',
            color: '#ff4444', cursor: 'pointer', border: '1px solid rgba(255,0,0,0.3)',
            fontFamily: 'sans-serif', fontSize: '12px', letterSpacing: '1px', backdropFilter: 'blur(10px)'
          }} onClick={audio.stop}>
            SUSPEND
          </div>
        </Html>
      )}

      <mesh frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
        <AutoShaderMaterial 
          controls={controls}
          extraUniforms={{
            uAudioTex: texUniformRef.current
          }}
          vertexShader={ferrofluidVert}
          fragmentShader={ferrofluidFrag.replace('#include <sdfMath>', sdfMathGLSL)}
          depthWrite={false}
          transparent={false}
        />
      </mesh>
    </>
  );
}

export default function Demo017AudioFerrofluid() {
  const controls = useControls('Ferrofluid Core', {
    radius: { value: 2.5, min: 1.0, max: 5.0, step: 0.1 },
    spikeIntensity: { value: 1.2, min: 0.0, max: 3.0, step: 0.1 },
    rippleIntensity: { value: 0.3, min: 0.0, max: 1.0, step: 0.05 },
    colorDark: '#4400ff',
    colorLight: '#00ffff',
  });

  return (
    <DemoScene
      engineConfig={{
        background: '#000000', // Handled inside shader now
        camera: { position: [0, 0, 10], fov: 45 }
      }}
      orbitConfig={{
        autoRotate: true,
        autoRotateSpeed: 1.0,
        enablePan: false,
      }}
    >
      <FerrofluidScene controls={controls} />
    </DemoScene>
  );
}
