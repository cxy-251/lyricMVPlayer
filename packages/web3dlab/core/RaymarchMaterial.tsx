import { useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import sdfMathGLSL from './shaders/sdfMath.glsl?raw';
import { AutoShaderMaterial } from './AutoShaderMaterial';

interface RaymarchMaterialProps {
  sceneSDF: string; // The GLSL code for the 'map' function (e.g., return opSmoothUnion(sdSphere(p, 1.0), sdBox(p, vec3(1.0)), 0.5);)
  colorCode?: string; // Optional GLSL for coloring
  uniforms?: {[key: string]: THREE.IUniform};
  blending?: THREE.Blending;
  transparent?: boolean;
}

const vertexShader = `
varying vec2 vUv;
varying vec3 vRayDir;
void main() {
  vUv = uv;
  // Compute Ray Direction from camera to screen plane
  // Position is a 2x2 plane, so position.xy is exactly NDC!
  vec4 ndc = vec4(position.xy, 1.0, 1.0);
  vec4 viewPos = inverse(projectionMatrix) * ndc;
  vec3 worldDir = (inverse(viewMatrix) * vec4(viewPos.xyz, 0.0)).xyz;
  vRayDir = normalize(worldDir);
  
  // Render as a full-screen quad, ignoring model and view transforms
  gl_Position = ndc;
}
`;

export function RaymarchMaterial({
  sceneSDF,
  colorCode = 'return vec3(0.8, 0.9, 1.0);', // Default color
  uniforms = {},
  blending = THREE.NormalBlending,
  transparent = false
}: RaymarchMaterialProps) {

  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Generate uniform declarations for GLSL
  const uniformDeclarations = useMemo(() => {
    let decls = '';
    for (const [key, uniform] of Object.entries(uniforms)) {
      const val = uniform.value;
      if (typeof val === 'number') decls += `uniform float ${key};\n`;
      else if (val instanceof THREE.Vector2) decls += `uniform vec2 ${key};\n`;
      else if (val instanceof THREE.Vector3) decls += `uniform vec3 ${key};\n`;
      else if (val instanceof THREE.Color) decls += `uniform vec3 ${key};\n`;
      else if (val instanceof THREE.Vector4) decls += `uniform vec4 ${key};\n`;
      else if (val instanceof THREE.Matrix4) decls += `uniform mat4 ${key};\n`;
      else if (val && (val as any).isTexture) decls += `uniform sampler2D ${key};\n`;
    }
    return decls;
  }, [uniforms]);

  // Generate Fragment Shader dynamically based on user's SDF logic
  const fragmentShader = useMemo(() => `
    varying vec2 vUv;
    varying vec3 vRayDir;
    
    uniform float uTime;
    uniform vec2 uResolution;
    ${uniformDeclarations}
    
    // Inject SDF Math Library
    ${sdfMathGLSL}
    
    // User-defined Map function
    vec2 map(vec3 p) {
      ${sceneSDF}
    }
    
    // User-defined Color function
    vec3 getColor(vec3 p) {
      ${colorCode}
    }

    // Calculate Normal using gradient
    vec3 calcNormal(vec3 p) {
      const float h = 0.0001;
      const vec2 k = vec2(1,-1);
      return normalize( k.xyy*map( p + k.xyy*h ).x + 
                        k.yyx*map( p + k.yyx*h ).x + 
                        k.yxy*map( p + k.yxy*h ).x + 
                        k.xxx*map( p + k.xxx*h ).x );
    }
    
    // Soft Shadow
    float calcSoftshadow( vec3 ro, vec3 rd, float mint, float tmax ) {
      float res = 1.0;
      float t = mint;
      for( int i=0; i<16; i++ ) {
        float h = map( ro + rd*t ).x;
        res = min( res, 8.0*h/t );
        t += clamp( h, 0.02, 0.10 );
        if( h<0.001 || t>tmax ) break;
      }
      return clamp( res, 0.0, 1.0 );
    }

    void main() {
      // Ray setup
      vec3 ro = cameraPosition;
      vec3 rd = normalize(vRayDir);
      
      // Raymarching Loop
      float t = 0.0;
      float d = 0.0;
      float matId = 0.0;
      
      const int MAX_STEPS = 100;
      const float SURF_DIST = 0.001;
      const float MAX_DIST = 100.0;
      
      for(int i=0; i<MAX_STEPS; i++) {
        vec3 p = ro + rd * t;
        vec2 res = map(p);
        d = res.x;
        matId = res.y;
        t += d;
        if(d < SURF_DIST || t > MAX_DIST) break;
      }
      
      if(t > MAX_DIST) {
        discard; // Hit nothing
      }
      
      // Hit surface
      vec3 p = ro + rd * t;
      vec3 n = calcNormal(p);
      
      // Premium PBR-lite Lighting
      vec3 lightDir = normalize(vec3(1.5, 2.0, 1.0));
      vec3 lightColor = vec3(1.0, 0.95, 0.9);
      
      // Simulated Studio Environment (HDRI approximation)
      vec3 ref = reflect(rd, n);
      vec3 envLight = vec3(0.01, 0.01, 0.02);
      envLight += vec3(1.0, 1.0, 1.0) * smoothstep(0.4, 0.95, ref.y); // Top softbox
      envLight += vec3(0.2, 0.5, 1.0) * smoothstep(0.6, 0.95, dot(ref, normalize(vec3(1.0, -0.2, -0.5)))) * 0.5; // Cool rim
      
      float dif = clamp(dot(n, lightDir), 0.0, 1.0);
      float sha = calcSoftshadow(p, lightDir, 0.01, 3.0);
      float ao = clamp(map(p + n*0.1).x / 0.1, 0.1, 1.0);
      
      // Specular (Blinn-Phong)
      vec3 halfVector = normalize(lightDir - rd);
      float specular = pow(max(dot(n, halfVector), 0.0), 128.0) * 1.5;
      
      // True Fresnel Schlick approximation (makes edges reflect environment like glass/liquid)
      vec3 f0 = vec3(0.04); 
      vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
      
      vec3 baseColor = getColor(p);
      
      vec3 diffuse = baseColor * dif * sha * lightColor;
      vec3 ambient = baseColor * envLight * ao * 0.5; 
      
      // Final composition
      vec3 col = diffuse + ambient + specular * lightColor * sha;
      col = mix(col, envLight * 2.0, fresnel); // Add environment reflection on edges
      
      // Fog
      col = mix(col, vec3(0.01, 0.01, 0.02), 1.0 - exp(-0.005 * t * t));
      
      // ACES Film Tone Mapping
      col = clamp((col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14), 0.0, 1.0);
      
      gl_FragColor = vec4(col, 1.0);
    }
  `, [sceneSDF, colorCode]);

  return (
    <AutoShaderMaterial
      ref={materialRef}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      extraUniforms={uniforms}
      transparent={transparent}
      blending={blending}
      side={THREE.DoubleSide}
    />
  );
}

// Helper Component: Fullscreen Quad for Raymarching
export function RaymarchQuad(props: RaymarchMaterialProps) {
  return (
    <mesh frustumCulled={false}>
      {/* 2x2 plane perfectly covers the screen in NDC space */}
      <planeGeometry args={[2, 2]} />
      <RaymarchMaterial {...props} />
    </mesh>
  );
}
