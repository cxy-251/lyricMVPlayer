import {useFrame} from '@react-three/fiber';
import {useMemo, useRef} from 'react';
import {useControls} from 'leva';
import * as THREE from 'three';
import {DemoScene} from '../../core/DemoScene';
import simplex3d from './simplex3d.glsl?raw';

type LiquidMetalControls = {
  flowSpeed: number;
  distortion: number;
  frequency: number;
  roughness: number;
  reflectionStrength: number;
  scatter: number;
  metalColor: string;
};

const CONTROL_LIMITS = {
  flowSpeed: {min: 0.0, max: 1.25},
  distortion: {min: 0.0, max: 0.55},
  frequency: {min: 0.25, max: 1.35},
  roughness: {min: 0.0, max: 0.24},
  reflectionStrength: {min: 0.55, max: 1.45},
  scatter: {min: 0.0, max: 0.16},
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const clampControls = (controls: LiquidMetalControls): LiquidMetalControls => ({
  flowSpeed: clamp(controls.flowSpeed, CONTROL_LIMITS.flowSpeed.min, CONTROL_LIMITS.flowSpeed.max),
  distortion: clamp(controls.distortion, CONTROL_LIMITS.distortion.min, CONTROL_LIMITS.distortion.max),
  frequency: clamp(controls.frequency, CONTROL_LIMITS.frequency.min, CONTROL_LIMITS.frequency.max),
  roughness: clamp(controls.roughness, CONTROL_LIMITS.roughness.min, CONTROL_LIMITS.roughness.max),
  reflectionStrength: clamp(
    controls.reflectionStrength,
    CONTROL_LIMITS.reflectionStrength.min,
    CONTROL_LIMITS.reflectionStrength.max,
  ),
  scatter: clamp(controls.scatter, CONTROL_LIMITS.scatter.min, CONTROL_LIMITS.scatter.max),
  metalColor: controls.metalColor,
});

const vertexShader = `
  uniform float uTime;
  uniform float uFlowSpeed;
  uniform float uDistortion;
  uniform float uFrequency;

  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;
  varying vec3 vWorldNormal;
  varying float vBoil;

  ${simplex3d}

  void main() {
    vec3 p = position;
    vec3 sphereNormal = normalize(normal);
    float t = uTime * uFlowSpeed;

    float low = snoise(sphereNormal * (uFrequency * 1.15) + vec3(t * 0.58, t * 0.2, -t * 0.36));
    float mid = snoise(sphereNormal * (uFrequency * 2.35) + vec3(-t * 0.32, t * 0.52, t * 0.25)) * 0.46;
    float skin = snoise(sphereNormal * (uFrequency * 4.2) + vec3(t * 0.18, -t * 0.34, t * 0.44)) * 0.16;
    float breathing = snoise(sphereNormal * 0.58 + vec3(0.0, t * 0.12, t * 0.08)) * 0.24;
    float boil = low * 0.72 + mid + skin + breathing;

    float displacement = clamp(boil * uDistortion * 0.72, -0.44, 0.44);
    p += sphereNormal * displacement;

    vec4 worldPosition = modelMatrix * vec4(p, 1.0);
    vWorldPosition = worldPosition.xyz;
    vViewPosition = cameraPosition - worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normalize(mix(sphereNormal, normalize(p), 0.72)));
    vBoil = boil;

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = `
  uniform float uRoughness;
  uniform float uReflectionStrength;
  uniform float uScatter;
  uniform float uDistortion;
  uniform vec3 uMetalColor;

  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;
  varying vec3 vWorldNormal;
  varying float vBoil;

  vec3 chromeRig(vec3 reflection, vec3 viewNormal, float roughness) {
    float vertical = smoothstep(-0.82, 0.92, viewNormal.y);
    float lowerDark = 1.0 - smoothstep(-0.78, -0.08, viewNormal.y);
    float sideDark = 1.0 - smoothstep(-0.7, 0.42, viewNormal.x);
    float centerLift = 1.0 - smoothstep(0.14, 1.08, length(viewNormal.xy));
    float horizonBand = exp(-pow((viewNormal.y + viewNormal.x * 0.26 + vBoil * 0.05) / 0.16, 2.0));
    float upperBand = exp(-pow((viewNormal.y - 0.46 - viewNormal.x * 0.12) / 0.18, 2.0));
    float coldSide = pow(max(dot(reflection, normalize(vec3(-0.7, 0.16, 0.7))), 0.0), mix(8.0, 4.0, roughness));
    float hotSpec = pow(max(dot(reflection, normalize(vec3(0.2, 0.46, 0.86))), 0.0), mix(96.0, 36.0, roughness));
    float rimLine = pow(max(1.0 - abs(viewNormal.x * 0.52 + viewNormal.y * 0.2), 0.0), 6.0) * smoothstep(0.0, 0.92, viewNormal.z);

    vec3 env = vec3(0.018, 0.022, 0.03);
    env += vec3(0.1, 0.12, 0.15) * centerLift;
    env += vec3(0.22, 0.28, 0.35) * vertical * 0.62;
    env += vec3(0.58, 0.72, 0.9) * horizonBand * 1.18;
    env += vec3(0.45, 0.58, 0.72) * upperBand * 0.46;
    env += vec3(0.2, 0.48, 0.86) * coldSide * 0.72;
    env += vec3(1.0, 0.96, 0.86) * hotSpec * 1.22;
    env += vec3(0.78, 0.88, 1.0) * rimLine * 0.18;
    env = mix(env, vec3(0.01, 0.012, 0.018), lowerDark * 0.2 + sideDark * 0.12);

    float luma = dot(env, vec3(0.299, 0.587, 0.114));
    return mix(env, vec3(luma) * vec3(0.86, 0.94, 1.05), roughness * 0.2);
  }

  void main() {
    vec3 viewDir = normalize(vViewPosition);
    vec3 smoothNormal = normalize(vWorldNormal);
    vec3 faceNormal = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
    vec3 normal = normalize(mix(smoothNormal, faceNormal, clamp(0.06 + uDistortion * 0.18, 0.06, 0.16)));
    normal = faceforward(normal, -viewDir, smoothNormal);

    vec3 reflection = reflect(-viewDir, normal);
    vec3 viewNormal = normalize(mat3(viewMatrix) * normal);
    float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 2.25);
    float effectiveRoughness = clamp(uRoughness, 0.0, 0.24);
    vec3 metalTint = mix(vec3(0.68, 0.74, 0.8), min(uMetalColor, vec3(0.86, 0.95, 1.0)), 0.38);
    vec3 env = chromeRig(reflection, viewNormal, effectiveRoughness);

    float grain = sin(dot(vWorldPosition, vec3(7.0, 9.0, 5.0)) + vBoil * 3.0) * 0.5 + 0.5;
    float polish = mix(1.0, 0.96 + grain * 0.06, uScatter);
    vec3 color = env * metalTint * uReflectionStrength * polish;
    color += metalTint * fresnel * (0.42 + uDistortion * 0.36);

    float edgeDepth = pow(1.0 - clamp(viewNormal.z, 0.0, 1.0), 1.35);
    color = mix(color, vec3(0.01, 0.012, 0.018), edgeDepth * 0.26);
    color += metalTint * edgeDepth * 0.1;
    color = color / (color + vec3(0.58));
    color = pow(color, vec3(0.78));
    color = min(color, vec3(0.98));

    gl_FragColor = vec4(color, 1.0);
  }
