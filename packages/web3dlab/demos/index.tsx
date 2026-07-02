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

import Demo025ASCIIShapeRenderer from './025-ascii-shape-renderer/025-ASCIIShapeRenderer';
import {asciiShapeRendererMetadata} from './025-ascii-shape-renderer/metadata';

import Demo026CodeMeltdown from './026-code-meltdown/026-CodeMeltdown';
import {codeMeltdownMetadata} from './026-code-meltdown/metadata';

import Demo027FluidNeonShader from './027-fluid-neon-shader/027-FluidNeonShader';
import {fluidNeonShaderMetadata} from './027-fluid-neon-shader/metadata';

import Demo028GoldParticleSphere from './028-gold-particle-sphere/028-GoldParticleSphere';
import {goldParticleSphereMetadata} from './028-gold-particle-sphere/metadata';

import Demo029ResonancePendulumLab from './029-resonance-pendulum-lab/029-ResonancePendulumLab';
import {resonancePendulumLabMetadata} from './029-resonance-pendulum-lab/metadata';

import Demo030ColorSortingParticles from './030-color-sorting-particles/030-ColorSortingParticles';
import {colorSortingParticlesMetadata} from './030-color-sorting-particles/metadata';

import Demo031AsciiMotionCards from './031-ascii-motion-cards/031-AsciiMotionCards';
import {asciiMotionCardsMetadata} from './031-ascii-motion-cards/metadata';

import Demo032ParametricJellyfish from './032-parametric-jellyfish/032-ParametricJellyfish';
import {parametricJellyfishMetadata} from './032-parametric-jellyfish/metadata';

import Demo033GeometricBreathing from './033-geometric-breathing/033-GeometricBreathing';
import {geometricBreathingMetadata} from './033-geometric-breathing/metadata';

import Demo034RecursiveJuggler from './034-recursive-juggler/034-RecursiveJuggler';
import {recursiveJugglerMetadata} from './034-recursive-juggler/metadata';

import Demo035TrajectoryDataCinema from './035-trajectory-data-cinema/035-TrajectoryDataCinema';
import {trajectoryDataCinemaMetadata} from './035-trajectory-data-cinema/metadata';

import Demo036SimulationUniverse from './036-simulation-universe/036-SimulationUniverse';
import {simulationUniverseMetadata} from './036-simulation-universe/metadata';

import Demo037POMBubbles from './037-pom-bubbles/037-POMBubbles';
import {pomBubblesMetadata} from './037-pom-bubbles/metadata';

import Demo038MarbleMusicMachine from './038-marble-music-machine/038-MarbleMusicMachine';
import {marbleMusicMachineMetadata} from './038-marble-music-machine/metadata';

import Demo039AirSurfaceMouse from './039-air-surface-mouse/039-AirSurfaceMouse';
import {airSurfaceMouseMetadata} from './039-air-surface-mouse/metadata';

import Demo040SoftBotanicalCompositor from './040-soft-botanical-compositor/040-SoftBotanicalCompositor';
import {softBotanicalCompositorMetadata} from './040-soft-botanical-compositor/metadata';

import Demo041AnimeLightningCity from './041-anime-lightning-city/041-AnimeLightningCity';
import {animeLightningCityMetadata} from './041-anime-lightning-city/metadata';

import Demo042ProbeDensityVisualControl from './042-probe-density-visual-control/042-ProbeDensityVisualControl';
import {probeDensityVisualControlMetadata} from './042-probe-density-visual-control/metadata';

import Demo043MetaballLiquidUI from './043-metaball-liquid-ui/043-MetaballLiquidUI';
import {metaballLiquidUIMetadata} from './043-metaball-liquid-ui/metadata';

import Demo044PrismAlbumMotion from './044-prism-album-motion/044-PrismAlbumMotion';
import {prismAlbumMotionMetadata} from './044-prism-album-motion/metadata';

import Demo045LenticularHoloCard from './045-lenticular-holo-card/045-LenticularHoloCard';
import {lenticularHoloCardMetadata} from './045-lenticular-holo-card/metadata';

import Demo046ALifeParticleSelection from './046-alife-particle-selection/046-ALifeParticleSelection';
import {alifeParticleSelectionMetadata} from './046-alife-particle-selection/metadata';

import Demo047OrganicSeedformMotion from './047-organic-seedform-motion/047-OrganicSeedformMotion';
import {organicSeedformMotionMetadata} from './047-organic-seedform-motion/metadata';

import Demo048ContourGeometryMotion from './048-contour-geometry-motion/048-ContourGeometryMotion';
import {contourGeometryMotionMetadata} from './048-contour-geometry-motion/metadata';

import Demo049WebGPUPhysicsInstanceLab from './049-webgpu-physics-instance-lab/049-WebGPUPhysicsInstanceLab';
import {webgpuPhysicsInstanceLabMetadata} from './049-webgpu-physics-instance-lab/metadata';

import Demo050WeatherSnowScene from './050-weather-snow-scene/050-WeatherSnowScene';
import {weatherSnowSceneMetadata} from './050-weather-snow-scene/metadata';

