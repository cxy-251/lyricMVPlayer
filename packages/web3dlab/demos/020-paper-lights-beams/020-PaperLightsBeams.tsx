import React, {useMemo, useRef} from 'react';
import { resolveLightsEffectConfig } from '@paper-to-video/content-pipeline';
import * as THREE from 'three';
import {useFrame, useThree} from '@react-three/fiber';
import {useControls} from 'leva';
import {DemoScene} from '../../core/DemoScene';
import {createLightsMeshes} from './core/createLightsMeshes';
import {updateLightsInstances} from './core/updateLightsInstances';

import {applyForwardDollyRig} from '../../core/updateCameraRigs';
import type {LightsBeamSeed} from './lights-beams.types';

const hashNoise = (value: number) => {
  const resolved = Math.sin(value * 12.9898) * 43758.5453;
  return resolved - Math.floor(resolved);
};

const buildBeamSeeds = (count: number, seed: number): LightsBeamSeed[] =>
  Array.from({length: count}, (_, index) => ({
    baseAngle: hashNoise(seed * 101 + index * 5.17) * Math.PI * 2,
    depth: hashNoise(seed * 211 + index * 11.37),
    drift: hashNoise(seed * 307 + index * 3.91) * 2 - 1,
    lane: hashNoise(seed * 401 + index * 7.53),
    orbit: hashNoise(seed * 503 + index * 13.29),
    phase: hashNoise(seed * 601 + index * 9.11) * Math.PI * 2,
    pulse: 10 + hashNoise(seed * 701 + index * 15.83) * 24,
    speed: 0.018 + hashNoise(seed * 809 + index * 17.47) * 0.04,
  }));

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const smoothPulse = (value: number, start: number, peak: number, end: number) => {
  if (value <= start || value >= end) {
    return 0;
  }
  if (value < peak) {
    return clamp01((value - start) / Math.max(0.0001, peak - start));
  }
  return clamp01((end - value) / Math.max(0.0001, end - peak));
};

