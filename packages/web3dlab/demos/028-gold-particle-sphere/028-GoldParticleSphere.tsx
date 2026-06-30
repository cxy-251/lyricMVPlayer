import {useFrame} from '@react-three/fiber';
import {useControls} from 'leva';
import {useEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';

type GoldBrandControls = {
  particleCount: number;
  radius: number;
  rotationSpeed: number;
  goldCoverage: number;
  glassOpacity: number;
  networkDepth: number;
};

type TriangleDatum = {
  normal: THREE.Vector3;
  phase: number;
  scale: number;
  seed: number;
};

type NetworkData = {
  points: Float32Array;
  lines: Float32Array;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const fract = (value: number) => value - Math.floor(value);

const makeTriangleGeometry = () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([
        0, 0.09, 0,
        -0.075, -0.055, 0,
        0.075, -0.055, 0,
      ]),
      3,
    ),
  );
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  return geometry;
};

const makeTriangleData = (count: number): TriangleDatum[] => {
  const safeCount = Math.max(300, count);
  return Array.from({length: safeCount}, (_, index) => {
    const z = 1 - (2 * (index + 0.5)) / safeCount;
    const radial = Math.sqrt(Math.max(0, 1 - z * z));
    const theta = index * GOLDEN_ANGLE;
    const seed = fract(Math.sin(index * 73.31) * 11358.5453);
    return {
      normal: new THREE.Vector3(Math.cos(theta) * radial, z, Math.sin(theta) * radial).normalize(),
      phase: seed * Math.PI * 2,
      scale: 0.7 + fract(Math.sin(index * 17.17) * 491.2) * 0.48,
      seed,
    };
  });
};

const makeNetworkData = (count: number): NetworkData => {
  const points = new Float32Array(count * 3);
  const lineValues: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const x = -5.7 + fract(Math.sin(index * 12.1) * 91.7) * 7.2;
    const y = -2.5 + fract(Math.sin(index * 19.3) * 171.9) * 5.0;
    const z = -2.7 + fract(Math.sin(index * 29.7) * 117.3) * 2.2;
    points[index * 3] = x;
    points[index * 3 + 1] = y;
    points[index * 3 + 2] = z;
  }

  for (let index = 0; index < count; index += 1) {
    for (let other = index + 1; other < Math.min(count, index + 7); other += 1) {
      const ax = points[index * 3];
      const ay = points[index * 3 + 1];
      const bx = points[other * 3];
      const by = points[other * 3 + 1];
      const distance = Math.hypot(ax - bx, ay - by);
      if (distance < 1.25) {
        lineValues.push(ax, ay, points[index * 3 + 2], bx, by, points[other * 3 + 2]);
      }
    }
  }

  return {
    points,
    lines: new Float32Array(lineValues),
  };
};

const getGoldMask = (normal: THREE.Vector3, time: number, coverage: number) => {
  const latitudeBand = Math.sin(normal.y * 4.3 + time * 0.18);
  const longitudeBand = Math.sin((normal.x * 2.6 + normal.z * 3.8) * 2.1 - time * 0.24);
  const island = Math.sin((normal.x - normal.y * 0.22) * 7.1 + normal.z * 3.6 + time * 0.14);
  const bite = Math.cos(normal.z * 6.4 - normal.y * 2.9 + time * 0.11);
  return latitudeBand * 0.34 + longitudeBand * 0.32 + island * 0.24 + bite * 0.1 - (1 - coverage) * 0.55;
};

function LinkedParticleBackground({depth}: {depth: number}) {
  const groupRef = useRef<THREE.Group>(null);
  const data = useMemo(() => makeNetworkData(90), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.08) * 0.025;
    groupRef.current.position.z = -2.2 - depth * 0.6;
  });

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.points, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#d4d4d4" size={0.025} transparent opacity={0.22} depthWrite={false} />
      </points>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.lines, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#9a9a9a" transparent opacity={0.1} depthWrite={false} />
      </lineSegments>
    </group>
  );
}

