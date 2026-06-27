import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

export interface UseFluidTrailOptions {
  size?: number;
  distortionStrength?: number;
  fluidDecay?: number;
  rippleRadius?: number;
  trailPersistence?: number;
  updateShader: string;
}

export function useFluidTrail({
  size = 512,
  distortionStrength = 1.0,
  fluidDecay = 0.5,
  rippleRadius = 0.1,
  trailPersistence = 0.9,
  updateShader
}: UseFluidTrailOptions) {
  const { gl } = useThree();
  const currentTargetIndex = useRef(0);

  const trailTargets = useMemo(() => {
    const createTarget = () => new THREE.WebGLRenderTarget(size, size, {
      depthBuffer: false,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      stencilBuffer: false,
      type: THREE.UnsignedByteType,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    });
    return [createTarget(), createTarget()];
  }, [size]);

  const scene = useMemo(() => new THREE.Scene(), []);
  const camera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);
  
  const uniforms = useMemo(() => ({
    uAspect: { value: 1 },
    uDelta: { value: 1 / 60 },
    uDistortionStrength: { value: distortionStrength },
    uDrag: { value: 0 },
    uFluidDecay: { value: fluidDecay },
    uForce: { value: 0 },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uPrevPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uPrevTrail: { value: trailTargets[0].texture },
    uRippleRadius: { value: rippleRadius },
    uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
    uTime: { value: 0 },
    uTrailPersistence: { value: trailPersistence },
    uVelocity: { value: new THREE.Vector2() },
  }), [size, distortionStrength, fluidDecay, rippleRadius, trailPersistence, trailTargets]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: updateShader,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    uniforms
  }), [updateShader, uniforms]);

  const mesh = useMemo(() => new THREE.Mesh(geometry, material), [geometry, material]);

  useEffect(() => {
    scene.add(mesh);
    for (const target of trailTargets) {
      gl.setRenderTarget(target);
      gl.clear();
    }
    gl.setRenderTarget(null);

    return () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      for (const target of trailTargets) {
        target.dispose();
      }
    };
  }, [gl, scene, mesh, geometry, material, trailTargets]);

  const update = (
    delta: number,
    time: number,
    pointerUv: THREE.Vector2,
    prevPointerUv: THREE.Vector2,
    velocity: THREE.Vector2,
    drag: number,
    force: number,
    aspect: number
  ) => {
    const readTarget = trailTargets[currentTargetIndex.current];
    const writeTarget = trailTargets[1 - currentTargetIndex.current];

    material.uniforms.uPrevTrail.value = readTarget.texture;
    material.uniforms.uPointer.value.copy(pointerUv);
    material.uniforms.uPrevPointer.value.copy(prevPointerUv);
    material.uniforms.uVelocity.value.copy(velocity);
    material.uniforms.uTime.value = time;
    material.uniforms.uDelta.value = delta;
    material.uniforms.uAspect.value = aspect;
    material.uniforms.uDistortionStrength.value = distortionStrength;
    material.uniforms.uDrag.value = drag;
    material.uniforms.uForce.value = force;
    material.uniforms.uFluidDecay.value = fluidDecay;
    material.uniforms.uRippleRadius.value = rippleRadius;
    material.uniforms.uTrailPersistence.value = trailPersistence;

    gl.setRenderTarget(writeTarget);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    
    currentTargetIndex.current = 1 - currentTargetIndex.current;
    
    return writeTarget.texture;
  };

  return { update };
}
