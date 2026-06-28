import {useFrame} from '@react-three/fiber';
import {forwardRef, useImperativeHandle, useMemo, useRef} from 'react';
import * as THREE from 'three';

export interface AutoShaderMaterialProps extends Omit<THREE.ShaderMaterialParameters, 'uniforms'> {
  /**
   * The Leva controls object to automatically bind to uniforms.
   * Keys are auto-prefixed with 'u' and capitalized (e.g., 'arms' -> 'uArms').
   */
  controls?: Record<string, any>;
  /** Any extra custom uniforms to inject manually */
  extraUniforms?: Record<string, THREE.IUniform>;
}

/**
 * A highly intelligent ShaderMaterial wrapper that automatically manages uniforms.
 * It injects `uTime` and drives it via `useFrame`.
 * It automatically maps Leva controls to uniforms (e.g. `spinSpeed` -> `uSpinSpeed`).
 * It automatically converts hex colors to THREE.Color.
 */
export const AutoShaderMaterial = forwardRef<THREE.ShaderMaterial, AutoShaderMaterialProps>(
  ({controls = {}, extraUniforms = {}, ...materialProps}, ref) => {
    const internalRef = useRef<THREE.ShaderMaterial>(null);

    useImperativeHandle(ref, () => internalRef.current as THREE.ShaderMaterial);

    const uniformKeysMap = useMemo(() => {
      const keysMap: Record<string, string> = {};
      for (const key of Object.keys(controls)) {
        // e.g., arms -> uArms
        const uniformKey = 'u' + key.charAt(0).toUpperCase() + key.slice(1);
        keysMap[key] = uniformKey;
      }
      return keysMap;
    }, [controls]);

    const uniforms = useMemo(() => {
      const u: Record<string, THREE.IUniform> = {
        uTime: {value: 0},
        ...extraUniforms,
      };

      // Initialize uniforms from controls
      for (const [controlKey, uniformKey] of Object.entries(uniformKeysMap)) {
        const val = controls[controlKey];
        if (typeof val === 'string' && (val.startsWith('#') || val.startsWith('rgb'))) {
          u[uniformKey] = {value: new THREE.Color(val)};
        } else {
          u[uniformKey] = {value: val};
        }
      }
      return u;
    }, [uniformKeysMap]); // Intentionally omitting controls, we mutate them in useFrame to save recreations

    useFrame((state) => {
      if (internalRef.current) {
        const u = internalRef.current.uniforms;
        
        // 1. Auto-drive uTime
        u.uTime.value = state.clock.elapsedTime;

        // 2. Auto-sync controls
        for (const [controlKey, uniformKey] of Object.entries(uniformKeysMap)) {
          if (u[uniformKey]) {
            const val = controls[controlKey];
            if (typeof val === 'string' && (val.startsWith('#') || val.startsWith('rgb'))) {
              (u[uniformKey].value as THREE.Color).set(val);
            } else {
              u[uniformKey].value = val;
            }
          }
        }
      }
    });

    return (
      <shaderMaterial
        ref={internalRef}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        {...materialProps}
      />
    );
  },
);

AutoShaderMaterial.displayName = 'AutoShaderMaterial';
