import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useControls, folder } from 'leva';
import * as THREE from 'three';
import { DemoScene } from '../../core/DemoScene';

const GOLDEN_ANGLE = Math.PI * (3.0 - Math.sqrt(5.0));

// Generate the points for a specific set of spiral arms (parastichies)
function getSpiralArms(totalPoints: number, armCount: number, radius: number) {
  const arms: THREE.CatmullRomCurve3[] = [];
  if (armCount <= 0) return arms;
  
  for (let k = 0; k < armCount; k++) {
    const points: THREE.Vector3[] = [];
    for (let m = 0; k + m * armCount < totalPoints; m++) {
      const i = k + m * armCount;
      const t = i / (totalPoints - 1);
      const phi = Math.acos(1 - 2 * t);
      const theta = GOLDEN_ANGLE * i;
      const x = radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.sin(theta) * Math.sin(phi);
      const z = radius * Math.cos(phi);
      points.push(new THREE.Vector3(x, y, z));
    }
    // Only create a curve if we have enough points to form a line
    if (points.length > 2) {
      arms.push(new THREE.CatmullRomCurve3(points));
    }
  }
  return arms;
}

function EnergyBands({
  curves,
  color,
  speed,
  thickness,
  reverse
}: {
  curves: THREE.CatmullRomCurve3[];
  color: string;
  speed: number;
  thickness: number;
  reverse?: boolean;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Custom shader to create flowing energy pulses along the tube
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        baseColor: { value: new THREE.Color(color) },
        flowSpeed: { value: reverse ? -speed : speed }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 baseColor;
        uniform float flowSpeed;
        varying vec2 vUv;
        
        void main() {
          // Flow effect along the U coordinate of the Tube (length-wise)
          float flow = sin(vUv.x * 20.0 + time * flowSpeed) * 0.5 + 0.5;
          // Edge fade (V coordinate)
          float edgeFade = sin(vUv.y * 3.14159);
          
          float intensity = pow(flow * edgeFade, 2.0);
          
          gl_FragColor = vec4(baseColor * (0.5 + intensity * 2.0), intensity * 0.8 + 0.2);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
  }, [color, speed, reverse]);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.elapsedTime;
      materialRef.current.uniforms.flowSpeed.value = reverse ? -speed * 5.0 : speed * 5.0;
      materialRef.current.uniforms.baseColor.value.set(color);
    }
  });

  return (
    <group>
      {curves.map((curve, idx) => (
        <mesh key={idx}>
          <tubeGeometry args={[curve, 64, thickness, 8, false]} />
          <primitive object={shaderMaterial} ref={idx === 0 ? materialRef : undefined} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

function EnergySphere({
  count,
  radius,
  speed,
  primaryColor,
  secondaryColor,
  coreColor,
  primaryArms,
  secondaryArms,
  thickness
}: {
  count: number;
  radius: number;
  speed: number;
  primaryColor: string;
  secondaryColor: string;
  coreColor: string;
  primaryArms: number;
  secondaryArms: number;
  thickness: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  const primaryCurves = useMemo(() => getSpiralArms(count, primaryArms, radius), [count, primaryArms, radius]);
  const secondaryCurves = useMemo(() => getSpiralArms(count, secondaryArms, radius), [count, secondaryArms, radius]);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.1 * speed;
      groupRef.current.rotation.z = time * 0.05 * speed;
    }
    if (coreRef.current) {
      const pulse = Math.sin(time * 2.0 * speed) * 0.05 + 1.0;
      coreRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Primary Interwoven Spiral Arms */}
      <EnergyBands curves={primaryCurves} color={primaryColor} speed={speed} thickness={thickness} />
      
      {/* Secondary Interwoven Spiral Arms (Opposite direction flow) */}
      <EnergyBands curves={secondaryCurves} color={secondaryColor} speed={speed} thickness={thickness} reverse />
      
      {/* Pulsing Energy Core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[radius * 0.85, 32, 32]} />
        <meshPhysicalMaterial 
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={1.5}
          transparent
          opacity={0.8}
          roughness={0.2}
          transmission={0.9}
          thickness={1.0}
        />
      </mesh>
    </group>
  );
}

export default function Demo059PerfectSphere() {
  const { showStats } = useControls('Debug', { showStats: false });

  const {
    radius,
    speed,
    primaryArms,
    secondaryArms,
    thickness,
    primaryColor,
    secondaryColor,
    coreColor,
    bgColor,
    bloomIntensity
  } = useControls('Energy Sphere Controls', {
    Fibonacci_Math: folder({
      // Adjacent Fibonacci numbers (e.g. 21 and 34) create the beautiful interlocking diamond patterns
      primaryArms: { value: 34, min: 1, max: 89, step: 1 },
      secondaryArms: { value: 21, min: 1, max: 89, step: 1 },
    }),
    Geometry: folder({
      radius: { value: 3.5, min: 1.0, max: 10.0, step: 0.1 },
      thickness: { value: 0.04, min: 0.01, max: 0.2, step: 0.01 },
    }),
    Animation: folder({
      speed: { value: 1.0, min: 0.0, max: 5.0, step: 0.1 },
    }),
    Aesthetics: folder({
      bgColor: { value: '#020005' },
      primaryColor: { value: '#00ffff' },
      secondaryColor: { value: '#ff00aa' },
      coreColor: { value: '#2a00ff' },
      bloomIntensity: { value: 1.5, min: 0.0, max: 5.0, step: 0.1 },
    }),
  });

  return (
    <DemoScene
      debug={showStats}
      engineConfig={{
        background: bgColor,
        camera: { fov: 45, far: 100, near: 0.1, position: [0, 0, 12] },
        bloom: { intensity: bloomIntensity, luminanceThreshold: 0.1, luminanceSmoothing: 0.9 },
      }}
      orbitControls={true}
    >
      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} />
      <EnergySphere 
        count={3000} // Defines the resolution/length of the spirals
        radius={radius} 
        speed={speed} 
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        coreColor={coreColor}
        primaryArms={primaryArms}
        secondaryArms={secondaryArms}
        thickness={thickness}
      />
    </DemoScene>
  );
}
