import {useFrame, useThree} from '@react-three/fiber';
import {button, folder, useControls} from 'leva';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';
import {
  DEFAULT_SIMULATION_PARAMETERS,
  TORUS_PRESETS,
  evaluateTorusField,
  generateStreamlineData,
  parseTorusState,
  sanitizeSimulationParameters,
  serializeTorusState,
  torusToCartesian,
  torusVelocityToCartesian,
} from './torusDynamics';
import type {
  StreamlineData,
  TorusPresetName,
  TorusSimulationParameters,
  TorusState,
} from './torusDynamics';
import {
  createFresnelMaterial,
  createStreamlineGeometry,
  createStreamlineMaterial,
} from './torusMaterials';
import {useTorusSimulation} from './useTorusSimulation';

// Interpretable reconstruction inspired by Matt Dennie's toroidal motion study:
// https://x.com/Matt_Dennie/status/2075980130254782975?s=20

type QualityPreset = 'Performance' | 'Balanced' | 'Cinematic';
type ColorMode = 'Velocity' | 'Radius' | 'Monochrome';
type ArrowMode = 'Axis' | 'Local Flow' | 'Hidden';

type TorusControls = TorusSimulationParameters & {
  arrowMode: ArrowMode;
  autoRotate: boolean;
  bloomStrength: number;
  cameraSpeed: number;
  colorMode: ColorMode;
  flowSpeed: number;
  headWidth: number;
  opacity: number;
  pause: boolean;
  preset: TorusPresetName;
  qualityPreset: QualityPreset;
  shellOpacity: number;
  showFieldGlyphs: boolean;
  showShell: boolean;
  trailLength: number;
};

const DEFAULT_CONTROLS: TorusControls = {
  ...DEFAULT_SIMULATION_PARAMETERS,
  arrowMode: 'Local Flow',
  autoRotate: true,
  bloomStrength: 0.48,
  cameraSpeed: 2.5,
  colorMode: 'Velocity',
  flowSpeed: 0.075,
  headWidth: 0.032,
  opacity: 0.5,
  pause: false,
  preset: 'Balanced Flow',
  qualityPreset: 'Balanced',
  shellOpacity: 0.34,
  showFieldGlyphs: false,
  showShell: true,
  trailLength: 0.24,
};

const QUALITY_SETTINGS: Record<QualityPreset, Pick<TorusControls, 'samplesPerLine' | 'streamlineCount'>> = {
  Performance: {samplesPerLine: 160, streamlineCount: 360},
  Balanced: {samplesPerLine: 240, streamlineCount: 720},
  Cinematic: {samplesPerLine: 320, streamlineCount: 1100},
};

const PRESET_RENDERING: Record<TorusPresetName, Pick<TorusControls, 'flowSpeed' | 'trailLength'>> = {
  'Balanced Flow': {flowSpeed: 0.075, trailLength: 0.24},
  'Closed Resonance': {flowSpeed: 0.06, trailLength: 0.32},
  'Quasi-Periodic Fill': {flowSpeed: 0.09, trailLength: 0.18},
  'Braided Knot': {flowSpeed: 0.072, trailLength: 0.28},
  'Pinched Hourglass': {flowSpeed: 0.085, trailLength: 0.22},
  'Perturbed Flow': {flowSpeed: 0.1, trailLength: 0.16},
};

const COLOR_MODE_VALUE: Record<ColorMode, number> = {
  Velocity: 0,
  Radius: 1,
  Monochrome: 2,
};

const HUD_STYLES = `
  .torus-dynamics-root {
    position: relative;
    z-index: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    isolation: isolate;
    background: #010304;
  }

  .torus-dynamics-root > .demo-viewport {
    position: absolute;
    z-index: 0;
    inset: 0;
  }

  .torus-dynamics-hud {
    position: fixed;
    z-index: 10;
    right: 16px;
    bottom: 14px;
    width: 220px;
    padding: 9px 11px;
    border-left: 1px solid rgba(116, 244, 255, 0.32);
    background: rgba(1, 8, 10, 0.7);
    color: rgba(220, 250, 252, 0.82);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.61rem;
    line-height: 1.55;
    pointer-events: none;
  }

  .torus-dynamics-hud header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
    color: #c8fbff;
    font-size: 0.67rem;
    font-weight: 760;
  }

  .torus-dynamics-hud header span:last-child {
    color: #63f2a0;
    font-weight: 600;
  }

  .torus-dynamics-metrics {
    display: grid;
    grid-template-columns: 1fr auto;
    column-gap: 12px;
  }

  .torus-dynamics-metrics span:nth-child(odd) {
    color: rgba(173, 216, 220, 0.56);
  }

  .torus-dynamics-metrics span:nth-child(even) {
    color: rgba(230, 252, 255, 0.9);
    text-align: right;
  }

  .torus-dynamics-copy-state {
    margin-top: 5px;
    color: #63f2a0;
  }

  @media (max-width: 680px) {
    .torus-dynamics-hud {
      right: 8px;
      bottom: 8px;
      width: 174px;
      font-size: 0.56rem;
    }

    .torus-dynamics-metrics span:nth-child(n + 9) {
      display: none;
    }
  }
`;

