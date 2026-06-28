import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useControls } from 'leva';
import { Environment } from '@react-three/drei';

import { DemoScene } from '../../core/DemoScene';
import { useGPGPU } from '../../core/hooks/useGPGPU';
import { useTextParticles } from '../../core/hooks/useTextParticles';
import computeVelocityFrag from './shaders/computeVelocity.frag?raw';
import computePositionFrag from './shaders/computePosition.frag?raw';


const PARTICLE_COUNT = 65536; // 256x256
const TEX_SIZE = 256;

function TextMorphingPhysics({ controls }: { controls: any }) {
  const text1 = useTextParticles({ text: 'WEB 3D', scale: 0.08, gridResolution: 2 });
  const text2 = useTextParticles({ text: 'GPGPU', scale: 0.1, gridResolution: 2 });
  const text3 = useTextParticles({ text: 'LAB', scale: 0.15, gridResolution: 2 });

  const targetTexture = useMemo(() => {
    const data = new Float32Array(PARTICLE_COUNT * 4);
    
    let sourceData = text1;
    if (controls.morphTarget === 1) sourceData = text2;
    if (controls.morphTarget === 2) sourceData = text3;
    
    const sourcePoints = sourceData.length / 3;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const srcIdx = (i % Math.max(1, sourcePoints)) * 3;
      
      if (srcIdx + 2 < sourceData.length) {
        data[i * 4] = sourceData[srcIdx];
        data[i * 4 + 1] = sourceData[srcIdx + 1];
        data[i * 4 + 2] = sourceData[srcIdx + 2];
      } else {
        data[i * 4] = (Math.random() - 0.5) * 20;
        data[i * 4 + 1] = (Math.random() - 0.5) * 20;
        data[i * 4 + 2] = (Math.random() - 0.5) * 20;
      }
      data[i * 4 + 3] = 1.0;
    }
    
    const texture = new THREE.DataTexture(data, TEX_SIZE, TEX_SIZE, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;
    return texture;
  }, [text1, text2, text3, controls.morphTarget]);

  const { initPosTex, initVelTex } = useMemo(() => {
    const posData = new Float32Array(PARTICLE_COUNT * 4);
    const velData = new Float32Array(PARTICLE_COUNT * 4);
    for(let i=0; i<PARTICLE_COUNT; i++) {
      posData[i*4] = (Math.random() - 0.5) * 20;
      posData[i*4+1] = (Math.random() - 0.5) * 20;
      posData[i*4+2] = (Math.random() - 0.5) * 20;
      posData[i*4+3] = 1.0;
    }
    const pt = new THREE.DataTexture(posData, TEX_SIZE, TEX_SIZE, THREE.RGBAFormat, THREE.FloatType);
    const vt = new THREE.DataTexture(velData, TEX_SIZE, TEX_SIZE, THREE.RGBAFormat, THREE.FloatType);
    pt.needsUpdate = true;
    vt.needsUpdate = true;
    return { initPosTex: pt, initVelTex: vt };
  }, []);

  const gpgpu = useGPGPU(TEX_SIZE, [
    {
      name: 'velocity',
      initialDataTexture: initVelTex,
      computeShader: computeVelocityFrag,
      uniforms: {
        uTargetPosition: { value: targetTexture },
        uDelta: { value: 0.016 },
        uMorphForce: { value: controls.morphForce },
        uFriction: { value: controls.friction }
      }
    },
    {
      name: 'position',
      initialDataTexture: initPosTex,
      computeShader: computePositionFrag,
      uniforms: {
        uDelta: { value: 0.016 }
      }
    }
  ]);

  const geometry = useMemo(() => {
    // Crystal shards geometry
    const geo = new THREE.OctahedronGeometry(0.04, 0);
    
    const count = PARTICLE_COUNT;
    const instancedGeo = new THREE.InstancedBufferGeometry();
    instancedGeo.copy(geo as unknown as THREE.InstancedBufferGeometry);
    instancedGeo.instanceCount = count;
    
    const uvs = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      uvs[i * 2] = (i % TEX_SIZE) / TEX_SIZE;
      uvs[i * 2 + 1] = Math.floor(i / TEX_SIZE) / TEX_SIZE;
    }
    instancedGeo.setAttribute('aUv', new THREE.InstancedBufferAttribute(uvs, 2));
    
    return instancedGeo;
  }, []);

  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);

  useFrame((state, delta) => {
    const clampedDelta = Math.min(delta, 0.05);

    if (gpgpu.variables['velocity']) {
      const velUniforms = gpgpu.variables['velocity'].material.uniforms;
      velUniforms.uTargetPosition.value = targetTexture;
      velUniforms.uMorphForce.value = controls.morphForce;
      velUniforms.uFriction.value = controls.friction;
      velUniforms.uDelta.value = clampedDelta;
    }

    if (gpgpu.variables['position']) {
      const posUniforms = gpgpu.variables['position'].material.uniforms;
      posUniforms.uDelta.value = clampedDelta;
    }

    gpgpu.compute();

    if (materialRef.current && materialRef.current.userData.shader) {
      materialRef.current.userData.shader.uniforms.uPosition.value = gpgpu.variables['position'].texture;
      materialRef.current.userData.shader.uniforms.uVelocity.value = gpgpu.variables['velocity'].texture;
    }
  });

  const onBeforeCompile = (shader: any) => {
    shader.uniforms.uPosition = { value: null };
    shader.uniforms.uVelocity = { value: null };
    materialRef.current!.userData.shader = shader;

    shader.vertexShader = `
      uniform sampler2D uPosition;
      uniform sampler2D uVelocity;
      attribute vec2 aUv;
      varying vec3 vInstColor;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      vec4 posData = texture2D(uPosition, aUv);
      vec4 velData = texture2D(uVelocity, aUv);
      
      vec3 vel = velData.xyz;
      float speed = length(vel);
      vec3 forward = speed > 0.001 ? normalize(vel) : vec3(0.0, 0.0, 1.0);
      
      vInstColor = mix(vec3(0.0, 0.8, 1.0), vec3(1.0, 0.2, 0.6), min(speed * 0.15, 1.0));
      
      vec3 up = vec3(0.0, 1.0, 0.0);
      if (abs(forward.y) > 0.999) { up = vec3(1.0, 0.0, 0.0); }
      vec3 right = normalize(cross(up, forward));
      up = cross(forward, right);
      mat3 rot = mat3(right, up, forward);
      
      vec3 scaledPos = position;
      scaledPos.z *= max(1.0, speed * 0.3); // Stretch less when slow, more when fast
      
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
    <mesh frustumCulled={false} castShadow receiveShadow>
      <primitive object={geometry} />
      <meshPhysicalMaterial
        ref={materialRef}
        roughness={0.15}
        metalness={0.8}
        transmission={0.9} // Glassy crystals!
        thickness={0.5}
        ior={1.5}
        onBeforeCompile={onBeforeCompile}
      />
    </mesh>
  );
}

export default function GPGPUTextMorphingDemo() {
  const controls = useControls('Text Morphing', {
    morphTarget: { value: 0, min: 0, max: 2, step: 1, label: 'Text State (0=WEB3D, 1=GPGPU, 2=LAB)' },
    morphForce: { value: 5.0, min: 0.1, max: 20.0, step: 0.1 },
    friction: { value: 0.9, min: 0.5, max: 1.0, step: 0.01 },
  });

  return (
    <DemoScene
      engineConfig={{
        background: '#040406',
        camera: { position: [0, 0, 12], fov: 45 }
      }}
      orbitConfig={{
        autoRotate: true,
        autoRotateSpeed: 2.0
      }}
    >
      <Environment preset="studio" />
      <ambientLight intensity={1.5} />
      <directionalLight position={[10, 10, 10]} intensity={3.0} castShadow />
      <TextMorphingPhysics controls={controls} />
    </DemoScene>
  );
}
