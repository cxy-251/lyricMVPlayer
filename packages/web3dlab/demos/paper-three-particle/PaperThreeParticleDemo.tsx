import React, {useMemo} from 'react';
import { resolveParticleEffectConfig } from '@paper-to-video/content-pipeline';
import * as THREE from 'three';
import {useFrame, useThree} from '@react-three/fiber';
import {useControls} from 'leva';
import {PerspectiveCamera} from '@react-three/drei';
import {DemoScene} from '../../core/DemoScene';

import type {ParticleEffectConfig} from '@paper-to-video/shared-types';

type ParticleSeed = {
  baseAngle: number;
  baseRadius: number;
  speed: number;
  phase: number;
  layer: number;
  tone: number;
};

type ParticleLayerKey = "primary" | "secondary" | "accent";

type LayeredParticleSeed = ParticleSeed & {
  colorLayer: ParticleLayerKey;
};

const hashNoise = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

const buildParticleSeeds = (count: number, seed: number, distribution: ParticleEffectConfig["distribution"]) => {
  return Array.from({length: count}, (_, index) => {
    const noiseA = hashNoise(seed * 101 + index * 13.17);
    const noiseB = hashNoise(seed * 211 + index * 7.41);
    const noiseC = hashNoise(seed * 307 + index * 3.91);
    const noiseD = hashNoise(seed * 401 + index * 11.73);
    const noiseE = hashNoise(seed * 503 + index * 5.61);
    const noiseF = hashNoise(seed * 601 + index * 17.21);

    const radiusNoise =
      distribution === "halo"
        ? 0.62 + noiseB * 0.38
        : distribution === "spiral"
          ? 0.12 + noiseB * 0.88
          : 0.06 + noiseB * noiseB * 0.78;

    return {
      baseAngle: noiseA * Math.PI * 2,
      baseRadius: radiusNoise,
      speed: 0.4 + noiseC * 1.8,
      phase: noiseD * Math.PI * 2,
      layer: noiseE * 2 - 1,
      tone: noiseF,
    };
  });
};

const resolveParticleColorLayer = (tone: number): ParticleLayerKey => {
  if (tone < 0.42) {
    return "primary";
  }
  if (tone < 0.78) {
    return "secondary";
  }
  return "accent";
};

const createGeometry = (shape: ParticleEffectConfig["shape"]) => {
  if (shape === "circle") {
    return new THREE.CircleGeometry(0.5, 18);
  }
  return new THREE.PlaneGeometry(1, 1);
};

