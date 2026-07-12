import React, {useEffect, useMemo, useRef} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {useControls} from 'leva';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';
import {GPGPUVariable, useGPGPU} from '../../core/hooks/useGPGPU';
import boidsGlowFrag from './boidsGlow.frag?raw';
import boidsGlowVert from './boidsGlow.vert?raw';
import boidsPositionShader from './boidsPosition.frag?raw';
import boidsRenderFrag from './boidsRender.frag?raw';
import boidsRenderVert from './boidsRender.vert?raw';
import boidsVelocityShader from './boidsVelocity.frag?raw';

const SIMULATION_SIZE = 32;
const BOID_COUNT = SIMULATION_SIZE * SIMULATION_SIZE;
const ORIGIN = new THREE.Vector3();

interface BoidsControls {
  avoidCrowding: number;
  matchDirection: number;
  stayTogether: number;
  flightSpeed: number;
  pointerAvoidance: number;
  birdSize: number;
}

function hash01(value: number) {
  const result = Math.sin(value * 12.9898) * 43758.5453;
  return result - Math.floor(result);
}

function createInitialTextures() {
  const positionData = new Float32Array(BOID_COUNT * 4);
  const velocityData = new Float32Array(BOID_COUNT * 4);

  for (let index = 0; index < BOID_COUNT; index++) {
    const longitude = hash01(index * 1.37 + 3) * Math.PI * 2;
    const vertical = hash01(index * 2.41 + 17) * 2 - 1;
    const horizontal = Math.sqrt(1 - vertical * vertical);
    const radius = 1.2 + Math.cbrt(hash01(index * 3.79 + 31)) * 3.8;
    const positionOffset = index * 4;

    positionData[positionOffset] = Math.cos(longitude) * horizontal * radius;
    positionData[positionOffset + 1] = vertical * radius * 0.78;
    positionData[positionOffset + 2] = Math.sin(longitude) * horizontal * radius;
    positionData[positionOffset + 3] = 1;

    const velocityLongitude = longitude + (hash01(index * 5.17 + 47) - 0.5) * 1.2;
    const velocityVertical = (hash01(index * 7.31 + 59) - 0.5) * 0.8;
    const velocityHorizontal = Math.sqrt(1 - velocityVertical * velocityVertical);
    velocityData[positionOffset] = Math.cos(velocityLongitude) * velocityHorizontal * 1.6;
    velocityData[positionOffset + 1] = velocityVertical * 1.6;
    velocityData[positionOffset + 2] = Math.sin(velocityLongitude) * velocityHorizontal * 1.6;
    velocityData[positionOffset + 3] = 1;
  }

  const position = new THREE.DataTexture(
    positionData,
    SIMULATION_SIZE,
    SIMULATION_SIZE,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  const velocity = new THREE.DataTexture(
    velocityData,
    SIMULATION_SIZE,
    SIMULATION_SIZE,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  position.minFilter = THREE.NearestFilter;
  position.magFilter = THREE.NearestFilter;
  velocity.minFilter = THREE.NearestFilter;
  velocity.magFilter = THREE.NearestFilter;
  position.needsUpdate = true;
  velocity.needsUpdate = true;
  return {position, velocity};
}

function createInstanceUvs() {
  const result = new Float32Array(BOID_COUNT * 2);

  for (let index = 0; index < BOID_COUNT; index++) {
    result[index * 2] = ((index % SIMULATION_SIZE) + 0.5) / SIMULATION_SIZE;
    result[index * 2 + 1] =
      (Math.floor(index / SIMULATION_SIZE) + 0.5) / SIMULATION_SIZE;
  }

  return result;
}

function createBirdGeometry(instanceUvs: Float32Array) {
  const vertices = new Float32Array([
    0, 0, 0.34, -0.28, 0, -0.12, 0, 0.035, -0.04,
    0, 0, 0.34, 0, 0.035, -0.04, 0.28, 0, -0.12,
    -0.28, 0, -0.12, 0, 0.035, -0.04, 0, -0.025, -0.3,
    0, 0.035, -0.04, 0.28, 0, -0.12, 0, -0.025, -0.3,
    0, 0.065, 0.26, 0, 0.035, -0.04, 0, -0.025, -0.3,
  ]);
  const baseGeometry = new THREE.BufferGeometry();
  baseGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  baseGeometry.computeVertexNormals();

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', baseGeometry.getAttribute('position'));
  geometry.setAttribute('normal', baseGeometry.getAttribute('normal'));
  geometry.setAttribute('aBoidUv', new THREE.InstancedBufferAttribute(instanceUvs, 2));
  geometry.instanceCount = BOID_COUNT;
  baseGeometry.dispose();
  return geometry;
}

function createGlowGeometry(instanceUvs: Float32Array) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BOID_COUNT * 3), 3));
  geometry.setAttribute('aBoidUv', new THREE.BufferAttribute(instanceUvs, 2));
  return geometry;
}

