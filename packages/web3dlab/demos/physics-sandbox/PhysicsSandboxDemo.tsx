import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Physics, RigidBody, CuboidCollider, RapierRigidBody } from '@react-three/rapier';
import { Environment, MeshTransmissionMaterial, MeshReflectorMaterial } from '@react-three/drei';
import { useControls } from 'leva';
import { DemoScene } from '../../core/DemoScene';

function FallingCube({ pos, rot, color }: { pos: [number, number, number]; rot: [number, number, number]; color: string }) {
  const ref = useRef<RapierRigidBody>(null);
  
  return (
    <RigidBody ref={ref} colliders="cuboid" restitution={0.7} friction={0.2} position={pos} rotation={rot}>
      <mesh castShadow receiveShadow onClick={(e) => {
        e.stopPropagation();
        if (ref.current) {
          ref.current.wakeUp();
          ref.current.applyImpulse({ x: (Math.random() - 0.5) * 15, y: 35, z: (Math.random() - 0.5) * 15 }, true);
          ref.current.applyTorqueImpulse({ x: Math.random() * 5, y: Math.random() * 5, z: Math.random() * 5 }, true);
        }
      }}>
        <boxGeometry args={[1.5, 1.5, 1.5]} />
        <MeshTransmissionMaterial 
          backside
          samples={8}
          thickness={2.0}
          chromaticAberration={0.15}
          anisotropy={0.3}
          distortion={0.2}
          distortionScale={0.5}
          temporalDistortion={0.2}
          color={color}
          roughness={0.05}
          metalness={0.05}
          ior={1.5}
          transmission={1.0}
        />
      </mesh>
    </RigidBody>
  );
}

function HeroObject() {
  const ref = useRef<RapierRigidBody>(null);
  return (
    <RigidBody ref={ref} colliders="ball" restitution={0.9} position={[0, 8, 0]}>
      <mesh castShadow receiveShadow onClick={(e) => {
         e.stopPropagation();
         if (ref.current) {
            ref.current.wakeUp();
            ref.current.applyImpulse({x:0, y:80, z:0}, true);
         }
      }}>
        <sphereGeometry args={[2.5, 64, 64]} />
        <meshPhysicalMaterial 
          color="#ff0055" 
          roughness={0.1} 
          metalness={0.9} 
          emissive="#440011" 
          emissiveIntensity={1.5} 
          clearcoat={1.0}
          clearcoatRoughness={0.05}
        />
      </mesh>
    </RigidBody>
  );
}

function PhysicsEnvironment({ count }: { count: number }) {
  const cubes = useMemo(() => {
    const arr = [];
    const colors = ['#00ffff', '#ff00ff', '#ffffff', '#0044ff'];
    for (let i = 0; i < count; i++) {
      arr.push({
        pos: [(Math.random() - 0.5) * 12, Math.random() * 30 + 10, (Math.random() - 0.5) * 12],
        rot: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    return arr;
  }, [count]);

  return (
    <>
      {/* Floor - Highly Reflective Obsidian / Mirror */}
      <RigidBody type="fixed" restitution={0.5} friction={0.8}>
        <mesh position={[0, -0.5, 0]} receiveShadow>
          <cylinderGeometry args={[25, 25, 1, 64]} />
          <MeshReflectorMaterial
            blur={[400, 100]}
            resolution={1024}
            mixBlur={1}
            mixStrength={40}
            roughness={0.1}
            depthScale={1.2}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#050505"
            metalness={0.5}
            mirror={1}
          />
        </mesh>
      </RigidBody>

      {/* Invisible walls */}
      <RigidBody type="fixed"><CuboidCollider args={[20, 30, 1]} position={[0, 15, -20]} /></RigidBody>
      <RigidBody type="fixed"><CuboidCollider args={[20, 30, 1]} position={[0, 15, 20]} /></RigidBody>
      <RigidBody type="fixed"><CuboidCollider args={[1, 30, 20]} position={[-20, 15, 0]} /></RigidBody>
      <RigidBody type="fixed"><CuboidCollider args={[1, 30, 20]} position={[20, 15, 0]} /></RigidBody>

      {/* Falling Cubes */}
      {cubes.map((cube, i) => (
        <FallingCube key={i} pos={cube.pos as [number,number,number]} rot={cube.rot as [number,number,number]} color={cube.color} />
      ))}
      
      {/* Interactive Hero Object */}
      <HeroObject />
    </>
  );
}

export default function PhysicsSandboxDemo() {
  const controls = useControls('Glass Physics Engine', {
    gravity: { value: -9.81, min: -30, max: 0, step: 0.1 },
    objectCount: { value: 60, min: 10, max: 200, step: 10 },
  });

  return (
    <DemoScene
      engineConfig={{
        background: '#010103',
        camera: { position: [0, 12, 35], fov: 45 }
      }}
      orbitConfig={{
        autoRotate: true,
        autoRotateSpeed: 1.0,
      }}
    >
      <Environment preset="city" />
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 30, 10]} intensity={3.0} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-15, 15, -15]} intensity={2.0} color="#00ddff" />
      <pointLight position={[15, 10, 15]} intensity={2.0} color="#ff00dd" />

      <Physics gravity={[0, controls.gravity, 0]}>
        <PhysicsEnvironment count={controls.objectCount} />
      </Physics>
    </DemoScene>
  );
}
