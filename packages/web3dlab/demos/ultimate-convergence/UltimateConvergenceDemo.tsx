import React, { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useControls } from 'leva';
import * as THREE from 'three';
import { Html, Environment } from '@react-three/drei';

import { DemoScene } from '../../core/DemoScene';
import { useAudioVisualizer } from '../../core/hooks/useAudioVisualizer';
import { useGPGPU, GPGPUVariable } from '../../core/hooks/useGPGPU';
import { useFluidTrail } from '../../core/hooks/useFluidTrail';

import computeVelocityFrag from './shaders/computeVelocity.frag?raw';
import computePositionFrag from './shaders/computePosition.frag?raw';
import fluidUpdateFrag from './shaders/fluidUpdate.frag?raw';

const PARTICLE_TEX_SIZE = 512; // 262,144 particles
const NUM_PARTICLES = PARTICLE_TEX_SIZE * PARTICLE_TEX_SIZE;



// ---------------------------------------------------------
// Component
// ---------------------------------------------------------
function UltimateScene({ controls }: { controls: any }) {
  const { viewport } = useThree();
  const audio = useAudioVisualizer({ fftSize: 1024 });
  const texUniformRef = useRef({ value: new THREE.Texture() });
  
  const fluid = useFluidTrail({
    size: 256,
    distortionStrength: 5.0,
    rippleRadius: 0.05,
    fluidDecay: 0.5,
    trailPersistence: 0.95,
    updateShader: fluidUpdateFrag
  });
  
  const fluidTexUniformRef = useRef({ value: new THREE.Texture() });
  const prevPointer = useRef(new THREE.Vector2(0.5, 0.5));

  const gpgpuConfig = useMemo(() => {
    const initPos = new Float32Array(NUM_PARTICLES * 4);
    const initVel = new Float32Array(NUM_PARTICLES * 4);
    
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const radius = 10.0 + Math.random() * 20.0;
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 5.0;
      
      initPos[i * 4] = Math.cos(angle) * radius;
      initPos[i * 4 + 1] = height;
      initPos[i * 4 + 2] = Math.sin(angle) * radius;
      initPos[i * 4 + 3] = 1.0;
      
      initVel[i * 4] = 0;
      initVel[i * 4 + 1] = 0;
      initVel[i * 4 + 2] = 0;
      initVel[i * 4 + 3] = 0;
    }
    
    const posTex = new THREE.DataTexture(initPos, PARTICLE_TEX_SIZE, PARTICLE_TEX_SIZE, THREE.RGBAFormat, THREE.FloatType);
    posTex.needsUpdate = true;
    const velTex = new THREE.DataTexture(initVel, PARTICLE_TEX_SIZE, PARTICLE_TEX_SIZE, THREE.RGBAFormat, THREE.FloatType);
    velTex.needsUpdate = true;

    return [
      {
        name: 'position',
        initialDataTexture: posTex,
        computeShader: computePositionFrag
      },
      {
        name: 'velocity',
        initialDataTexture: velTex,
        computeShader: computeVelocityFrag,
        uniforms: {
          uAudioTex: texUniformRef.current,
          uFluidTexture: fluidTexUniformRef.current,
          uTime: { value: 0 }
        }
      }
    ];
  }, []);

  const gpgpu = useGPGPU(PARTICLE_TEX_SIZE, gpgpuConfig);
  
  const particlesGeometry = useMemo(() => {
    // A small 3D shape instead of flat points
    const geo = new THREE.TetrahedronGeometry(0.1, 0);
    const count = NUM_PARTICLES;
    const instancedGeo = new THREE.InstancedBufferGeometry();
    instancedGeo.copy(geo as unknown as THREE.InstancedBufferGeometry);
    instancedGeo.instanceCount = count;
    
    const uvs = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      uvs[i * 2] = (i % PARTICLE_TEX_SIZE) / PARTICLE_TEX_SIZE;
      uvs[i * 2 + 1] = Math.floor(i / PARTICLE_TEX_SIZE) / PARTICLE_TEX_SIZE;
    }
    instancedGeo.setAttribute('aUv', new THREE.InstancedBufferAttribute(uvs, 2));
    
    return instancedGeo;
  }, []);

  const coreMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const particleMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);

  useFrame((state, delta) => {
    if (audio.isPlaying && audio.texture) {
      audio.update();
      texUniformRef.current.value = audio.texture;
    }

    const pointerUv = new THREE.Vector2(
      state.pointer.x * 0.5 + 0.5,
      state.pointer.y * 0.5 + 0.5
    );
    const velocity = new THREE.Vector2().subVectors(pointerUv, prevPointer.current).divideScalar(delta);
    const force = Math.min(velocity.length() * 0.1, 1.0);
    
    fluidTexUniformRef.current.value = fluid.update(
      delta, state.clock.elapsedTime, pointerUv, prevPointer.current, velocity, 0, force, viewport.aspect
    );
    prevPointer.current.copy(pointerUv);

    const velUniforms = gpgpu.variables['velocity'].material.uniforms;
    if (velUniforms) {
      velUniforms.uTime.value = state.clock.elapsedTime;
    }
    gpgpu.compute();

    if (particleMaterialRef.current && particleMaterialRef.current.userData.shader) {
      particleMaterialRef.current.userData.shader.uniforms.uPositionTexture.value = gpgpu.variables['position'].texture;
      particleMaterialRef.current.userData.shader.uniforms.uVelocityTexture.value = gpgpu.variables['velocity'].texture;
    }

    if (coreMaterialRef.current && coreMaterialRef.current.userData.shader) {
      coreMaterialRef.current.userData.shader.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  const onCoreBeforeCompile = (shader: any) => {
    shader.uniforms.uAudioTex = texUniformRef.current;
    shader.uniforms.uTime = { value: 0 };
    coreMaterialRef.current!.userData.shader = shader;

    shader.vertexShader = `
      uniform sampler2D uAudioTex;
      uniform float uTime;
      
      vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
      float snoise(vec3 v){ 
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + 1.0 * C.xxx;
        vec3 x2 = x0 - i2 + 2.0 * C.xxx;
        vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
        i = mod(i, 289.0 ); 
        vec4 p = permute( permute( permute( 
                   i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                 + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                 + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 1.0/7.0;
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
      }
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      float bass = texture2D(uAudioTex, vec2(0.01, 0.5)).r;
      float noise = snoise(position * 0.5 + uTime);
      vec3 transformed = position + normal * noise * (0.5 + bass * 4.0);
      `
    );
  };

  const onParticleBeforeCompile = (shader: any) => {
    shader.uniforms.uPositionTexture = { value: null };
    shader.uniforms.uVelocityTexture = { value: null };
    shader.uniforms.uAudioTex = texUniformRef.current;
    particleMaterialRef.current!.userData.shader = shader;

    shader.vertexShader = `
      uniform sampler2D uPositionTexture;
      uniform sampler2D uVelocityTexture;
      uniform sampler2D uAudioTex;
      attribute vec2 aUv;
      varying vec3 vInstColor;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      vec4 posData = texture2D(uPositionTexture, aUv);
      vec4 velData = texture2D(uVelocityTexture, aUv);
      float bass = texture2D(uAudioTex, vec2(0.01, 0.5)).r;
      
      float dist = length(posData.xyz);
      vec3 colorA = vec3(1.0, 0.0, 0.5);
      vec3 colorB = vec3(0.0, 1.0, 1.0);
      vInstColor = mix(colorA, colorB, smoothstep(5.0, 30.0, dist));
      
      vec3 vel = velData.xyz;
      float speed = length(vel);
      vec3 forward = speed > 0.001 ? normalize(vel) : vec3(0.0, 1.0, 0.0);
      vec3 up = vec3(0.0, 1.0, 0.0);
      if (abs(forward.y) > 0.999) { up = vec3(1.0, 0.0, 0.0); }
      vec3 right = normalize(cross(up, forward));
      up = cross(forward, right);
      mat3 rot = mat3(right, up, forward);
      
      vec3 scaledPos = position * (1.0 + bass * 3.0);
      scaledPos.z *= max(1.0, speed * 0.5);
      
      vec3 transformed = rot * scaledPos + posData.xyz;
      `
    );

    shader.fragmentShader = `
      varying vec3 vInstColor;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `
      vec4 diffuseColor = vec4( diffuse * vInstColor, opacity );
      `
    );
  };

  return (
    <>
      {!audio.isPlaying ? (
        <Html center position={[0, -5, 0]}>
          <div style={{
            background: 'rgba(0,0,0,0.8)', padding: '20px 40px', borderRadius: '4px',
            color: '#fff', cursor: 'pointer', border: '1px solid #fff',
            fontFamily: 'monospace', fontSize: '24px', letterSpacing: '4px', backdropFilter: 'blur(10px)',
            boxShadow: '0 0 20px rgba(0,0,0,0.5)'
          }} onClick={audio.start}>
            WAITING FOR AUDIO FEATURES
          </div>
        </Html>
      ) : (
        <Html center position={[0, -7, 0]}>
          <div style={{
            background: 'transparent', padding: '10px 20px', borderRadius: '4px',
            color: '#777777', cursor: 'pointer', border: '1px solid #777777',
            fontFamily: 'monospace', letterSpacing: '2px'
          }} onClick={audio.stop}>
            STOP AUDIO FEATURES
          </div>
        </Html>
      )}

      {/* 1. The GPGPU Particle Swarm (Now highly refractive Glass Crystals) */}
      <mesh frustumCulled={false} castShadow receiveShadow>
        <primitive object={particlesGeometry} />
        <meshPhysicalMaterial
          ref={particleMaterialRef}
          roughness={0.0}
          metalness={0.1}
          transmission={0.9} // Glass refraction
          thickness={0.5}
          ior={1.5}
          clearcoat={1.0}
          onBeforeCompile={onParticleBeforeCompile}
        />
      </mesh>

      {/* 2. The Audio Displaced Core Geometry (Polished Black Obsidian with edge glow) */}
      <mesh position={[0,0,0]} castShadow receiveShadow>
        <icosahedronGeometry args={[4, 64]} />
        <meshPhysicalMaterial
          ref={coreMaterialRef}
          color="#000000" // Pure black base
          emissive="#ff0055" // Cyberpunk pink glow hidden in the core
          emissiveIntensity={0.2}
          metalness={0.9}
          roughness={0.1}
          clearcoat={1.0}
          flatShading={true}
          onBeforeCompile={onCoreBeforeCompile}
        />
      </mesh>
    </>
  );
}

export default function UltimateConvergenceDemo() {
  const controls = useControls('Ultimate Convergence', {
    colorDark: '#0022ff',
    colorLight: '#ff0088',
  });

  return (
    <DemoScene
      engineConfig={{
        background: '#0a0a0f', // Very dark slate/purple
        camera: { position: [0, 8, 30], fov: 60 },
        // High-threshold Bloom: only the audio-reactive core and strong highlights will glow!
        bloom: { intensity: 1.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.5 }
      }}
      orbitConfig={{
        autoRotate: true,
        autoRotateSpeed: 0.5,
        enablePan: false,
      }}
    >
      <Environment preset="city" /> {/* Rich HDRI reflections for the glass/obsidian */}
      
      {/* High contrast Cyberpunk lighting to illuminate the glass */}
      <ambientLight intensity={0.2} />
      <directionalLight position={[20, 20, 10]} intensity={5.0} color="#ff0088" castShadow />
      <directionalLight position={[-20, -10, -10]} intensity={5.0} color="#00ffff" />
      <pointLight position={[0, 0, 0]} intensity={2.0} color="#ffffff" distance={20} />
      
      <UltimateScene controls={controls} />
    </DemoScene>
  );
}
