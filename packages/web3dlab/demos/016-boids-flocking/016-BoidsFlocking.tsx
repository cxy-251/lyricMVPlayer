import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useControls } from 'leva';
import { Environment } from '@react-three/drei';
import { DemoScene } from '../../core/DemoScene';
import { useGPGPU, GPGPUVariable } from '../../core/hooks/useGPGPU';
import boidsVelocityShader from './boidsVelocity.frag?raw';
import boidsPositionShader from './boidsPosition.frag?raw';

function BoidsParticles({ controls }: { controls: any }) {
  const size = 64; // 64x64 = 4096 boids
  const { viewport } = useThree();
  const pointerRef = useRef(new THREE.Vector3(0, 0, 0));

  const initPosTexture = useMemo(() => {
    const data = new Float32Array(size * size * 4);
    for (let i = 0; i < data.length; i += 4) {
      const r = Math.random() * 5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      data[i] = r * Math.sin(phi) * Math.cos(theta);
      data[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      data[i + 2] = r * Math.cos(phi);
      data[i + 3] = 1.0;
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
    tex.needsUpdate = true;
    return tex;
  }, [size]);

  const initVelTexture = useMemo(() => {
    const data = new Float32Array(size * size * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (Math.random() - 0.5) * 2;
      data[i + 1] = (Math.random() - 0.5) * 2;
      data[i + 2] = (Math.random() - 0.5) * 2;
      data[i + 3] = 1.0;
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
    tex.needsUpdate = true;
    return tex;
  }, [size]);

  const variablesConfig = useMemo(() => [
    {
      name: 'position',
      initialDataTexture: initPosTexture,
      computeShader: boidsPositionShader,
      uniforms: {
        uDelta: { value: 0 }
      }
    },
    {
      name: 'velocity',
      initialDataTexture: initVelTexture,
      computeShader: boidsVelocityShader,
      uniforms: {
        uTime: { value: 0 },
        uDelta: { value: 0 },
        uPointer: { value: pointerRef.current },
        uSeparationDistance: { value: 0.5 },
        uAlignmentDistance: { value: 1.5 },
        uCohesionDistance: { value: 1.0 },
        uSeparationForce: { value: 0.05 },
        uAlignmentForce: { value: 0.02 },
        uCohesionForce: { value: 0.01 },
        uMaxSpeed: { value: 3.0 }
      }
    }
  ] as GPGPUVariable[], [initPosTexture, initVelTexture]);

  const gpgpu = useGPGPU(size, variablesConfig);

  useFrame((state, delta) => {
    const x = (state.pointer.x * viewport.width) / 2;
    const y = (state.pointer.y * viewport.height) / 2;
    pointerRef.current.set(x, y, 0);

    if (gpgpu.variables['velocity']) {
      const vUnif = gpgpu.variables['velocity'].material.uniforms;
      vUnif.uTime.value = state.clock.elapsedTime;
      vUnif.uDelta.value = delta;
      vUnif.uSeparationDistance.value = controls.separationDist;
      vUnif.uAlignmentDistance.value = controls.alignmentDist;
      vUnif.uCohesionDistance.value = controls.cohesionDist;
      vUnif.uSeparationForce.value = controls.separationForce;
      vUnif.uAlignmentForce.value = controls.alignmentForce;
      vUnif.uCohesionForce.value = controls.cohesionForce;
      vUnif.uMaxSpeed.value = controls.maxSpeed;
    }
    
    if (gpgpu.variables['position']) {
      gpgpu.variables['position'].material.uniforms.uDelta.value = delta;
    }

    gpgpu.compute();

    if (materialRef.current && materialRef.current.userData.shader) {
      materialRef.current.userData.shader.uniforms.uPositionTexture.value = gpgpu.variables['position'].texture;
      materialRef.current.userData.shader.uniforms.uVelocityTexture.value = gpgpu.variables['velocity'].texture;
    }
  });

  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);

  const boidGeometry = useMemo(() => {
    // Thicker geometry to catch environment reflections beautifully
    const geo = new THREE.ConeGeometry(0.08, 0.3, 4);
    geo.rotateX(Math.PI / 2);
    
    const count = size * size;
    const instancedGeo = new THREE.InstancedBufferGeometry();
    instancedGeo.copy(geo as unknown as THREE.InstancedBufferGeometry);
    instancedGeo.instanceCount = count;
    
    const uvs = new Float32Array(count * 2);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const index = i * size + j;
        uvs[index * 2] = (j + 0.5) / size;
        uvs[index * 2 + 1] = (i + 0.5) / size;
      }
    }
    instancedGeo.setAttribute('aUv', new THREE.InstancedBufferAttribute(uvs, 2));
    
    return instancedGeo;
  }, [size]);

  const onBeforeCompile = (shader: any) => {
    shader.uniforms.uPositionTexture = { value: null };
    shader.uniforms.uVelocityTexture = { value: null };
    materialRef.current!.userData.shader = shader;

    shader.vertexShader = `
      uniform sampler2D uPositionTexture;
      uniform sampler2D uVelocityTexture;
      attribute vec2 aUv;
      varying vec3 vBoidColor;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      vec4 posData = texture2D(uPositionTexture, aUv);
      vec4 velData = texture2D(uVelocityTexture, aUv);
      
      vec3 vel = velData.xyz;
      float speed = length(vel);
      vec3 forward = speed > 0.001 ? normalize(vel) : vec3(0.0, 0.0, 1.0);
      
      vec3 colorA = vec3(0.0, 1.0, 0.8);
      vec3 colorB = vec3(1.0, 0.0, 0.8);
      vBoidColor = mix(colorA, colorB, smoothstep(0.0, 5.0, speed));
      
      vec3 up = vec3(0.0, 1.0, 0.0);
      if (abs(forward.y) > 0.999) { up = vec3(1.0, 0.0, 0.0); }
      vec3 right = normalize(cross(up, forward));
      up = cross(forward, right);
      mat3 rot = mat3(right, up, forward);
      
      vec3 scaledPos = position;
      scaledPos.z *= 1.0 + speed * 0.1;
      
      vec3 transformed = rot * scaledPos + posData.xyz;
      `
    );

    shader.fragmentShader = `
      varying vec3 vBoidColor;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `
      vec4 diffuseColor = vec4( diffuse * vBoidColor, opacity );
      `
    );
  };

  return (
    <mesh frustumCulled={false} castShadow receiveShadow>
      <primitive object={boidGeometry} />
      <meshPhysicalMaterial
        ref={materialRef}
        roughness={0.05}
        metalness={1.0}
        clearcoat={1.0}
        clearcoatRoughness={0.1}
        onBeforeCompile={onBeforeCompile}
      />
    </mesh>
  );
}

export default function Demo016BoidsFlocking() {
  const controls = useControls('Boids Flocking', {
    separationDist: { value: 0.5, min: 0.1, max: 2.0, step: 0.1 },
    alignmentDist: { value: 1.5, min: 0.1, max: 5.0, step: 0.1 },
    cohesionDist: { value: 1.0, min: 0.1, max: 5.0, step: 0.1 },
    separationForce: { value: 0.05, min: 0.0, max: 0.2, step: 0.01 },
    alignmentForce: { value: 0.02, min: 0.0, max: 0.2, step: 0.01 },
    cohesionForce: { value: 0.01, min: 0.0, max: 0.2, step: 0.01 },
    maxSpeed: { value: 3.0, min: 0.1, max: 10.0, step: 0.1 },
  });

  return (
    <DemoScene
      engineConfig={{
        background: '#0a0a0f',
        camera: { position: [0, 0, 15], fov: 45 }
      }}
      orbitConfig={{
        autoRotate: true,
        autoRotateSpeed: 0.5
      }}
    >
      <Environment preset="city" />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={2.0} castShadow />
      <BoidsParticles controls={controls} />
    </DemoScene>
  );
}