function BoidsFlock({controls}: {controls: BoidsControls}) {
  const {gl} = useThree();
  const pointerPosition = useRef(new THREE.Vector3(100, 100, 100));
  const pointerActive = useRef(false);
  const initialTextures = useMemo(createInitialTextures, []);
  const instanceUvs = useMemo(createInstanceUvs, []);

  const variablesConfig = useMemo<GPGPUVariable[]>(() => {
    const positionVariable: GPGPUVariable = {
      name: 'position',
      initialDataTexture: initialTextures.position,
      computeShader: boidsPositionShader,
      uniforms: {uDelta: {value: 0}},
    };
    const velocityVariable: GPGPUVariable = {
      name: 'velocity',
      initialDataTexture: initialTextures.velocity,
      computeShader: boidsVelocityShader,
      uniforms: {
        uTime: {value: 0},
        uDelta: {value: 0},
        uPointer: {value: pointerPosition.current},
        uSeparationForce: {value: 2.1},
        uAlignmentForce: {value: 1.15},
        uCohesionForce: {value: 0.72},
        uMaxSpeed: {value: 2.4},
        uPointerForce: {value: 0},
      },
    };
    return [positionVariable, velocityVariable];
  }, [initialTextures]);
  const gpgpu = useGPGPU(SIMULATION_SIZE, variablesConfig);

  const birdGeometry = useMemo(() => createBirdGeometry(instanceUvs), [instanceUvs]);
  const glowGeometry = useMemo(() => createGlowGeometry(instanceUvs), [instanceUvs]);
  const birdMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: boidsRenderVert,
        fragmentShader: boidsRenderFrag,
        side: THREE.DoubleSide,
        uniforms: {
          uPositionTexture: {value: initialTextures.position},
          uVelocityTexture: {value: initialTextures.velocity},
          uTime: {value: 0},
          uBirdSize: {value: 1},
        },
        toneMapped: false,
      }),
    [initialTextures],
  );
  const glowMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: boidsGlowVert,
        fragmentShader: boidsGlowFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uPositionTexture: {value: initialTextures.position},
        },
        toneMapped: false,
      }),
    [initialTextures],
  );

  useEffect(() => {
    const canvas = gl.domElement;
    const activatePointer = () => {
      pointerActive.current = true;
    };
    const deactivatePointer = () => {
      pointerActive.current = false;
    };

    canvas.addEventListener('pointermove', activatePointer, {passive: true});
    canvas.addEventListener('pointerleave', deactivatePointer, {passive: true});
    return () => {
      canvas.removeEventListener('pointermove', activatePointer);
      canvas.removeEventListener('pointerleave', deactivatePointer);
    };
  }, [gl]);

  useEffect(
    () => () => {
      birdGeometry.dispose();
      glowGeometry.dispose();
      birdMaterial.dispose();
      glowMaterial.dispose();
      initialTextures.position.dispose();
      initialTextures.velocity.dispose();
    },
    [birdGeometry, birdMaterial, glowGeometry, glowMaterial, initialTextures],
  );

  useFrame((state, delta) => {
    const clampedDelta = Math.min(delta, 0.04);
    state.raycaster.ray.closestPointToPoint(ORIGIN, pointerPosition.current);

    const velocityVariable = gpgpu.variables.velocity;
    const positionVariable = gpgpu.variables.position;
    const velocityUniforms = velocityVariable.material.uniforms;
    velocityUniforms.uTime.value = state.clock.elapsedTime;
    velocityUniforms.uDelta.value = clampedDelta;
    velocityUniforms.uPointer.value.copy(pointerPosition.current);
    velocityUniforms.uSeparationForce.value = controls.avoidCrowding;
    velocityUniforms.uAlignmentForce.value = controls.matchDirection;
    velocityUniforms.uCohesionForce.value = controls.stayTogether;
    velocityUniforms.uMaxSpeed.value = controls.flightSpeed;
    velocityUniforms.uPointerForce.value = pointerActive.current
      ? controls.pointerAvoidance
      : 0;
    positionVariable.material.uniforms.uDelta.value = clampedDelta;

    gpgpu.compute();

    birdMaterial.uniforms.uPositionTexture.value = positionVariable.texture;
    birdMaterial.uniforms.uVelocityTexture.value = velocityVariable.texture;
    birdMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    birdMaterial.uniforms.uBirdSize.value = controls.birdSize;
    glowMaterial.uniforms.uPositionTexture.value = positionVariable.texture;
  });

  return (
    <group>
      <mesh geometry={birdGeometry} material={birdMaterial} frustumCulled={false} />
      <points geometry={glowGeometry} material={glowMaterial} frustumCulled={false} />
    </group>
  );
}

export default function Demo016BoidsFlocking() {
  const controls = useControls('Boids Flocking', {
    avoidCrowding: {
      value: 2.1,
      min: 0.6,
      max: 3.6,
      step: 0.05,
      label: 'Avoid crowding',
    },
    matchDirection: {
      value: 1.15,
      min: 0,
      max: 2.4,
      step: 0.05,
      label: 'Match direction',
    },
    stayTogether: {
      value: 0.72,
      min: 0.15,
      max: 1.5,
      step: 0.03,
      label: 'Stay together',
    },
    flightSpeed: {
      value: 2.4,
      min: 1,
      max: 4.2,
      step: 0.1,
      label: 'Flight speed',
    },
    pointerAvoidance: {
      value: 4.5,
      min: 0,
      max: 8,
      step: 0.25,
      label: 'Pointer avoidance',
    },
    birdSize: {
      value: 1,
      min: 0.65,
      max: 1.45,
      step: 0.05,
      label: 'Bird size',
    },
  });

  return (
    <DemoScene
      engineConfig={{
        background: '#02050c',
        camera: {position: [0, 1.2, 13], fov: 48},
      }}
      orbitConfig={{
        autoRotate: true,
        autoRotateSpeed: 0.22,
        enablePan: false,
        minDistance: 8,
        maxDistance: 20,
      }}
    >
      <BoidsFlock controls={controls} />
    </DemoScene>
  );
}
