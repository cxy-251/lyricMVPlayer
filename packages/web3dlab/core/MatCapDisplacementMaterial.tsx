import React, {useMemo} from 'react';
import * as THREE from 'three';
import { AutoShaderMaterial } from './AutoShaderMaterial';
import simplex3d from './shaders/includes/simplex3d.glsl?raw';

export interface MatCapDisplacementMaterialProps {
  flowSpeed?: number;
  distortionFrequency?: number;
  distortionIntensity?: number;
  chromeColor?: string;
  controls?: any;
}

export function MatCapDisplacementMaterial({
  flowSpeed = 0.8,
  distortionFrequency = 0.3,
  distortionIntensity = 1.2,
  chromeColor = '#00ccff',
  controls,
}: MatCapDisplacementMaterialProps) {
  const customControls = useMemo(() => {
    return {
      ...(controls || {
        flowSpeed,
        distortionFrequency,
        distortionIntensity,
        chromeColor
      })
    };
  }, [controls, flowSpeed, distortionFrequency, distortionIntensity, chromeColor]);

  return (
    <AutoShaderMaterial
      controls={customControls}
      transparent={false}
      depthWrite={true}
      blending={THREE.NormalBlending}
      vertexShader={`
        uniform float uTime;
        uniform float uFlowSpeed;
        uniform float uDistortionFrequency;
        uniform float uDistortionIntensity;
        
        varying vec3 vWorldPosition;
        varying vec3 vViewPosition;
        
        ${simplex3d}
        
        void main() {
          vec3 p = position;
          
          // Procedural Vertex Displacement
          vec3 noisePos = p * uDistortionFrequency + uTime * uFlowSpeed;
          float noise = snoise(noisePos);
          
          // Push the vertex outward along its normal
          p += normal * noise * uDistortionIntensity;
          
          vec4 worldPos = modelMatrix * vec4(p, 1.0);
          vWorldPosition = worldPos.xyz;
          
          vec4 mvPosition = viewMatrix * worldPos;
          vViewPosition = -mvPosition.xyz;
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `}
      fragmentShader={`
        uniform vec3 uChromeColor;
        
        varying vec3 vWorldPosition;
        varying vec3 vViewPosition;
        
        void main() {
          // Calculate TRUE face normals dynamically based on the deformed mesh
          vec3 fdx = dFdx(vWorldPosition);
          vec3 fdy = dFdy(vWorldPosition);
          vec3 trueNormal = normalize(cross(fdx, fdy));
          
          // Transform true normal to view space
          vec3 viewNormal = normalize(mat3(viewMatrix) * trueNormal);
          
          // Procedural Chrome logic to replace external MatCap
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float fresnel = 1.0 - max(0.0, dot(viewDir, trueNormal));
          fresnel = pow(fresnel, 3.0);
          
          // Base metal reflection gradient
          vec3 baseMetal = mix(vec3(0.2), vec3(1.0), smoothstep(-1.0, 1.0, viewNormal.y));
          vec3 finalColor = baseMetal * uChromeColor + vec3(fresnel * 0.8);
          
          // Add a sharp specular highlight
          vec3 reflectedLight = reflect(-viewDir, trueNormal);
          float specLight = pow(max(dot(reflectedLight, normalize(vec3(1.0, 1.0, 1.0))), 0.0), 60.0);
          
          gl_FragColor = vec4(finalColor + specLight, 1.0);
        }
      `}
    />
  );
}
