import {useFrame, useThree} from '@react-three/fiber';
import {button, folder, useControls} from 'leva';
import {useEffect, useMemo, useRef, useState} from 'react';
import type {MutableRefObject} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';
import {
  DoublePendulumSolver,
  TrailRingBuffer,
  type DoublePendulumParameters,
  type DoublePendulumState,
} from './doublePendulumPhysics';
import {
  createParticleGeometry,
  createRibbonGeometry,
  updateParticleGeometry,
  updateRibbonGeometry,
} from './pendulumWaveGeometry';
import {
  particleFragmentShader,
  particleVertexShader,
  ribbonFragmentShader,
  ribbonVertexShader,
} from './pendulumWaveShaders';

interface WaveControls extends DoublePendulumParameters {
  simulationSpeed: number;
  trailLength: number;
  ribbonCount: number;
  ribbonSpacing: number;
  waveAmplitude: number;
  waveFrequency: number;
  lineWidth: number;
  colorSpeed: number;
  bloomStrength: number;
  particleCount: number;
  paused: boolean;
}

interface WaveActions {
  reset: () => void;
  randomize: () => void;
  clear: () => void;
  toggleLabels: () => void;
  fullscreen: () => void;
}

const DEFAULT_CONTROLS: WaveControls = {
  simulationSpeed: 0.72,
  gravity: 9.81,
  damping: 0.018,
  length1: 1.08,
  length2: 1.16,
  mass1: 1,
  mass2: 1,
  trailLength: 600,
  ribbonCount: 30,
  ribbonSpacing: 0.026,
  waveAmplitude: 0.2,
  waveFrequency: 2.7,
  lineWidth: 0.009,
  colorSpeed: 0.055,
  bloomStrength: 0.46,
  particleCount: 18,
  paused: false,
};

const ORIGIN_X = 0;
const ORIGIN_Y = 1.38;
const FIXED_STEP = 1 / 180;
const RECORD_STEP = 1 / 60;

