import {useFrame, useThree} from '@react-three/fiber';
import {useEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';

export interface GPGPUVariable {
  name: string;
  initialDataTexture: THREE.DataTexture;
  computeShader: string;
  uniforms?: Record<string, THREE.IUniform>;
}

export interface GPGPUEngine {
  variables: Record<string, {
    renderTargets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
    material: THREE.ShaderMaterial;
    texture: THREE.Texture;
  }>;
  compute: () => void;
}

const fullscreenVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

/**
 * A highly reusable GPGPU hook for stateful GPU particle physics.
 * Manages FBO ping-pong rendering and compute shader execution.
 */
export function useGPGPU(
  size: number,
  variablesConfig: GPGPUVariable[]
): GPGPUEngine {
  const {gl} = useThree();

  const camera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const scene = useMemo(() => new THREE.Scene(), []);
  const mesh = useMemo(() => new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), []);
  
  useEffect(() => {
    scene.add(mesh);
    return () => {
      scene.remove(mesh);
    };
  }, [scene, mesh]);

  // Create Ping-Pong RenderTargets for each variable
  const engine = useMemo(() => {
    const variables: GPGPUEngine['variables'] = {};

    for (const config of variablesConfig) {
      // High precision floats for physics
      const rtOptions: THREE.RenderTargetOptions = {
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType, // Essential for physics positions/velocities
        depthBuffer: false,
        stencilBuffer: false,
      };

      const rt1 = new THREE.WebGLRenderTarget(size, size, rtOptions);
      const rt2 = new THREE.WebGLRenderTarget(size, size, rtOptions);

      // Initialize with data texture
      const initMaterial = new THREE.ShaderMaterial({
        vertexShader: fullscreenVertexShader,
        fragmentShader: `
          uniform sampler2D uInitTexture;
          varying vec2 vUv;
          void main() {
            gl_FragColor = texture2D(uInitTexture, vUv);
          }
        `,
        uniforms: { uInitTexture: { value: config.initialDataTexture } }
      });

      mesh.material = initMaterial;
      gl.setRenderTarget(rt1);
      gl.render(scene, camera);
      gl.setRenderTarget(rt2);
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Pre-declare texture uniforms so Three.js binds them correctly at compilation time
      const textureUniforms: Record<string, THREE.IUniform> = {};
      for (const otherConfig of variablesConfig) {
        const uniformName = `u${otherConfig.name.charAt(0).toUpperCase() + otherConfig.name.slice(1)}`;
        textureUniforms[uniformName] = { value: null };
      }

      // Create Compute Material
      const material = new THREE.ShaderMaterial({
        vertexShader: fullscreenVertexShader,
        fragmentShader: config.computeShader,
        uniforms: {
          uResolution: { value: new THREE.Vector2(size, size) },
          ...textureUniforms,
          ...config.uniforms
        }
      });

      variables[config.name] = {
        renderTargets: [rt1, rt2],
        material,
        texture: rt1.texture
      };
    }

    return { variables, currentStep: 0 };
  }, [gl, size, variablesConfig, scene, mesh, camera]);

  const stepRef = useRef(0);

  const compute = () => {
    const current = stepRef.current % 2;
    const next = (stepRef.current + 1) % 2;

    for (const config of variablesConfig) {
      const v = engine.variables[config.name];
      
      // Inject ALL variable textures into this compute shader
      // E.g. Velocity shader needs Position texture, Position shader needs Velocity texture.
      for (const otherConfig of variablesConfig) {
        const otherV = engine.variables[otherConfig.name];
        const uniformName = `u${otherConfig.name.charAt(0).toUpperCase() + otherConfig.name.slice(1)}`;
        if (v.material.uniforms[uniformName]) {
          v.material.uniforms[uniformName].value = otherV.renderTargets[current].texture;
        } else {
          v.material.uniforms[uniformName] = { value: otherV.renderTargets[current].texture };
        }
      }

      mesh.material = v.material;
      gl.setRenderTarget(v.renderTargets[next]);
      gl.render(scene, camera);
      
      // The output texture that React components will read
      v.texture = v.renderTargets[next].texture;
    }

    gl.setRenderTarget(null);
    stepRef.current++;
  };

  return {
    variables: engine.variables,
    compute
  };
}