function GoldBrandSphere({controls}: {controls: GoldBrandControls}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = Math.max(300, Math.round(controls.particleCount));
  const triangleGeometry = useMemo(makeTriangleGeometry, []);
  const triangles = useMemo(() => makeTriangleData(count), [count]);
  const helper = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const darkMetal = useMemo(() => new THREE.Color('#11100d'), []);
  const deepGold = useMemo(() => new THREE.Color('#8a651a'), []);
  const brightGold = useMemo(() => new THREE.Color('#f3d36a'), []);

  useEffect(() => () => triangleGeometry.dispose(), [triangleGeometry]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const mesh = meshRef.current;
    if (!group || !mesh) return;

    const time = state.clock.elapsedTime;
    group.rotation.y += delta * controls.rotationSpeed * 0.18;
    group.rotation.x = -0.12 + Math.sin(time * 0.17) * 0.035;

    let visibleIndex = 0;
    for (const triangle of triangles) {
      const mask = getGoldMask(triangle.normal, time, controls.goldCoverage);
      const shell = controls.radius + (mask > 0 ? 0.055 : 0.018);
      const lift = mask > 0 ? Math.sin(time * 1.4 + triangle.phase) * 0.045 : 0;

      position.copy(triangle.normal).multiplyScalar(shell + lift);
      lookAt.copy(triangle.normal).multiplyScalar(shell + 1);
      helper.position.copy(position);
      helper.lookAt(lookAt);
      helper.rotateZ(time * (0.12 + triangle.seed * 0.28) + triangle.phase);
      helper.scale.setScalar(triangle.scale * (mask > 0 ? 1.08 : 0.76));
      helper.updateMatrix();
      mesh.setMatrixAt(visibleIndex, helper.matrix);

      if (mask > 0) {
        color.copy(deepGold).lerp(brightGold, Math.min(1, mask * 1.7 + triangle.seed * 0.22));
      } else {
        color.copy(darkMetal).lerp(deepGold, Math.max(0, mask + 0.46) * 0.35);
      }
      mesh.setColorAt(visibleIndex, color);
      visibleIndex += 1;
    }

    mesh.count = visibleIndex;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef} position={[1.65, 0.08, 0]}>
      <mesh>
        <sphereGeometry args={[controls.radius * 1.015, 96, 64]} />
        <meshPhysicalMaterial
          color="#080706"
          transparent
          opacity={controls.glassOpacity}
          roughness={0.08}
          metalness={0.72}
          clearcoat={1}
          clearcoatRoughness={0.06}
          envMapIntensity={1.5}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[controls.radius * 1.018, 6]} />
        <meshBasicMaterial color="#b4974b" wireframe transparent opacity={0.24} />
      </mesh>
      <instancedMesh ref={meshRef} args={[triangleGeometry, undefined, triangles.length]} frustumCulled={false}>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          metalness={0.86}
          roughness={0.3}
          emissive="#241500"
          emissiveIntensity={0.1}
        />
      </instancedMesh>
    </group>
  );
}

function BrandOverlay() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        color: '#f5f5f5',
        fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace',
      }}
    >
      <div style={{position: 'absolute', left: 58, top: 26, fontSize: 20, letterSpacing: 0}}>WEB3 <span style={{fontSize: 9}}>RECORD</span></div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 58, height: 1, background: 'rgba(255,255,255,0.22)'}} />
      <div style={{position: 'absolute', left: 58, bottom: 112, fontSize: 92, lineHeight: 0.9, fontWeight: 300}}>04<span style={{fontSize: 22}}> / 04</span></div>
      <div style={{position: 'absolute', left: 60, bottom: 38, width: 440, fontSize: 15, lineHeight: 1.02, fontWeight: 700}}>
        WE PROVIDE 24/7 SUPPORT FOR ANY<br />
        TYPE OF PROJECT, WITH CONTINUOUS<br />
        MONITORING, INSTANT ISSUE<br />
        RESOLUTION, AND FULL SYSTEM<br />
        PROTECTION.
      </div>
      <div style={{position: 'absolute', right: -8, top: 62, fontSize: 52, fontWeight: 700}}>AI</div>
    </div>
  );
}

export default function Demo028GoldParticleSphere() {
  const controls = useControls('Gold Brand Sphere', {
    particleCount: {value: 1800, min: 500, max: 3200, step: 50},
    radius: {value: 1.78, min: 1.2, max: 2.4, step: 0.01},
    rotationSpeed: {value: 0.64, min: 0, max: 1.8, step: 0.01},
    goldCoverage: {value: 0.54, min: 0.2, max: 0.9, step: 0.01},
    glassOpacity: {value: 0.42, min: 0.1, max: 0.72, step: 0.01},
    networkDepth: {value: 0.66, min: 0, max: 1, step: 0.01},
  }) as GoldBrandControls;

  return (
    <div className="demo-viewport" style={{position: 'relative', background: '#070707', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0}}>
        <DemoScene
          engineConfig={{
            background: '#070707',
            camera: {position: [0, 0.04, 6.1], fov: 46, near: 0.1, far: 50},
            bloom: {intensity: 0.92, luminanceSmoothing: 0.42, luminanceThreshold: 0.2},
            vignette: {darkness: 0.64, offset: 0.18},
          }}
          orbitConfig={{autoRotate: false, minDistance: 4.5, maxDistance: 10}}
        >
          <ambientLight intensity={0.36} />
          <pointLight position={[2.5, 2.2, 3.4]} intensity={4.2} color="#fff1c0" />
          <pointLight position={[-3.6, -1.6, 2.8]} intensity={1.2} color="#7e7e7e" />
          <LinkedParticleBackground depth={controls.networkDepth} />
          <GoldBrandSphere controls={controls} />
        </DemoScene>
      </div>
      <BrandOverlay />
    </div>
  );
}