export function LightsBeamsEffect({ seed = 1, absoluteFrame, simulationFrame }: { seed?: number; absoluteFrame?: number; simulationFrame?: number }) {
  const { camera, scene } = useThree();
  const helper = useMemo(() => new THREE.Object3D(), []);
  const lookAtTarget = useMemo(() => new THREE.Vector3(), []);
  
  const config = useMemo(() => resolveLightsEffectConfig(undefined), []);
  const seeds = useMemo(() => buildBeamSeeds(config.beamCount, seed), [config.beamCount, seed]);

  const bundle = useMemo(() => {
    const root = new THREE.Group();
    return { bundle: createLightsMeshes({
      accentColor: config.accentColor,
      beamCount: config.beamCount,
      coreColor: config.primaryColor,
      glowColor: config.secondaryColor,
      root,
    }), root };
  }, [config]);

  React.useEffect(() => {
    scene.fog = new THREE.FogExp2(0x071320, 0.03);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  React.useEffect(() => {
    return () => {
      bundle.bundle.orbGeometry.dispose();
      bundle.bundle.dotGeometry.dispose();
      bundle.bundle.groundDiscGeometry.dispose();
      bundle.bundle.groundRingGeometry.dispose();
      bundle.bundle.floorTiles.forEach((tile) => {
        tile.geometry.dispose();
        tile.fillMaterial.dispose();
        tile.wireMaterial.dispose();
        tile.guideRails.forEach((p) => { p.geometry.dispose(); p.material.dispose(); });
        tile.guideDashes.forEach((p) => { p.geometry.dispose(); p.material.dispose(); });
      });
      bundle.bundle.horizonGeometry.dispose();
      bundle.bundle.horizonMaterial.dispose();
      bundle.bundle.glow.mesh.dispose();
      bundle.bundle.core.mesh.dispose();
      bundle.bundle.accent.mesh.dispose();
      bundle.bundle.groundAura.mesh.dispose();
      bundle.bundle.groundGlow.mesh.dispose();
      bundle.bundle.groundRim.mesh.dispose();
      bundle.bundle.surfaceDots.mesh.dispose();
      bundle.bundle.surfaceAccent.mesh.dispose();
      bundle.bundle.stars.geometry.dispose();
      bundle.bundle.stars.material.dispose();
      bundle.bundle.glow.material.dispose();
      bundle.bundle.core.material.dispose();
      bundle.bundle.accent.material.dispose();
      bundle.bundle.groundAura.material.dispose();
      bundle.bundle.groundGlow.material.dispose();
      bundle.bundle.groundRim.material.dispose();
      bundle.bundle.surfaceDots.material.dispose();
      bundle.bundle.surfaceAccent.material.dispose();
    };
  }, [bundle]);

  useFrame((state) => {
    const isPulse = config.variant === "pulse";
    const resolvedFrame = simulationFrame ?? absoluteFrame;
    const timeInSeconds = resolvedFrame !== undefined ? resolvedFrame / 60 : state.clock.elapsedTime;
    const frame = timeInSeconds * 60;
    const time = frame * config.motionSpeed * 6.9;

    if (isPulse) {
      bundle.bundle.core.material.color.set(config.primaryColor);
      bundle.bundle.glow.material.color.set(config.secondaryColor);
      bundle.bundle.accent.material.color.set(config.accentColor);
    } else {
      bundle.bundle.core.material.color.set("#ffffff");
      bundle.bundle.glow.material.color.set("#ffffff");
      bundle.bundle.accent.material.color.set("#ffffff");
    }

    const atmosphereFill = new THREE.Color("#102233");
    const atmosphereLines = new THREE.Color("#3e7aa4");
    const atmosphereAccent = new THREE.Color("#6aa7d9");
    bundle.bundle.groundAura.material.color.copy(atmosphereFill);
    bundle.bundle.groundGlow.material.color.copy(atmosphereLines);
    bundle.bundle.groundRim.material.color.copy(atmosphereAccent);
    bundle.bundle.surfaceDots.material.color.copy(atmosphereLines);
    bundle.bundle.surfaceAccent.material.color.copy(atmosphereAccent);
    bundle.bundle.floorTiles.forEach((tile) => {
      tile.fillMaterial.color.copy(atmosphereFill);
      tile.wireMaterial.color.copy(atmosphereLines);
    });
    bundle.bundle.horizonMaterial.color.copy(atmosphereFill);

    const choreographyPhase = (time * 0.055) % 1;
    const pulseSection = smoothPulse(choreographyPhase, 0.08, 0.24, 0.42);
    const surgeSection = smoothPulse(choreographyPhase, 0.38, 0.58, 0.8);
    const settleSection = smoothPulse(choreographyPhase, 0.72, 0.88, 1);
    const choreography = {
      auraGain: 0.9 + (0.24 + config.beatIntensity * 0.34) * pulseSection + (0.12 + config.beatIntensity * 0.2) * surgeSection,
      fieldGain: 0.82 + (0.18 + config.beatIntensity * 0.18) * pulseSection + (0.08 + config.beatIntensity * 0.08) * surgeSection,
      nearBias: pulseSection * (0.08 + config.beatIntensity * 0.16) + surgeSection * (0.16 + config.beatIntensity * 0.24),
      orbGain: 0.84 + (0.14 + config.beatIntensity * 0.14) * pulseSection + (0.12 + config.beatIntensity * 0.16) * surgeSection,
      rimGain: 0.9 + settleSection * (0.06 + config.beatIntensity * 0.1) + surgeSection * (0.06 + config.beatIntensity * 0.08),
    };

    const forwardPhase = (time * 0.11) % 1;
    const cameraBoost = 1 + surgeSection * 0.22 + pulseSection * 0.08;
    const cameraDolly = isPulse ? 0.28 + (Math.sin(time * 0.16) + 1) * 0.12 : forwardPhase * 12.6 * cameraBoost;
    
    applyForwardDollyRig({
      camera: camera as THREE.PerspectiveCamera,
      target: lookAtTarget,
      time,
      baseX: 0,
      baseY: 1.34,
      baseZ: 8.3,
      dollyOffset: cameraDolly,
      dollyMultiplier: 1.48,
      xDrift: 0.22,
      yDrift: 0.05,
      zDrift: 0.06,
      targetY: -0.68,
      targetZ: -18.6,
      targetXDrift: 0.28,
      targetYDrift: 0.08,
      targetZDrift: 0.8,
    });

    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = 0.028 + surgeSection * 0.007 - pulseSection * 0.001;
    }

    bundle.bundle.glow.material.opacity = 0.0005 * choreography.orbGain;
    bundle.bundle.core.material.opacity = 0.94;
    bundle.bundle.accent.material.opacity = 0.24 * choreography.rimGain;
    bundle.bundle.groundAura.material.opacity = 0.014 * choreography.auraGain;
    bundle.bundle.groundGlow.material.opacity = 0.052 * choreography.orbGain;
    bundle.bundle.groundRim.material.opacity = 0.12 * choreography.rimGain;
    bundle.bundle.surfaceDots.material.opacity = 0.08 * choreography.fieldGain;
    bundle.bundle.surfaceAccent.material.opacity = 0.12 * choreography.fieldGain;
    bundle.bundle.stars.material.opacity = 0.04 + choreography.fieldGain * 0.03 + surgeSection * 0.02;
    bundle.bundle.stars.material.size = 0.1 + config.density * 0.026 + pulseSection * 0.016 + surgeSection * 0.03;
    bundle.bundle.horizonMaterial.opacity = 0.07 + pulseSection * 0.03 + surgeSection * 0.02;
    bundle.bundle.floorTiles.forEach((tile) => {
      tile.fillMaterial.opacity = 0.03 + pulseSection * 0.02;
      tile.wireMaterial.opacity = 0.14 + surgeSection * 0.08 + settleSection * 0.04;
      tile.guideRails.forEach((plane) => { plane.material.opacity = 0.12 + surgeSection * 0.08; });
      tile.guideDashes.forEach((plane) => { plane.material.opacity = 0.1 + pulseSection * 0.08 + surgeSection * 0.04; });
    });
    bundle.bundle.horizonMesh.position.set(
      Math.sin(time * 0.08) * 0.24,
      4.8 + Math.cos(time * 0.11) * 0.12,
      -28 - cameraDolly * 0.92,
    );

    updateLightsInstances({
      choreography,
      config,
      floorTiles: bundle.bundle.floorTiles,
      frame,
      helper,
      meshes: {
        accent: bundle.bundle.accent,
        core: bundle.bundle.core,
        glow: bundle.bundle.glow,
        groundAura: bundle.bundle.groundAura,
        groundGlow: bundle.bundle.groundGlow,
        groundRim: bundle.bundle.groundRim,
        surfaceAccent: bundle.bundle.surfaceAccent,
        surfaceDots: bundle.bundle.surfaceDots,
      },
      pulseHeroes: bundle.bundle.pulseHeroes,
      stars: bundle.bundle.stars,
      seeds,
    });
  });

  return (
    <>
      <primitive object={bundle.root} />
      <ambientLight intensity={0.95} color="#7fbaff" />
      <directionalLight position={[-4.5, 7.5, 5.2]} intensity={1.7} color="#dff6ff" />
      <directionalLight position={[4.8, 2.1, 3.6]} intensity={0.9} color="#ff9fe6" />
    </>
  );
}

export default function Demo020PaperLightsBeams() {
  const { showStats } = useControls('Debug', { showStats: false });
  
  return (
    <DemoScene
      debug={showStats}
      engineConfig={{
        background: '#000000',
        camera: { fov: 34, far: 100, near: 0.1, position: [0, 1.38, 7.6] },
        bloom: { intensity: 0.5, luminanceThreshold: 0.78, luminanceSmoothing: 0.22 },
      }}
      orbitControls={false}
    >
      <LightsBeamsEffect seed={1} />
    </DemoScene>
  );
}