`;

function LiquidMetalMaterial({controls}: {controls: LiquidMetalControls}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: {value: 0},
      uFlowSpeed: {value: controls.flowSpeed},
      uDistortion: {value: controls.distortion},
      uFrequency: {value: controls.frequency},
      uRoughness: {value: controls.roughness},
      uReflectionStrength: {value: controls.reflectionStrength},
      uScatter: {value: controls.scatter},
      uMetalColor: {value: new THREE.Color(controls.metalColor)},
    }),
    [],
  );

  useFrame((state) => {
    if (!materialRef.current) return;
    const safeControls = clampControls(controls);
    const {uniforms: materialUniforms} = materialRef.current;
    materialUniforms.uTime.value = state.clock.elapsedTime;
    materialUniforms.uFlowSpeed.value = safeControls.flowSpeed;
    materialUniforms.uDistortion.value = safeControls.distortion;
    materialUniforms.uFrequency.value = safeControls.frequency;
    materialUniforms.uRoughness.value = safeControls.roughness;
    materialUniforms.uReflectionStrength.value = safeControls.reflectionStrength;
    materialUniforms.uScatter.value = safeControls.scatter;
    materialUniforms.uMetalColor.value.set(safeControls.metalColor);
  });

  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={uniforms}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      depthWrite
      transparent={false}
    />
  );
}

function MorphingLiquidSphere({controls}: {controls: LiquidMetalControls}) {
  return (
    <mesh frustumCulled={false}>
      <sphereGeometry args={[2.35, 224, 112]} />
      <LiquidMetalMaterial controls={controls} />
    </mesh>
  );
}

function LiquidMetalScene({controls}: {controls: LiquidMetalControls}) {
  return (
    <DemoScene
      engineConfig={{
        background: '#010104',
        bloom: {intensity: 0.46, luminanceThreshold: 0.72, luminanceSmoothing: 0.72},
        vignette: {darkness: 0.62, offset: 0.18},
        camera: {fov: 45, far: 50, near: 0.1, position: [0, 0, 8]},
      }}
      orbitConfig={{
        autoRotate: true,
        autoRotateSpeed: 0.42,
      }}
    >
      <MorphingLiquidSphere controls={controls} />
    </DemoScene>
  );
}

export default function Demo003LiquidMetal() {
  const liquidControls = useControls('Boiling Liquid Chrome', {
    flowSpeed: {value: 0.58, min: CONTROL_LIMITS.flowSpeed.min, max: CONTROL_LIMITS.flowSpeed.max, step: 0.01},
    distortion: {value: 0.28, min: CONTROL_LIMITS.distortion.min, max: CONTROL_LIMITS.distortion.max, step: 0.01},
    frequency: {value: 0.68, min: CONTROL_LIMITS.frequency.min, max: CONTROL_LIMITS.frequency.max, step: 0.01},
    roughness: {value: 0.06, min: CONTROL_LIMITS.roughness.min, max: CONTROL_LIMITS.roughness.max, step: 0.01},
    reflectionStrength: {
      value: 1.08,
      min: CONTROL_LIMITS.reflectionStrength.min,
      max: CONTROL_LIMITS.reflectionStrength.max,
      step: 0.01,
    },
    scatter: {value: 0.04, min: CONTROL_LIMITS.scatter.min, max: CONTROL_LIMITS.scatter.max, step: 0.01},
    metalColor: '#b7ecff',
  });

  return <LiquidMetalScene controls={clampControls(liquidControls)} />;
}
