import React from 'react';
import type {DemoDefinition} from '../types';
import {EFFECT_ATOMS} from '../atoms';

import BlenderFibonacciDemo from './blender-fibonacci/BlenderFibonacciDemo';
import {blenderFibonacciMetadata} from './blender-fibonacci/metadata';

import GPGPUBlackHoleDemo from './gpgpu-black-hole/GPGPUBlackHoleDemo';
import {gpgpuBlackHoleMetadata} from './gpgpu-black-hole/metadata';

import LiquidMetalDemo from './liquid-metal/LiquidMetalDemo';
import {liquidMetalMetadata} from './liquid-metal/metadata';
import CyberCityDemo from './cyber-city/CyberCityDemo';
import {cyberCityMetadata} from './cyber-city/metadata';
import CosmicNebulaDemo from './cosmic-nebula/CosmicNebulaDemo';
import {cosmicNebulaMetadata} from './cosmic-nebula/metadata';
import QuantumNetworkDemo from './quantum-network/QuantumNetworkDemo';
import {quantumNetworkMetadata} from './quantum-network/metadata';
import FluidCursorFieldDemo from './fluid-cursor-field/FluidCursorFieldDemo';
import {fluidCursorFieldMetadata} from './fluid-cursor-field/metadata';
import NeonEnergyTunnelDemo from './neon-energy-tunnel/NeonEnergyTunnelDemo';
import {neonEnergyTunnelMetadata} from './neon-energy-tunnel/metadata';
import ParticleGalaxyDemo from './particle-galaxy/ParticleGalaxyDemo';
import {particleGalaxyMetadata} from './particle-galaxy/metadata';
import ParticleMorphingFieldDemo from './particle-morphing-field/ParticleMorphingFieldDemo';
import {particleMorphingFieldMetadata} from './particle-morphing-field/metadata';
import PhysicsClothBannerDemo from './physics-cloth-banner/PhysicsClothBannerDemo';
import {physicsClothBannerMetadata} from './physics-cloth-banner/metadata';
import LiquidMetaballsDemo from './liquid-metaballs/LiquidMetaballsDemo';
import {liquidMetaballsMetadata} from './liquid-metaballs/metadata';
import GPGPUTextMorphingDemo from './text-morphing/GPGPUTextMorphingDemo';
import {textMorphingMetadata} from './text-morphing/metadata';
import PhysicsSandboxDemo from './physics-sandbox/PhysicsSandboxDemo';
import {physicsSandboxMetadata} from './physics-sandbox/metadata';
import AudioMetaballsDemo from './audio-metaballs/AudioMetaballsDemo';
import {audioMetaballsMetadata} from './audio-metaballs/metadata';
import BoidsFlockingDemo from './boids-flocking/BoidsFlockingDemo';
import {boidsFlockingMetadata} from './boids-flocking/metadata';
import AudioFerrofluidDemo from './audio-ferrofluid/AudioFerrofluidDemo';
import {audioFerrofluidMetadata} from './audio-ferrofluid/metadata';
import UltimateConvergenceDemo from './ultimate-convergence/UltimateConvergenceDemo';
import {ultimateConvergenceMetadata} from './ultimate-convergence/metadata';

export const demos: DemoDefinition[] = [
  {
    ...blenderFibonacciMetadata,
    Component: BlenderFibonacciDemo,
  },
  {
    ...gpgpuBlackHoleMetadata,
    Component: GPGPUBlackHoleDemo,
  },
  {
    ...liquidMetalMetadata,
    Component: LiquidMetalDemo,
  },
  {
    ...cyberCityMetadata,
    Component: CyberCityDemo,
  },
  {
    ...quantumNetworkMetadata,
    Component: QuantumNetworkDemo,
  },
  {
    ...cosmicNebulaMetadata,
    Component: CosmicNebulaDemo,
  },
  {
    ...particleGalaxyMetadata,
    Component: ParticleGalaxyDemo,
  },
  {
    ...neonEnergyTunnelMetadata,
    Component: NeonEnergyTunnelDemo,
  },
  {
    ...fluidCursorFieldMetadata,
    Component: FluidCursorFieldDemo,
  },
  {
    ...physicsClothBannerMetadata,
    Component: PhysicsClothBannerDemo,
  },
  {
    ...particleMorphingFieldMetadata,
    Component: ParticleMorphingFieldDemo,
  },
  {
    ...liquidMetaballsMetadata,
    Component: LiquidMetaballsDemo,
  },
  {
    ...textMorphingMetadata,
    Component: GPGPUTextMorphingDemo,
  },
  {
    ...physicsSandboxMetadata,
    Component: PhysicsSandboxDemo,
  },
  {
    ...audioMetaballsMetadata,
    Component: AudioMetaballsDemo,
  },
  {
    ...boidsFlockingMetadata,
    Component: BoidsFlockingDemo,
  },
  {
    ...audioFerrofluidMetadata,
    Component: AudioFerrofluidDemo,
  },
  {
    ...ultimateConvergenceMetadata,
    Component: UltimateConvergenceDemo,
  },
];

function PaperEffectDemoScene({ atom }: { atom: any }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const Component = atom.Component;
  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#000'
      }}
    >
      <Component
        absoluteFrame={0}
        activationFrame={0}
        height={dimensions.height}
        mode="interactive"
        seed={1}
        width={dimensions.width}
      />
    </div>
  );
}

const paperDemos: DemoDefinition[] = (Object.values(EFFECT_ATOMS) as any[]).map((atom: any) => ({
  id: atom.id,
  title: atom.title,
  description: atom.description,
  tags: ["paper-effect", "web3dlab"],
  route: `paper-effects/${atom.id}`,
  Component: () => <PaperEffectDemoScene atom={atom} />
}));

demos.push(...paperDemos);