export function ThreeParticleEffect({ seed = 1, absoluteFrame, simulationFrame }: { seed?: number; absoluteFrame?: number; simulationFrame?: number }) {
  const { size, scene } = useThree();
  const helper = useMemo(() => new THREE.Object3D(), []);
  
  const config = useMemo(() => resolveParticleEffectConfig(undefined), []);

  const particleSeeds = useMemo<LayeredParticleSeed[]>(
    () =>
      buildParticleSeeds(config.particleCount, seed, config.distribution).map((particle) => ({
        ...particle,
        colorLayer: resolveParticleColorLayer(particle.tone),
      })),
    [config.distribution, config.particleCount, seed],
  );

  const layeredSeeds = useMemo(
    () => ({
      primary: particleSeeds.filter((particle) => particle.colorLayer === "primary"),
      secondary: particleSeeds.filter((particle) => particle.colorLayer === "secondary"),
      accent: particleSeeds.filter((particle) => particle.colorLayer === "accent"),
    }),
    [particleSeeds],
  );

  const meshes = useMemo(() => {
    const geometry = createGeometry(config.shape);
    const createLayerMesh = (count: number, color: string) => {
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
      mesh.count = count;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      return mesh;
    };

    return {
      geometry,
      primary: createLayerMesh(layeredSeeds.primary.length, config.primaryColor),
      secondary: createLayerMesh(layeredSeeds.secondary.length, config.secondaryColor),
      accent: createLayerMesh(layeredSeeds.accent.length, config.accentColor),
    };
  }, [config.shape, config.primaryColor, config.secondaryColor, config.accentColor, layeredSeeds, scene]);

  React.useEffect(() => {
    return () => {
      const disposeMesh = (mesh: THREE.InstancedMesh) => {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
        scene.remove(mesh);
        mesh.dispose();
      };
      
      disposeMesh(meshes.primary);
      disposeMesh(meshes.secondary);
      disposeMesh(meshes.accent);
      meshes.geometry.dispose();
    };
  }, [meshes, scene]);

  useFrame((state) => {
    const resolvedFrame = simulationFrame ?? absoluteFrame;
    const timeInSeconds = resolvedFrame !== undefined ? resolvedFrame / 60 : state.clock.elapsedTime;
    const frame = timeInSeconds * 60;
    const time = frame * config.driftSpeed;
    const aspectScale = size.width / Math.max(1, size.height);
    
    (meshes.primary.material as THREE.MeshBasicMaterial).color.set(config.primaryColor);
    (meshes.secondary.material as THREE.MeshBasicMaterial).color.set(config.secondaryColor);
    (meshes.accent.material as THREE.MeshBasicMaterial).color.set(config.accentColor);

    const layerIndices: Record<ParticleLayerKey, number> = {
      primary: 0,
      secondary: 0,
      accent: 0,
    };

    particleSeeds.forEach((particle) => {
      const angle = particle.baseAngle + time * particle.speed;
      const distributionFactor =
        config.distribution === "halo" ? 1.18 : config.distribution === "spiral" ? 0.98 : 0.86;
      const radius =
        particle.baseRadius * config.orbitRadius * Math.min(size.width, size.height) * 0.065 * distributionFactor +
        Math.sin(time * 1.35 + particle.phase) * config.swirlStrength * 11;

      let x = 0;
      let y = 0;

      if (config.trajectory === "drift") {
        x =
          Math.cos(angle) * radius * aspectScale * 0.65 +
          Math.sin(time * 0.9 + particle.phase) * 42 +
          particle.layer * 10;
        y =
          Math.sin(angle * 0.5 + particle.phase) * radius * 0.4 +
          Math.cos(time * 1.2 + particle.phase) * 36 -
          (1 - Math.min(1, particle.baseRadius)) * 8;
      } else if (config.trajectory === "wave") {
        x =
          Math.sin(angle * 1.8 + particle.phase) * radius * aspectScale +
          Math.cos(time * 1.1 + particle.phase) * 18;
        y =
          Math.cos(angle * 1.2 + particle.phase) * radius * 0.62 +
          Math.sin(time * 2 + particle.phase) * 26;
      } else {
        const spiral = Math.sin(time * 0.72 + particle.phase * 1.3) * (config.distribution === "spiral" ? 12 : 6);
        const armOffset =
          config.distribution === "spiral"
            ? Math.sin(angle * 2.8 + particle.phase) * radius * 0.34
            : Math.sin(angle * 2 + particle.phase) * radius * 0.18;
        const centerBias = 1 - Math.min(1, particle.baseRadius);
        x =
          Math.cos(angle) * radius * aspectScale +
          Math.cos(angle * 2.2 + particle.phase) * spiral +
          armOffset;
        y =
          Math.sin(angle) * radius +
          Math.sin(angle * 1.6 + particle.phase) * spiral * 0.65 -
          centerBias * (config.distribution === "core" ? 12 : 4);
      }

      const sizeScale =
        config.distribution === "core"
          ? 0.82 + (1 - particle.baseRadius) * 0.9
          : config.distribution === "halo"
            ? 0.78 + particle.baseRadius * 0.42
            : 0.78 + particle.baseRadius * 0.28;
      const drawSize = config.pointSize * sizeScale;
      helper.position.set(x, y, particle.layer * config.layerDepth);
      helper.scale.set(drawSize, drawSize, 1);
      helper.rotation.set(0, 0, config.shape === "diamond" ? Math.PI / 4 : 0);
      helper.updateMatrix();

      const targetMesh = meshes[particle.colorLayer];
      const layerIndex = layerIndices[particle.colorLayer];
      targetMesh.setMatrixAt(layerIndex, helper.matrix);
      layerIndices[particle.colorLayer] += 1;
    });

    meshes.primary.instanceMatrix.needsUpdate = true;
    meshes.secondary.instanceMatrix.needsUpdate = true;
    meshes.accent.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <PerspectiveCamera makeDefault fov={38} position={[0, 0, 22]} near={0.1} far={100} />
    </>
  );
}

export default function PaperThreeParticleDemo() {
  const { showStats } = useControls('Debug', { showStats: false });
  
  return (
    <DemoScene
      debug={showStats}
      engineConfig={{
        background: '#000000',
      }}
      orbitControls={false}
    >
      <ThreeParticleEffect seed={1} />
    </DemoScene>
  );
}