import Demo051ReferenceCameraConsole from './051-reference-camera-console/051-ReferenceCameraConsole';
import {referenceCameraConsoleMetadata} from './051-reference-camera-console/metadata';

import Demo052HandPulledThoughtSculpture from './052-hand-pulled-thought-sculpture/052-HandPulledThoughtSculpture';
import {handPulledThoughtSculptureMetadata} from './052-hand-pulled-thought-sculpture/metadata';

import Demo053PlasmaFieldReconnection from './053-plasma-field-reconnection/053-PlasmaFieldReconnection';
import {plasmaFieldReconnectionMetadata} from './053-plasma-field-reconnection/metadata';

import Demo054VisualInspectorControlLayer from './054-visual-inspector-control-layer/054-VisualInspectorControlLayer';
import {visualInspectorControlLayerMetadata} from './054-visual-inspector-control-layer/metadata';

import Demo055AsciiMaskPainter from './055-ascii-mask-painter/055-AsciiMaskPainter';
import {asciiMaskPainterMetadata} from './055-ascii-mask-painter/metadata';

import Demo056CollectiveTrajectories from './056-collective-trajectories/056-CollectiveTrajectories';
import {collectiveTrajectoriesMetadata} from './056-collective-trajectories/metadata';

import Demo057SumOfSquaresProof from './057-sum-of-squares-proof/057-SumOfSquaresProof';
import {sumOfSquaresProofMetadata} from './057-sum-of-squares-proof/metadata';

import Demo058CinematicStyleSequence from './058-cinematic-style-sequence/058-CinematicStyleSequence';
import {cinematicStyleSequenceMetadata} from './058-cinematic-style-sequence/metadata';

import Demo059PerfectSphere from './059-perfect-sphere/059-PerfectSphere';
import {perfectSphereMetadata} from './059-perfect-sphere/metadata';

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
  { ...asciiShapeRendererMetadata, Component: Demo025ASCIIShapeRenderer },
  { ...codeMeltdownMetadata, Component: Demo026CodeMeltdown },
  { ...fluidNeonShaderMetadata, Component: Demo027FluidNeonShader },
  { ...goldParticleSphereMetadata, Component: Demo028GoldParticleSphere },
  { ...resonancePendulumLabMetadata, Component: Demo029ResonancePendulumLab },
  { ...colorSortingParticlesMetadata, Component: Demo030ColorSortingParticles },
  { ...asciiMotionCardsMetadata, Component: Demo031AsciiMotionCards },
  { ...parametricJellyfishMetadata, Component: Demo032ParametricJellyfish },
  { ...geometricBreathingMetadata, Component: Demo033GeometricBreathing },
  { ...recursiveJugglerMetadata, Component: Demo034RecursiveJuggler },
  { ...trajectoryDataCinemaMetadata, Component: Demo035TrajectoryDataCinema },
  { ...simulationUniverseMetadata, Component: Demo036SimulationUniverse },
  { ...pomBubblesMetadata, Component: Demo037POMBubbles },
  { ...marbleMusicMachineMetadata, Component: Demo038MarbleMusicMachine },
  { ...airSurfaceMouseMetadata, Component: Demo039AirSurfaceMouse },
  { ...softBotanicalCompositorMetadata, Component: Demo040SoftBotanicalCompositor },
  { ...animeLightningCityMetadata, Component: Demo041AnimeLightningCity },
  { ...probeDensityVisualControlMetadata, Component: Demo042ProbeDensityVisualControl },
  { ...metaballLiquidUIMetadata, Component: Demo043MetaballLiquidUI },
  { ...prismAlbumMotionMetadata, Component: Demo044PrismAlbumMotion },
  { ...lenticularHoloCardMetadata, Component: Demo045LenticularHoloCard },
  { ...alifeParticleSelectionMetadata, Component: Demo046ALifeParticleSelection },
  { ...organicSeedformMotionMetadata, Component: Demo047OrganicSeedformMotion },
  { ...contourGeometryMotionMetadata, Component: Demo048ContourGeometryMotion },
  { ...webgpuPhysicsInstanceLabMetadata, Component: Demo049WebGPUPhysicsInstanceLab },
  { ...weatherSnowSceneMetadata, Component: Demo050WeatherSnowScene },
  { ...referenceCameraConsoleMetadata, Component: Demo051ReferenceCameraConsole },
  { ...handPulledThoughtSculptureMetadata, Component: Demo052HandPulledThoughtSculpture },
  { ...plasmaFieldReconnectionMetadata, Component: Demo053PlasmaFieldReconnection },
  { ...visualInspectorControlLayerMetadata, Component: Demo054VisualInspectorControlLayer },
  { ...asciiMaskPainterMetadata, Component: Demo055AsciiMaskPainter },
  { ...collectiveTrajectoriesMetadata, Component: Demo056CollectiveTrajectories },
  { ...sumOfSquaresProofMetadata, Component: Demo057SumOfSquaresProof },
  { ...cinematicStyleSequenceMetadata, Component: Demo058CinematicStyleSequence },
  { ...perfectSphereMetadata, Component: Demo059PerfectSphere },
];