const rootStyles = `
  .double-pendulum-wave {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
    color: #fff;
    isolation: isolate;
  }
  .double-pendulum-wave__labels {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    transition: opacity 180ms ease;
  }
  .double-pendulum-wave__labels[aria-hidden="true"] { opacity: 0; }
  .double-pendulum-wave__title,
  .double-pendulum-wave__prompt {
    position: absolute;
    left: 50%;
    margin: 0;
    transform: translateX(-50%);
    white-space: nowrap;
    letter-spacing: 0;
    background: linear-gradient(90deg, #ff4b8b, #ffb84a, #73f59a, #53d9ff, #9776ff, #ff4b8b);
    background-size: 220% 100%;
    color: transparent;
    -webkit-background-clip: text;
    background-clip: text;
    text-shadow: 0 0 20px rgba(116, 199, 255, 0.16);
  }
  .double-pendulum-wave__title {
    top: 5.5%;
    font-size: clamp(18px, 2.25vw, 31px);
    font-weight: 620;
  }
  .double-pendulum-wave__prompt {
    top: 15%;
    font-size: clamp(10px, 1vw, 13px);
    font-weight: 520;
    opacity: 0.58;
  }
  .double-pendulum-wave__formula {
    position: absolute;
    bottom: 4.5%;
    left: 50%;
    margin: 0;
    transform: translateX(-50%);
    color: rgba(255,255,255,0.52);
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(15px, 1.55vw, 22px);
    letter-spacing: 0;
    white-space: nowrap;
    text-shadow: 0 0 15px rgba(255,255,255,0.1);
  }
  @media (max-width: 720px) {
    .double-pendulum-wave__title { top: 10%; font-size: 19px; }
    .double-pendulum-wave__prompt { top: 16%; }
    .double-pendulum-wave__formula { bottom: 6%; }
  }
`;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function seededValue(seed: number, offset: number) {
  const value = Math.sin(seed * 913.17 + offset * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function createInitialState(seed: number): DoublePendulumState {
  if (seed === 0) {
    return {theta1: 1.24, theta2: 2.08, omega1: -0.08, omega2: 0.04};
  }
  return {
    theta1: 0.92 + seededValue(seed, 1) * 0.72,
    theta2: 1.72 + seededValue(seed, 2) * 0.86,
    omega1: (seededValue(seed, 3) - 0.5) * 0.28,
    omega2: (seededValue(seed, 4) - 0.5) * 0.28,
  };
}

function updateRod(mesh: THREE.Mesh, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  mesh.position.set((ax + bx) * 0.5, (ay + by) * 0.5, 0.1);
  mesh.rotation.set(0, 0, Math.atan2(dy, dx));
  mesh.scale.set(Math.hypot(dx, dy), 0.018, 1);
}

function PendulumWaveSystem({
  controls,
  resetToken,
  clearToken,
  seed,
}: {
  controls: WaveControls;
  resetToken: number;
  clearToken: number;
  seed: number;
}) {
  const {size} = useThree();
  const solver = useMemo(() => new DoublePendulumSolver(createInitialState(seed)), []);
  const history = useMemo(() => new TrailRingBuffer(), []);
  const positions = useMemo(() => new Float64Array(4), []);
  const accumulatorRef = useRef(0);
  const recordAccumulatorRef = useRef(0);
  const simulationTimeRef = useRef(0);
  const previousClearTokenRef = useRef(clearToken);
  const ribbonGeometry = useMemo(createRibbonGeometry, []);
  const particleGeometry = useMemo(createParticleGeometry, []);
  const rodGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const nodeGeometry = useMemo(() => new THREE.CircleGeometry(0.045, 32), []);
  const originGeometry = useMemo(() => new THREE.CircleGeometry(0.034, 32), []);
  const pendulumMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.65, 1.65, 1.65),
    toneMapped: false,
  }), []);
  const ribbonMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: ribbonVertexShader,
    fragmentShader: ribbonFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false,
    uniforms: {
      uTime: {value: 0},
      uColorSpeed: {value: DEFAULT_CONTROLS.colorSpeed},
      uRibbonCount: {value: DEFAULT_CONTROLS.ribbonCount},
    },
  }), []);
  const particleMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), []);
  const rod1Ref = useRef<THREE.Mesh>(null);
  const rod2Ref = useRef<THREE.Mesh>(null);
  const jointRef = useRef<THREE.Mesh>(null);
  const endpointRef = useRef<THREE.Mesh>(null);
  const compactLayout = size.width < 720;
  const sceneScale = compactLayout ? clamp(size.width / Math.max(1, size.height) * 1.28, 0.54, 0.82) : 1;

  useEffect(() => {
    solver.reset(createInitialState(seed));
    history.clear();
    accumulatorRef.current = 0;
    recordAccumulatorRef.current = 0;
    simulationTimeRef.current = 0;
    solver.writePositions(controls, ORIGIN_X, ORIGIN_Y, positions);
    history.push(positions[0], positions[1], positions[2], positions[3], 0);
  }, [
    controls.damping,
    controls.gravity,
    controls.length1,
    controls.length2,
    controls.mass1,
    controls.mass2,
    history,
    positions,
    resetToken,
    seed,
    solver,
  ]);

  useEffect(() => {
    if (previousClearTokenRef.current === clearToken) return;
    previousClearTokenRef.current = clearToken;
    history.clear();
  }, [clearToken, history]);

  useEffect(
    () => () => {
      ribbonGeometry.dispose();
      particleGeometry.dispose();
      rodGeometry.dispose();
      nodeGeometry.dispose();
      originGeometry.dispose();
      pendulumMaterial.dispose();
      ribbonMaterial.dispose();
      particleMaterial.dispose();
    }, [
      nodeGeometry,
      originGeometry,
      particleGeometry,
      particleMaterial,
      pendulumMaterial,
      ribbonGeometry,
      ribbonMaterial,
      rodGeometry,
    ]
  );

  useFrame((_state, delta) => {
    const effectiveRibbonCount = compactLayout
      ? Math.min(18, controls.ribbonCount)
      : controls.ribbonCount;
    const effectiveParticleCount = compactLayout
      ? Math.min(12, controls.particleCount)
      : controls.particleCount;

    if (!controls.paused && !document.hidden) {
      accumulatorRef.current += Math.min(delta, 0.05) * controls.simulationSpeed;
      let stepCount = 0;
      while (accumulatorRef.current >= FIXED_STEP && stepCount < 24) {
        solver.step(FIXED_STEP, controls);
        simulationTimeRef.current += FIXED_STEP;
        recordAccumulatorRef.current += FIXED_STEP;
        accumulatorRef.current -= FIXED_STEP;
        stepCount += 1;

        if (recordAccumulatorRef.current >= RECORD_STEP) {
          recordAccumulatorRef.current -= RECORD_STEP;
          solver.writePositions(controls, ORIGIN_X, ORIGIN_Y, positions);
          history.push(
            positions[0], positions[1], positions[2], positions[3], simulationTimeRef.current,
          );
        }
      }
    }

    solver.writePositions(controls, ORIGIN_X, ORIGIN_Y, positions);
    ribbonMaterial.uniforms.uTime.value = simulationTimeRef.current;
    ribbonMaterial.uniforms.uColorSpeed.value = controls.colorSpeed;
    ribbonMaterial.uniforms.uRibbonCount.value = effectiveRibbonCount;
    updateRibbonGeometry(ribbonGeometry, history, {
      lineWidth: controls.lineWidth,
      ribbonCount: effectiveRibbonCount,
      ribbonSpacing: controls.ribbonSpacing,
      trailLength: controls.trailLength,
      waveAmplitude: controls.waveAmplitude,
      waveFrequency: controls.waveFrequency,
    }, simulationTimeRef.current);
    updateParticleGeometry(
      particleGeometry,
      history,
      effectiveParticleCount,
      controls.trailLength,
      simulationTimeRef.current,
    );

    if (rod1Ref.current) updateRod(rod1Ref.current, ORIGIN_X, ORIGIN_Y, positions[0], positions[1]);
    if (rod2Ref.current) updateRod(rod2Ref.current, positions[0], positions[1], positions[2], positions[3]);
    jointRef.current?.position.set(positions[0], positions[1], 0.12);
    endpointRef.current?.position.set(positions[2], positions[3], 0.12);
  });

  return (
    <group scale={sceneScale} position={[0, compactLayout ? -0.08 : -0.02, 0]}>
      <mesh geometry={ribbonGeometry} material={ribbonMaterial} frustumCulled={false} renderOrder={1} />
      <points geometry={particleGeometry} material={particleMaterial} frustumCulled={false} renderOrder={2} />
      <mesh ref={rod1Ref} geometry={rodGeometry} material={pendulumMaterial} renderOrder={3} />
      <mesh ref={rod2Ref} geometry={rodGeometry} material={pendulumMaterial} renderOrder={3} />
      <mesh geometry={originGeometry} material={pendulumMaterial} position={[ORIGIN_X, ORIGIN_Y, 0.12]} renderOrder={4} />
      <mesh ref={jointRef} geometry={nodeGeometry} material={pendulumMaterial} renderOrder={4} />
      <mesh ref={endpointRef} geometry={nodeGeometry} material={pendulumMaterial} renderOrder={4} />
    </group>
  );
}

