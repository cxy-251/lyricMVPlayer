import React from 'react';
import type {DemoDefinition} from '../types';

import Demo001BlenderFibonacci from './001-blender-fibonacci/001-BlenderFibonacci';
import {blenderFibonacciMetadata} from './001-blender-fibonacci/metadata';

import Demo002GPGPUBlackHole from './002-gpgpu-black-hole/002-GPGPUBlackHole';
import {gpgpuBlackHoleMetadata} from './002-gpgpu-black-hole/metadata';

import Demo003LiquidMetal from './003-liquid-metal/003-LiquidMetal';
import {liquidMetalMetadata} from './003-liquid-metal/metadata';

import Demo004CyberCity from './004-cyber-city/004-CyberCity';
import {cyberCityMetadata} from './004-cyber-city/metadata';

import Demo005QuantumNetwork from './005-quantum-network/005-QuantumNetwork';
import {quantumNetworkMetadata} from './005-quantum-network/metadata';

import Demo006CosmicNebula from './006-cosmic-nebula/006-CosmicNebula';
import {cosmicNebulaMetadata} from './006-cosmic-nebula/metadata';

import Demo007ParticleGalaxy from './007-particle-galaxy/007-ParticleGalaxy';
import {particleGalaxyMetadata} from './007-particle-galaxy/metadata';

import Demo008NeonEnergyTunnel from './008-neon-energy-tunnel/008-NeonEnergyTunnel';
import {neonEnergyTunnelMetadata} from './008-neon-energy-tunnel/metadata';

import Demo009FluidCursorField from './009-fluid-cursor-field/009-FluidCursorField';
import {fluidCursorFieldMetadata} from './009-fluid-cursor-field/metadata';

import Demo010PhysicsClothBanner from './010-physics-cloth-banner/010-PhysicsClothBanner';
import {physicsClothBannerMetadata} from './010-physics-cloth-banner/metadata';

import Demo011ParticleMorphingField from './011-particle-morphing-field/011-ParticleMorphingField';
import {particleMorphingFieldMetadata} from './011-particle-morphing-field/metadata';

import Demo012LiquidMetaballs from './012-liquid-metaballs/012-LiquidMetaballs';
import {liquidMetaballsMetadata} from './012-liquid-metaballs/metadata';

import Demo013GPGPUTextMorphing from './013-text-morphing/013-GPGPUTextMorphing';
import {textMorphingMetadata} from './013-text-morphing/metadata';

import Demo014PhysicsSandbox from './014-physics-sandbox/014-PhysicsSandbox';
import {physicsSandboxMetadata} from './014-physics-sandbox/metadata';

import Demo015AudioMetaballs from './015-audio-metaballs/015-AudioMetaballs';
import {audioMetaballsMetadata} from './015-audio-metaballs/metadata';

import Demo016BoidsFlocking from './016-boids-flocking/016-BoidsFlocking';
import {boidsFlockingMetadata} from './016-boids-flocking/metadata';

import Demo017AudioFerrofluid from './017-audio-ferrofluid/017-AudioFerrofluid';
import {audioFerrofluidMetadata} from './017-audio-ferrofluid/metadata';

import Demo018UltimateConvergence from './018-ultimate-convergence/018-UltimateConvergence';
import {ultimateConvergenceMetadata} from './018-ultimate-convergence/metadata';

import Demo019PaperDonutSpin from './019-paper-donut-spin/019-PaperDonutSpin';
import {paperDonutSpinMetadata} from './019-paper-donut-spin/metadata';

import Demo020PaperLightsBeams from './020-paper-lights-beams/020-PaperLightsBeams';
import {paperLightsBeamsMetadata} from './020-paper-lights-beams/metadata';

import Demo021PaperRubiksCube from './021-paper-rubiks-cube/021-PaperRubiksCube';
import {paperRubiksCubeMetadata} from './021-paper-rubiks-cube/metadata';

import Demo022PaperSnakeGrid from './022-paper-snake-grid/022-PaperSnakeGrid';
import {paperSnakeGridMetadata} from './022-paper-snake-grid/metadata';

import Demo023PaperThreeLife from './023-paper-three-life/023-PaperThreeLife';
import {paperThreeLifeMetadata} from './023-paper-three-life/metadata';

import Demo024PaperThreeParticle from './024-paper-three-particle/024-PaperThreeParticle';
import {paperThreeParticleMetadata} from './024-paper-three-particle/metadata';

function createPaperDemo(Component: any) {
  return function PaperEffectDemoScene() {
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
  };
}

export const demos: DemoDefinition[] = [
  { ...blenderFibonacciMetadata, Component: Demo001BlenderFibonacci },
  { ...gpgpuBlackHoleMetadata, Component: Demo002GPGPUBlackHole },
  { ...liquidMetalMetadata, Component: Demo003LiquidMetal },
  { ...cyberCityMetadata, Component: Demo004CyberCity },
  { ...quantumNetworkMetadata, Component: Demo005QuantumNetwork },
  { ...cosmicNebulaMetadata, Component: Demo006CosmicNebula },
  { ...particleGalaxyMetadata, Component: Demo007ParticleGalaxy },
  { ...neonEnergyTunnelMetadata, Component: Demo008NeonEnergyTunnel },
  { ...fluidCursorFieldMetadata, Component: Demo009FluidCursorField },
  { ...physicsClothBannerMetadata, Component: Demo010PhysicsClothBanner },
  { ...particleMorphingFieldMetadata, Component: Demo011ParticleMorphingField },
  { ...liquidMetaballsMetadata, Component: Demo012LiquidMetaballs },
  { ...textMorphingMetadata, Component: Demo013GPGPUTextMorphing },
  { ...physicsSandboxMetadata, Component: Demo014PhysicsSandbox },
  { ...audioMetaballsMetadata, Component: Demo015AudioMetaballs },
  { ...boidsFlockingMetadata, Component: Demo016BoidsFlocking },
  { ...audioFerrofluidMetadata, Component: Demo017AudioFerrofluid },
  { ...ultimateConvergenceMetadata, Component: Demo018UltimateConvergence },
  { ...paperDonutSpinMetadata, Component: createPaperDemo(Demo019PaperDonutSpin) },
  { ...paperLightsBeamsMetadata, Component: createPaperDemo(Demo020PaperLightsBeams) },
  { ...paperRubiksCubeMetadata, Component: createPaperDemo(Demo021PaperRubiksCube) },
  { ...paperSnakeGridMetadata, Component: createPaperDemo(Demo022PaperSnakeGrid) },
  { ...paperThreeLifeMetadata, Component: createPaperDemo(Demo023PaperThreeLife) },
  { ...paperThreeParticleMetadata, Component: createPaperDemo(Demo024PaperThreeParticle) },
];