function readSharedControls(): Partial<TorusControls> {
  if (typeof window === 'undefined') return {};
  const match = window.location.hash.match(/^#torus=(.+)$/);
  if (!match) return {};
  return parseTorusState(match[1]) as Partial<TorusControls> ?? {};
}

function StreamlineField({
  absoluteTime,
  colorMode,
  data,
  flowSpeed,
  headWidth,
  opacity,
  pause,
  trailLength,
}: {
  absoluteTime?: number;
  colorMode: ColorMode;
  data: StreamlineData;
  flowSpeed: number;
  headWidth: number;
  opacity: number;
  pause: boolean;
  trailLength: number;
}) {
  const geometry = useMemo(() => createStreamlineGeometry(data), [data]);
  const material = useMemo(() => createStreamlineMaterial(), []);
  const animationTime = useRef(0);

  useFrame((_, rawDelta) => {
    if (absoluteTime === undefined && !pause) animationTime.current += Math.min(rawDelta, 0.05);
    material.uniforms.uTime.value = absoluteTime ?? animationTime.current;
    material.uniforms.uFlowSpeed.value = flowSpeed;
    material.uniforms.uTrailLength.value = trailLength;
    material.uniforms.uHeadWidth.value = headWidth;
    material.uniforms.uOpacity.value = opacity;
    material.uniforms.uColorMode.value = COLOR_MODE_VALUE[colorMode];
  });

  return <lineSegments frustumCulled={false} geometry={geometry} material={material} renderOrder={2} />;
}

export function TorusDynamicsEffect({
  absoluteFrame,
  seed = 19019,
  simulationFrame,
}: {
  absoluteFrame?: number;
  seed?: number;
  simulationFrame?: number;
}) {
  const parameters = useMemo(() => sanitizeSimulationParameters({
    ...DEFAULT_SIMULATION_PARAMETERS,
    randomSeed: seed,
    samplesPerLine: 160,
    streamlineCount: 240,
  }), [seed]);
  const data = useMemo(() => generateStreamlineData(parameters), [parameters]);
  const frame = simulationFrame ?? absoluteFrame ?? 0;
  return (
    <>
      <TorusShell
        majorRadius={parameters.majorRadius}
        minorRadius={parameters.minorRadius}
        opacity={0.3}
        visible
      />
      <StreamlineField
        absoluteTime={frame / 60}
        colorMode="Velocity"
        data={data}
        flowSpeed={DEFAULT_CONTROLS.flowSpeed}
        headWidth={DEFAULT_CONTROLS.headWidth}
        opacity={DEFAULT_CONTROLS.opacity}
        pause={false}
        trailLength={DEFAULT_CONTROLS.trailLength}
      />
    </>
  );
}

function TorusShell({
  majorRadius,
  minorRadius,
  opacity,
  visible,
}: {
  majorRadius: number;
  minorRadius: number;
  opacity: number;
  visible: boolean;
}) {
  const geometry = useMemo(() => {
    const nextGeometry = new THREE.TorusGeometry(majorRadius, minorRadius, 72, 180);
    nextGeometry.rotateX(Math.PI / 2);
    return nextGeometry;
  }, [majorRadius, minorRadius]);
  const fresnelMaterial = useMemo(() => createFresnelMaterial(opacity), []);
  useFrame(() => {
    fresnelMaterial.uniforms.uOpacity.value = opacity;
  });

  if (!visible) return null;
  return (
    <group renderOrder={1}>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color="#0b4b56"
          transparent
          opacity={opacity * 0.13}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={geometry} material={fresnelMaterial} />
    </group>
  );
}

function createFieldGlyphGeometry(parameters: TorusSimulationParameters) {
  const glyphCount = 36;
  const positions = new Float32Array(glyphCount * 2 * 3);
  for (let index = 0; index < glyphCount; index += 1) {
    const state: TorusState = {
      u: index / 12 * Math.PI * 2,
      v: index % 3 / 3 * Math.PI * 2,
      rho: parameters.minorRadius * (0.32 + index % 3 * 0.23),
    };
    const origin = torusToCartesian(state, parameters.majorRadius);
    const derivative = evaluateTorusField(state, parameters, 0);
    const velocity = torusVelocityToCartesian(state, derivative, parameters.majorRadius);
    const magnitude = Math.max(0.0001, Math.hypot(velocity.x, velocity.y, velocity.z));
    const length = 0.22;
    const offset = index * 6;
    positions[offset] = origin.x;
    positions[offset + 1] = origin.y;
    positions[offset + 2] = origin.z;
    positions[offset + 3] = origin.x + velocity.x / magnitude * length;
    positions[offset + 4] = origin.y + velocity.y / magnitude * length;
    positions[offset + 5] = origin.z + velocity.z / magnitude * length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function FieldGlyphs({parameters, visible}: {parameters: TorusSimulationParameters; visible: boolean}) {
  const geometry = useMemo(() => createFieldGlyphGeometry(parameters), [parameters]);
  if (!visible) return null;
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#62ff9b" transparent opacity={0.48} depthWrite={false} />
    </lineSegments>
  );
}

function DirectionMarker({
  mode,
  parameters,
}: {
  mode: ArrowMode;
  parameters: TorusSimulationParameters;
}) {
  const marker = useMemo(() => {
    if (mode === 'Hidden') return null;
    let origin = new THREE.Vector3(0, -parameters.minorRadius * 1.2, 0);
    let direction = new THREE.Vector3(0, 1, 0);
    let length = parameters.minorRadius * 2.4;
    if (mode === 'Local Flow') {
      const state: TorusState = {
        u: 0.38,
        v: 0.72,
        rho: parameters.minorRadius * 0.58,
      };
      const point = torusToCartesian(state, parameters.majorRadius);
      const derivative = evaluateTorusField(state, parameters, 0);
      const velocity = torusVelocityToCartesian(state, derivative, parameters.majorRadius);
      origin = new THREE.Vector3(point.x, point.y, point.z);
      direction = new THREE.Vector3(velocity.x, velocity.y, velocity.z).normalize();
      length = 0.72;
    }
    const end = origin.clone().addScaledVector(direction, length);
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction,
    );
    return {end, lineGeometry, quaternion};
  }, [mode, parameters]);

  if (!marker) return null;
  return (
    <group>
      <lineSegments geometry={marker.lineGeometry}>
        <lineBasicMaterial color="#55ff8d" transparent opacity={0.9} />
      </lineSegments>
      <mesh position={marker.end} quaternion={marker.quaternion}>
        <coneGeometry args={[0.075, 0.22, 12]} />
        <meshBasicMaterial color="#55ff8d" toneMapped={false} />
      </mesh>
    </group>
  );
}

function PerformanceProbe({onFps}: {onFps: (fps: number) => void}) {
  const elapsed = useRef(0);
  const frames = useRef(0);
  useFrame((_, delta) => {
    elapsed.current += delta;
    frames.current += 1;
    if (elapsed.current < 0.5) return;
    onFps(frames.current / elapsed.current);
    elapsed.current = 0;
    frames.current = 0;
  });
  return null;
}

function CameraInitializer() {
  const {camera} = useThree();
  useEffect(() => {
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  }, [camera]);
  return null;
}

function TorusDynamicsHud({
  computing,
  controls,
  copyNotice,
  data,
  error,
  fps,
}: {
  computing: boolean;
  controls: TorusControls;
  copyNotice: string;
  data: StreamlineData | null;
  error: string | null;
  fps: number;
}) {
  const stats = data?.stats;
  const ratio = controls.toroidalSpeed / Math.max(0.001, controls.poloidalSpeed);
  return (
    <aside className="torus-dynamics-hud" aria-live="polite">
      <header>
        <span>FLOW ATLAS</span>
        <span>{error ? 'ERROR' : computing ? 'COMPUTING' : controls.pause ? 'PAUSED' : 'LIVE'}</span>
      </header>
      <div className="torus-dynamics-metrics">
        <span>streamlines</span><span>{stats?.streamlineCount ?? controls.streamlineCount}</span>
        <span>segments</span><span>{stats?.segmentCount.toLocaleString() ?? '...'}</span>
        <span>speed avg/max</span><span>{stats ? `${stats.averageSpeed.toFixed(2)} / ${stats.maxSpeed.toFixed(2)}` : '...'}</span>
        <span>toroidal/poloidal</span><span>{ratio.toFixed(3)}</span>
        <span>closure error</span><span>{stats?.closureError.toFixed(3) ?? '...'}</span>
        <span>compute</span><span>{stats ? `${stats.computeMs.toFixed(0)} ms` : '...'}</span>
        <span>fps</span><span>{fps.toFixed(0)}</span>
      </div>
      {error ? <div className="torus-dynamics-copy-state">{error}</div> : null}
      {copyNotice ? <div className="torus-dynamics-copy-state">{copyNotice}</div> : null}
    </aside>
  );
}

export default function Demo019PaperDonutSpin() {
  const initialControls = useMemo<TorusControls>(() => ({
    ...DEFAULT_CONTROLS,
    ...readSharedControls(),
  }), []);
  const actionRef = useRef<{
    copy: () => void;
    randomize: () => void;
    reset: () => void;
  }>({
    copy: () => undefined,
    randomize: () => undefined,
    reset: () => undefined,
  });
  const [rawControls, setControls] = useControls('Toroidal Flow Atlas', () => ({
    Experiment: folder({
      preset: {
        label: 'Preset',
        options: Object.keys(TORUS_PRESETS),
        value: initialControls.preset,
      },
      qualityPreset: {
        label: 'Quality',
        options: ['Performance', 'Balanced', 'Cinematic'],
        value: initialControls.qualityPreset,
      },
      randomSeed: {label: 'Seed', value: initialControls.randomSeed, min: 1, max: 999999, step: 1},
    }),
    Dynamics: folder({
      minorRadius: {label: 'Torus Thickness', value: initialControls.minorRadius, min: 0.7, max: 1.55, step: 0.05},
      poloidalSpeed: {label: 'Poloidal Speed', value: initialControls.poloidalSpeed, min: 0.2, max: 2.8, step: 0.02},
      resonanceStrength: {label: 'Resonance', value: initialControls.resonanceStrength, min: 0, max: 0.8, step: 0.02},
      radialPinch: {label: 'Pinch', value: initialControls.radialPinch, min: 0, max: 2.8, step: 0.05},
    }, {collapsed: true}),
    Appearance: folder({
      flowSpeed: {label: 'Flow Speed', value: initialControls.flowSpeed, min: 0, max: 0.18, step: 0.005},
      trailLength: {label: 'Trail Length', value: initialControls.trailLength, min: 0.06, max: 0.55, step: 0.01},
      showShell: {label: 'Show Shell', value: initialControls.showShell},
    }, {collapsed: true}),
    View: folder({
      autoRotate: {label: 'Auto Rotate', value: initialControls.autoRotate},
      pause: {label: 'Pause', value: initialControls.pause},
    }, {collapsed: true}),
    Actions: folder({
      randomizeSeed: button(() => actionRef.current.randomize()),
      copyStateUrl: button(() => actionRef.current.copy()),
      resetDefaults: button(() => actionRef.current.reset()),
    }, {collapsed: true}),
  }));
  const selectedPreset = rawControls.preset as TorusPresetName;
  const selectedQuality = rawControls.qualityPreset as QualityPreset;
  const controls = {
    ...DEFAULT_CONTROLS,
    ...TORUS_PRESETS[selectedPreset],
    ...rawControls,
    ...QUALITY_SETTINGS[selectedQuality],
  } as unknown as TorusControls;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const previousPreset = useRef(controls.preset);
  const [copyNotice, setCopyNotice] = useState('');
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (controls.preset === previousPreset.current) return;
    previousPreset.current = controls.preset;
    const preset = TORUS_PRESETS[controls.preset];
    const rendering = PRESET_RENDERING[controls.preset];
    setControls({
      flowSpeed: rendering.flowSpeed,
      poloidalSpeed: preset.poloidalSpeed ?? DEFAULT_CONTROLS.poloidalSpeed,
      radialPinch: preset.radialPinch ?? DEFAULT_CONTROLS.radialPinch,
      resonanceStrength: preset.resonanceStrength ?? DEFAULT_CONTROLS.resonanceStrength,
      trailLength: rendering.trailLength,
    });
  }, [controls.preset, setControls]);

  useEffect(() => {
    actionRef.current = {
      randomize: () => setControls({randomSeed: Math.floor(Math.random() * 999998) + 1}),
      reset: () => {
        previousPreset.current = DEFAULT_CONTROLS.preset;
        setControls({
          autoRotate: DEFAULT_CONTROLS.autoRotate,
          flowSpeed: DEFAULT_CONTROLS.flowSpeed,
          minorRadius: DEFAULT_CONTROLS.minorRadius,
          pause: DEFAULT_CONTROLS.pause,
          poloidalSpeed: DEFAULT_CONTROLS.poloidalSpeed,
          preset: DEFAULT_CONTROLS.preset,
          qualityPreset: DEFAULT_CONTROLS.qualityPreset,
          radialPinch: DEFAULT_CONTROLS.radialPinch,
          randomSeed: DEFAULT_CONTROLS.randomSeed,
          resonanceStrength: DEFAULT_CONTROLS.resonanceStrength,
          showShell: DEFAULT_CONTROLS.showShell,
          trailLength: DEFAULT_CONTROLS.trailLength,
        });
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      },
      copy: () => {
        const serialized = serializeTorusState(controlsRef.current as unknown as Record<string, unknown>);
        const url = `${window.location.origin}${window.location.pathname}${window.location.search}#torus=${serialized}`;
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#torus=${serialized}`);
        void navigator.clipboard?.writeText(url).then(
          () => setCopyNotice('State URL copied'),
          () => setCopyNotice('State URL placed in address bar'),
        );
      },
    };
  }, [setControls]);

  useEffect(() => {
    if (!copyNotice) return;
    const timeout = window.setTimeout(() => setCopyNotice(''), 2200);
    return () => window.clearTimeout(timeout);
  }, [copyNotice]);

  const simulationParameters = useMemo(() => sanitizeSimulationParameters({
    ...DEFAULT_SIMULATION_PARAMETERS,
    ...TORUS_PRESETS[controls.preset],
    minorRadius: controls.minorRadius,
    poloidalSpeed: controls.poloidalSpeed,
    radialPinch: controls.radialPinch,
    randomSeed: controls.randomSeed,
    resonanceStrength: controls.resonanceStrength,
    ...QUALITY_SETTINGS[controls.qualityPreset],
  }), [
    controls.minorRadius,
    controls.poloidalSpeed,
    controls.radialPinch,
    controls.randomSeed,
    controls.resonanceStrength,
    controls.preset,
    controls.qualityPreset,
  ]);
  const simulation = useTorusSimulation(simulationParameters, 0);
  const handleFps = useCallback((nextFps: number) => setFps(nextFps), []);

  return (
    <div className="torus-dynamics-root">
      <style>{HUD_STYLES}</style>
      <DemoScene
        engineConfig={{
          background: '#010304',
          bloom: {
            intensity: controls.bloomStrength,
            luminanceSmoothing: 0.54,
            luminanceThreshold: 0.2,
          },
          camera: {fov: 42, far: 80, near: 0.08, position: [8.2, 5.2, 8.2]},
          vignette: {darkness: 0.5, offset: 0.24},
        }}
        orbitConfig={{
          autoRotate: controls.autoRotate && !controls.pause,
          autoRotateSpeed: controls.cameraSpeed,
          enablePan: false,
          enableZoom: true,
          maxDistance: 14,
          minDistance: 5,
        }}
      >
        <CameraInitializer />
        <TorusShell
          majorRadius={simulationParameters.majorRadius}
          minorRadius={simulationParameters.minorRadius}
          opacity={controls.shellOpacity}
          visible={controls.showShell}
        />
        {simulation.data ? (
          <StreamlineField
            colorMode={controls.colorMode}
            data={simulation.data}
            flowSpeed={controls.flowSpeed}
            headWidth={controls.headWidth}
            opacity={controls.opacity}
            pause={controls.pause}
            trailLength={controls.trailLength}
          />
        ) : null}
        <DirectionMarker mode={controls.arrowMode} parameters={simulationParameters} />
        <FieldGlyphs parameters={simulationParameters} visible={controls.showFieldGlyphs} />
        <PerformanceProbe onFps={handleFps} />
      </DemoScene>
      <TorusDynamicsHud
        computing={simulation.computing}
        controls={controls}
        copyNotice={copyNotice}
        data={simulation.data}
        error={simulation.error}
        fps={fps}
      />
    </div>
  );
}
