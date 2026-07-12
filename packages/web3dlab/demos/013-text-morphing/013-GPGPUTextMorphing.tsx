import React, {useEffect, useMemo, useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';
import {GPGPUVariable, useGPGPU} from '../../core/hooks/useGPGPU';
import computePositionFrag from './shaders/computePosition.frag?raw';
import computeVelocityFrag from './shaders/computeVelocity.frag?raw';
import renderParticlesFrag from './shaders/renderParticles.frag?raw';
import renderParticlesVert from './shaders/renderParticles.vert?raw';
import {useTextParticles} from './useTextParticles';

const TEX_SIZE = 256;
const PARTICLE_COUNT = TEX_SIZE * TEX_SIZE;
const GLYPH_OPTIONS = ['A', 'AI', 'MV', '3D'];

interface TextMorphingControls {
  glyph: string;
  assemblyTime: number;
  particleSize: number;
  swirl: number;
}

function hash01(value: number) {
  const result = Math.sin(value * 12.9898) * 43758.5453;
  return result - Math.floor(result);
}

function glyphSeed(glyph: string) {
  return Array.from(glyph).reduce(
    (seed, character, index) => seed + character.charCodeAt(0) * (index + 17),
    41,
  );
}

function createTargetTexture(sourceData: Float32Array, glyph: string) {
  const data = new Float32Array(PARTICLE_COUNT * 4);
  const sourceCount = Math.floor(sourceData.length / 3);
  const seed = glyphSeed(glyph);

  if (sourceCount === 0) {
    for (let index = 0; index < PARTICLE_COUNT; index++) {
      const angle = index * 2.399963229728653;
      const radius = 0.35 + hash01(index + seed) * 0.25;
      data[index * 4] = Math.cos(angle) * radius;
      data[index * 4 + 1] = Math.sin(angle) * radius;
      data[index * 4 + 2] = (hash01(index * 3.1 + seed) - 0.5) * 0.18;
      data[index * 4 + 3] = 1;
    }
  } else {
    const shuffledIndices = Array.from({length: sourceCount}, (_, index) => index);

    for (let index = sourceCount - 1; index > 0; index--) {
      const swapIndex = Math.floor(hash01(index + seed * 0.37) * (index + 1));
      [shuffledIndices[index], shuffledIndices[swapIndex]] = [
        shuffledIndices[swapIndex],
        shuffledIndices[index],
      ];
    }

    const layerCount = Math.max(1, Math.ceil(PARTICLE_COUNT / sourceCount));

    for (let index = 0; index < PARTICLE_COUNT; index++) {
      const sourceIndex = shuffledIndices[index % sourceCount] * 3;
      const layer = Math.floor(index / sourceCount);
      const layerProgress = (layer + hash01(index + seed * 1.7)) / layerCount;
      const angle = index * 2.399963229728653 + seed;
      const radius = 0.007 + Math.sqrt(layerProgress) * 0.026;

      data[index * 4] = sourceData[sourceIndex] + Math.cos(angle) * radius;
      data[index * 4 + 1] = sourceData[sourceIndex + 1] + Math.sin(angle) * radius;
      data[index * 4 + 2] = (hash01(index * 4.13 + seed) - 0.5) * 0.2;
      data[index * 4 + 3] = 1;
    }
  }

  const texture = new THREE.DataTexture(
    data,
    TEX_SIZE,
    TEX_SIZE,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function createInitialTextures() {
  const positionData = new Float32Array(PARTICLE_COUNT * 4);
  const velocityData = new Float32Array(PARTICLE_COUNT * 4);

  for (let index = 0; index < PARTICLE_COUNT; index++) {
    const longitude = hash01(index * 1.31) * Math.PI * 2;
    const vertical = hash01(index * 2.17 + 11) * 2 - 1;
    const horizontal = Math.sqrt(1 - vertical * vertical);
    const radius = 5.5 + hash01(index * 3.73 + 29) * 3.5;

    positionData[index * 4] = Math.cos(longitude) * horizontal * radius;
    positionData[index * 4 + 1] = vertical * radius;
    positionData[index * 4 + 2] = Math.sin(longitude) * horizontal * radius;
    positionData[index * 4 + 3] = 1;
  }

  const position = new THREE.DataTexture(
    positionData,
    TEX_SIZE,
    TEX_SIZE,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  const velocity = new THREE.DataTexture(
    velocityData,
    TEX_SIZE,
    TEX_SIZE,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  position.needsUpdate = true;
  velocity.needsUpdate = true;
  return {position, velocity};
}

function TextMorphingPhysics({controls}: {controls: TextMorphingControls}) {
  const textPoints = useTextParticles({
    text: controls.glyph,
    fontSize: 260,
    scale: 0.022,
    gridResolution: 2,
  });
  const targetTexture = useMemo(
    () => createTargetTexture(textPoints, controls.glyph),
    [controls.glyph, textPoints],
  );
  const initialTextures = useMemo(createInitialTextures, []);
  const firstTargetTexture = useRef(targetTexture).current;

  const variablesConfig = useMemo<GPGPUVariable[]>(
    () => {
      const velocityVariable: GPGPUVariable = {
        name: 'velocity',
        initialDataTexture: initialTextures.velocity,
        computeShader: computeVelocityFrag,
        uniforms: {
          uTargetPosition: {value: firstTargetTexture},
          uDelta: {value: 0.016},
          uTime: {value: 0},
          uAttraction: {value: 10},
          uDamping: {value: 6.2},
          uAssembly: {value: 0},
          uTurbulence: {value: 1.1},
        },
      };
      const positionVariable: GPGPUVariable = {
        name: 'position',
        initialDataTexture: initialTextures.position,
        computeShader: computePositionFrag,
        uniforms: {
          uDelta: {value: 0.016},
        },
      };

      return [velocityVariable, positionVariable];
    },
    [firstTargetTexture, initialTextures],
  );
  const gpgpu = useGPGPU(TEX_SIZE, variablesConfig);
  const transitionRef = useRef(0);

  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const particleUvs = new Float32Array(PARTICLE_COUNT * 2);
    const seeds = new Float32Array(PARTICLE_COUNT);

    for (let index = 0; index < PARTICLE_COUNT; index++) {
      particleUvs[index * 2] = ((index % TEX_SIZE) + 0.5) / TEX_SIZE;
      particleUvs[index * 2 + 1] = (Math.floor(index / TEX_SIZE) + 0.5) / TEX_SIZE;
      seeds[index] = hash01(index * 5.31 + 7);
    }

    result.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    result.setAttribute('aParticleUv', new THREE.BufferAttribute(particleUvs, 2));
    result.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return result;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: renderParticlesVert,
        fragmentShader: renderParticlesFrag,
        uniforms: {
          uPosition: {value: initialTextures.position},
          uVelocity: {value: initialTextures.velocity},
          uPointSize: {value: 3.4},
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        toneMapped: false,
      }),
    [initialTextures],
  );

  useEffect(() => {
    transitionRef.current = 0;
  }, [controls.glyph]);

  useEffect(() => () => targetTexture.dispose(), [targetTexture]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      initialTextures.position.dispose();
      initialTextures.velocity.dispose();
    },
    [geometry, initialTextures, material],
  );

  useFrame((state, delta) => {
    const clampedDelta = Math.min(delta, 0.04);
    transitionRef.current = Math.min(
      1,
      transitionRef.current + clampedDelta / Math.max(0.1, controls.assemblyTime),
    );
    const progress = transitionRef.current;
    const smoothProgress = progress * progress * (3 - 2 * progress);
    const naturalFrequency = 5.5 / Math.max(0.6, controls.assemblyTime);
    const velocityVariable = gpgpu.variables.velocity;
    const positionVariable = gpgpu.variables.position;

    if (velocityVariable) {
      const uniforms = velocityVariable.material.uniforms;
      uniforms.uTargetPosition.value = targetTexture;
      uniforms.uDelta.value = clampedDelta;
      uniforms.uTime.value = state.clock.elapsedTime;
      uniforms.uAssembly.value = smoothProgress;
      uniforms.uTurbulence.value = controls.swirl;
      uniforms.uAttraction.value = naturalFrequency * naturalFrequency;
      uniforms.uDamping.value = naturalFrequency * 2;
    }

    if (positionVariable) {
      positionVariable.material.uniforms.uDelta.value = clampedDelta;
    }

    gpgpu.compute();

    material.uniforms.uPosition.value = positionVariable.texture;
    material.uniforms.uVelocity.value = velocityVariable.texture;
    material.uniforms.uPointSize.value = controls.particleSize;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

export default function Demo013GPGPUTextMorphing() {
  const controls = useControls('Text Morphing', {
    glyph: {
      value: 'AI',
      options: GLYPH_OPTIONS,
      label: 'Letters',
    },
    assemblyTime: {
      value: 1.8,
      min: 0.8,
      max: 3.5,
      step: 0.1,
      label: 'Assembly time',
    },
    particleSize: {
      value: 3.4,
      min: 1.8,
      max: 5.2,
      step: 0.1,
      label: 'Particle size',
    },
    swirl: {
      value: 1.1,
      min: 0,
      max: 2.2,
      step: 0.05,
      label: 'Transition swirl',
    },
  });

  return (
    <DemoScene
      engineConfig={{
        background: '#03040a',
        camera: {position: [0, 0, 12], fov: 45},
      }}
      orbitConfig={{
        autoRotate: false,
        enablePan: false,
        minDistance: 8,
        maxDistance: 18,
      }}
    >
      <TextMorphingPhysics controls={controls} />
    </DemoScene>
  );
}