function WaveScene({
  controls,
  resetToken,
  clearToken,
  seed,
}: {
  controls: WaveControls;
  resetToken: number;
  clearToken: number;
  seed: number;
}) {
  return (
    <DemoScene
      orbitControls={false}
      engineConfig={{
        background: '#000000',
        camera: {position: [0, 0, 5.65], fov: 45, near: 0.1, far: 20},
        bloom: {
          intensity: controls.bloomStrength,
          luminanceSmoothing: 0.55,
          luminanceThreshold: 0.2,
          radius: 0.42,
        },
        vignette: {darkness: 0.28, offset: 0.45},
      }}
    >
      <PendulumWaveSystem
        controls={controls}
        resetToken={resetToken}
        clearToken={clearToken}
        seed={seed}
      />
    </DemoScene>
  );
}

export default function Demo063DoublePendulumWave() {
  const rootRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<WaveActions>({
    reset: () => undefined,
    randomize: () => undefined,
    clear: () => undefined,
    toggleLabels: () => undefined,
    fullscreen: () => undefined,
  });
  const [labelsVisible, setLabelsVisible] = useState(true);
  const [resetToken, setResetToken] = useState(0);
  const [clearToken, setClearToken] = useState(0);
  const [seed, setSeed] = useState(0);
  const [rawControls, setControls] = useControls('Double Pendulum Wave', () => ({
    Simulation: folder({
      simulationSpeed: {label: 'Speed', value: DEFAULT_CONTROLS.simulationSpeed, min: 0.15, max: 1.4, step: 0.01},
      gravity: {label: 'Gravity', value: DEFAULT_CONTROLS.gravity, min: 7.5, max: 12.5, step: 0.05},
      damping: {label: 'Damping', value: DEFAULT_CONTROLS.damping, min: 0.004, max: 0.055, step: 0.001},
      length1: {label: 'Length 1', value: DEFAULT_CONTROLS.length1, min: 0.78, max: 1.32, step: 0.01},
      length2: {label: 'Length 2', value: DEFAULT_CONTROLS.length2, min: 0.82, max: 1.38, step: 0.01},
      mass1: {label: 'Mass 1', value: DEFAULT_CONTROLS.mass1, min: 0.65, max: 1.65, step: 0.05},
      mass2: {label: 'Mass 2', value: DEFAULT_CONTROLS.mass2, min: 0.65, max: 1.65, step: 0.05},
      paused: {label: 'Pause', value: DEFAULT_CONTROLS.paused},
    }),
    Ribbons: folder({
      trailLength: {label: 'Trail Length', value: DEFAULT_CONTROLS.trailLength, min: 180, max: 720, step: 10},
      ribbonCount: {label: 'Ribbon Count', value: DEFAULT_CONTROLS.ribbonCount, min: 8, max: 40, step: 1},
      ribbonSpacing: {label: 'Spacing', value: DEFAULT_CONTROLS.ribbonSpacing, min: 0.012, max: 0.045, step: 0.001},
      waveAmplitude: {label: 'Wave Amount', value: DEFAULT_CONTROLS.waveAmplitude, min: 0, max: 0.48, step: 0.01},
      waveFrequency: {label: 'Wave Frequency', value: DEFAULT_CONTROLS.waveFrequency, min: 0.8, max: 5.2, step: 0.1},
      lineWidth: {label: 'Line Width', value: DEFAULT_CONTROLS.lineWidth, min: 0.004, max: 0.018, step: 0.001},
    }, {collapsed: true}),
    Light: folder({
      colorSpeed: {label: 'Color Travel', value: DEFAULT_CONTROLS.colorSpeed, min: 0, max: 0.18, step: 0.005},
      bloomStrength: {label: 'Bloom', value: DEFAULT_CONTROLS.bloomStrength, min: 0.2, max: 1.05, step: 0.05},
      particleCount: {label: 'White Runners', value: DEFAULT_CONTROLS.particleCount, min: 0, max: 36, step: 1},
    }, {collapsed: true}),
    Actions: folder({
      reset: button(() => actionRef.current.reset()),
      randomize: button(() => actionRef.current.randomize()),
      clearTrails: button(() => actionRef.current.clear()),
      hideUI: button(() => actionRef.current.toggleLabels()),
      fullscreen: button(() => actionRef.current.fullscreen()),
    }, {collapsed: true}),
  }));
  const controls = rawControls as unknown as WaveControls;

  actionRef.current.reset = () => {
    setSeed(0);
    setResetToken((value) => value + 1);
  };
  actionRef.current.clear = () => setClearToken((value) => value + 1);
  actionRef.current.toggleLabels = () => setLabelsVisible((visible) => !visible);
  actionRef.current.fullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void rootRef.current?.requestFullscreen();
    }
  };
  actionRef.current.randomize = () => {
    setControls({
      simulationSpeed: 0.55 + Math.random() * 0.34,
      gravity: 8.6 + Math.random() * 2.4,
      damping: 0.011 + Math.random() * 0.018,
      length1: 0.94 + Math.random() * 0.25,
      length2: 0.96 + Math.random() * 0.29,
      mass1: 0.78 + Math.random() * 0.48,
      mass2: 0.78 + Math.random() * 0.48,
      ribbonCount: Math.round(24 + Math.random() * 12),
      ribbonSpacing: 0.021 + Math.random() * 0.012,
      waveAmplitude: 0.12 + Math.random() * 0.2,
      waveFrequency: 1.8 + Math.random() * 2,
    });
    setSeed(Math.random() + 0.01);
    setResetToken((value) => value + 1);
  };

  return (
    <div ref={rootRef} className="double-pendulum-wave">
      <style>{rootStyles}</style>
      <WaveScene
        controls={controls}
        resetToken={resetToken}
        clearToken={clearToken}
        seed={seed}
      />
      <div className="double-pendulum-wave__labels" aria-hidden={!labelsVisible}>
        <h1 className="double-pendulum-wave__title">Double Pendulum Wave</h1>
        <p className="double-pendulum-wave__prompt">Wait For Magic...</p>
        <p className="double-pendulum-wave__formula">T = 2π √(L/g)</p>
      </div>
    </div>
  );
}
