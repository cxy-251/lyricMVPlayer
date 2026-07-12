import {OrbitControls, PerspectiveCamera} from '@react-three/drei';
import {useFrame, useThree, type ThreeEvent} from '@react-three/fiber';
import {Pause, Play, Shuffle, StepForward, Trash2} from 'lucide-react';
import {useControls} from 'leva';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';
import {
  createGpuLifeRuntime,
  createLifeGeometry,
  disposeGpuLifeRuntime,
  editGpuLife,
  lifeFragmentShader,
  lifeVertexShader,
  resetGpuLife,
  stepGpuLife,
  type LifeResetMode,
  type LifeRule,
} from './gpuLife';

const BOARD_SIZE = 7.8;
const DEFAULT_RESET = {mode: 'random' as const, seed: 1, token: 0};

export type LifeStats = {
  generation: number;
  population: number;
  species: number;
};

type LifeResetRequest = {
  mode: LifeResetMode;
  seed: number;
  token: number;
};

type BrushPoint = {
  brush: THREE.Vector4;
  species: number;
};

type ThreeLifeEffectProps = {
  absoluteFrame?: number;
  brushSize?: number;
  cellHeight?: number;
  gridSize?: number;
  initialDensity?: number;
  mutation?: number;
  onStats?: (stats: LifeStats) => void;
  palette?: number;
  paused?: boolean;
  resetRequest?: LifeResetRequest;
  rule?: LifeRule;
  seed?: number;
  simulationFrame?: number;
  speed?: number;
  stepToken?: number;
  trailDecay?: number;
};

const clampGridSize = (value: number) => {
  const allowed = [64, 96, 128, 160];
  return allowed.reduce((closest, candidate) =>
    Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest, allowed[0]!);
};

const createLifeMaterial = ({cellHeight, gridSize, palette}: {
  cellHeight: number;
  gridSize: number;
  palette: number;
}) => new THREE.ShaderMaterial({
  fragmentShader: lifeFragmentShader,
  uniforms: {
    uCellSize: {value: BOARD_SIZE / gridSize},
    uHeight: {value: cellHeight},
    uPalette: {value: palette},
    uState: {value: null},
  },
  vertexShader: lifeVertexShader,
});

export function ThreeLifeEffect({
  absoluteFrame,
  brushSize = 2,
  cellHeight = 0.11,
  gridSize = 96,
  initialDensity = 0.24,
  mutation = 0.06,
  onStats,
  palette = 0,
  paused = false,
  resetRequest = DEFAULT_RESET,
  rule = 'conway',
  seed = 1,
  simulationFrame,
  speed = 12,
  stepToken = 0,
  trailDecay = 0.92,
}: ThreeLifeEffectProps) {
  const {gl} = useThree();
  const resolvedGridSize = clampGridSize(gridSize);
  const runtime = useMemo(() => createGpuLifeRuntime(resolvedGridSize), [resolvedGridSize]);
  const geometry = useMemo(() => createLifeGeometry({boardSize: BOARD_SIZE, gridSize: resolvedGridSize}), [resolvedGridSize]);
  const material = useMemo(() => createLifeMaterial({cellHeight, gridSize: resolvedGridSize, palette}), [resolvedGridSize]);
  const accumulatorRef = useRef(0);
  const brushQueueRef = useRef<BrushPoint[]>([]);
  const dragPointerRef = useRef<number | null>(null);
  const dragPreviousUvRef = useRef<THREE.Vector2 | null>(null);
  const lastResetKeyRef = useRef('');
  const lastStepTokenRef = useRef(stepToken);
  const statsBufferRef = useRef(new Uint8Array(resolvedGridSize * resolvedGridSize * 4));
  const statsClockRef = useRef(0);
  const statsCallbackRef = useRef(onStats);
  statsCallbackRef.current = onStats;

  useEffect(() => {
    const resetKey = `${resolvedGridSize}:${resetRequest.token}`;
    if (lastResetKeyRef.current === resetKey) return;
    resetGpuLife({
      density: THREE.MathUtils.clamp(initialDensity, 0.05, 0.5),
      mode: resetRequest.mode,
      renderer: gl,
      runtime,
      seed: resetRequest.seed,
    });
    accumulatorRef.current = 0;
    brushQueueRef.current = [];
    lastResetKeyRef.current = resetKey;
    statsBufferRef.current = new Uint8Array(resolvedGridSize * resolvedGridSize * 4);
    statsCallbackRef.current?.({generation: 0, population: 0, species: 0});
  }, [gl, initialDensity, resetRequest, resolvedGridSize, runtime]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
    disposeGpuLifeRuntime(runtime);
    document.body.style.cursor = '';
  }, [geometry, material, runtime]);

  useFrame((_state, delta) => {
    const maxBrushPasses = Math.min(24, brushQueueRef.current.length);
    for (let index = 0; index < maxBrushPasses; index += 1) {
      const point = brushQueueRef.current.shift();
      if (!point) break;
      editGpuLife({brush: point.brush, renderer: gl, runtime, species: point.species});
    }

    const resolvedSpeed = THREE.MathUtils.clamp(speed, 1, 30);
    const timelineFrame = simulationFrame ?? absoluteFrame;
    let stepsToRun = 0;
    if (timelineFrame !== undefined) {
      const targetGeneration = Math.max(0, Math.floor((timelineFrame / 60) * resolvedSpeed));
      stepsToRun = Math.max(0, Math.min(48, targetGeneration - runtime.generation));
    } else if (!paused) {
      accumulatorRef.current += Math.min(delta, 0.1) * resolvedSpeed;
      stepsToRun = Math.min(12, Math.floor(accumulatorRef.current));
      accumulatorRef.current -= stepsToRun;
    }
    if (stepToken !== lastStepTokenRef.current) {
      lastStepTokenRef.current = stepToken;
      stepsToRun = Math.max(1, stepsToRun);
    }

    for (let index = 0; index < stepsToRun; index += 1) {
      stepGpuLife({
        mutation: THREE.MathUtils.clamp(mutation, 0, 0.2),
        renderer: gl,
        rule,
        runtime,
        seed,
        trailDecay: THREE.MathUtils.clamp(trailDecay, 0.72, 0.99),
      });
    }

    material.uniforms.uHeight.value = THREE.MathUtils.clamp(cellHeight, 0.03, 0.32);
    material.uniforms.uPalette.value = palette;
    material.uniforms.uState.value = runtime.targets[runtime.currentTarget].texture;

    statsClockRef.current += delta;
    if (statsClockRef.current >= 0.45) {
      statsClockRef.current = 0;
      const pixels = statsBufferRef.current;
      gl.readRenderTargetPixels(
        runtime.targets[runtime.currentTarget],
        0,
        0,
        resolvedGridSize,
        resolvedGridSize,
        pixels,
      );
      let population = 0;
      const speciesBins = [0, 0, 0, 0];
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset]! < 128) continue;
        population += 1;
        const speciesIndex = Math.min(3, Math.floor((pixels[offset + 1]! / 256) * 4));
        speciesBins[speciesIndex] += 1;
      }
      const speciesFloor = Math.max(3, population * 0.025);
      statsCallbackRef.current?.({
        generation: runtime.generation,
        population,
        species: speciesBins.filter((count) => count >= speciesFloor).length,
      });
    }
  });

  const queueBrushPoint = useCallback((event: ThreeEvent<PointerEvent>, draw: boolean) => {
    const uv = event.uv;
    if (!uv) return;
    const previous = dragPreviousUvRef.current ?? uv;
    const distanceInCells = previous.distanceTo(uv) * resolvedGridSize;
    const samples = Math.max(1, Math.ceil(distanceInCells / Math.max(1, brushSize * 0.45)));
    for (let sample = 1; sample <= samples; sample += 1) {
      const progress = sample / samples;
      const point = previous.clone().lerp(uv, progress);
      const species = (seed * 0.173 + point.x * 0.47 + point.y * 0.83 + runtime.generation * 0.002) % 1;
      brushQueueRef.current.push({
        brush: new THREE.Vector4(
          point.x,
          point.y,
          THREE.MathUtils.clamp(brushSize, 1, 9) / resolvedGridSize,
          draw ? 1 : 0,
        ),
        species,
      });
    }
    dragPreviousUvRef.current = uv.clone();
  }, [brushSize, resolvedGridSize, runtime, seed]);

  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0 && event.button !== 2) return;
    event.stopPropagation();
    dragPointerRef.current = event.pointerId;
    dragPreviousUvRef.current = null;
    (event.target as Element | null)?.setPointerCapture(event.pointerId);
    queueBrushPoint(event, event.button !== 2);
  }, [queueBrushPoint]);

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (dragPointerRef.current !== event.pointerId) return;
    const draw = (event.buttons & 2) === 0;
    queueBrushPoint(event, draw);
  }, [queueBrushPoint]);

  const handlePointerUp = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (dragPointerRef.current !== event.pointerId) return;
    dragPointerRef.current = null;
    dragPreviousUvRef.current = null;
    (event.target as Element | null)?.releasePointerCapture(event.pointerId);
  }, []);

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight intensity={1.2} position={[-4, -2, 8]} />
      <mesh geometry={geometry} material={material} />
      <mesh position={[0, 0, -0.055]}>
        <planeGeometry args={[BOARD_SIZE + 0.12, BOARD_SIZE + 0.12]} />
        <meshStandardMaterial color="#0b1019" metalness={0.42} roughness={0.54} />
      </mesh>
      <mesh position={[0, 0, -0.075]}>
        <planeGeometry args={[BOARD_SIZE + 0.24, BOARD_SIZE + 0.24]} />
        <meshStandardMaterial color="#203346" metalness={0.5} roughness={0.46} />
      </mesh>
      <mesh
        onContextMenu={(event) => event.nativeEvent.preventDefault()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'crosshair';
        }}
        onPointerUp={handlePointerUp}
        position={[0, 0, Math.max(0.05, cellHeight + 0.02)]}
      >
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshBasicMaterial depthWrite={false} opacity={0} transparent />
      </mesh>
      <PerspectiveCamera
        far={50}
        fov={42}
        makeDefault
        near={0.1}
        position={[0, -9.2, 10.6]}
        up={[0, 0, 1]}
      />
      <OrbitControls
        dampingFactor={0.08}
        enableDamping
        enablePan={false}
        makeDefault
        maxDistance={18}
        maxPolarAngle={1.28}
        minDistance={6.5}
        minPolarAngle={0.28}
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.ROTATE,
          RIGHT: THREE.MOUSE.PAN,
        }}
        target={[0, 0, 0]}
      />
    </>
  );
}

const LIFE_STYLES = `
  .life-lab {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    background: #060910;
  }

  .life-hud {
    position: fixed;
    z-index: 12;
    top: 64px;
    left: 50%;
    width: min(560px, calc(100vw - 132px));
    transform: translateX(-50%);
    padding: 11px 13px 10px;
    border: 1px solid rgba(145, 188, 214, 0.2);
    border-radius: 6px;
    background: rgba(8, 13, 22, 0.9);
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.3);
    color: #eef7fb;
    backdrop-filter: blur(12px);
  }

  .life-hud__row,
  .life-hud__stats,
  .life-hud__actions {
    display: flex;
    align-items: center;
  }

  .life-hud__row {
    justify-content: space-between;
    gap: 14px;
  }

  .life-hud__title strong {
    display: block;
    font-size: 0.88rem;
    font-weight: 760;
    line-height: 1.15;
  }

  .life-hud__mode {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 4px;
    color: #91aab8;
    font-size: 0.66rem;
    font-weight: 700;
  }

  .life-hud__mode::before {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #55e4c0;
    box-shadow: 0 0 10px rgba(85, 228, 192, 0.56);
    content: '';
  }

  .life-hud[data-paused='true'] .life-hud__mode::before {
    background: #ffc55f;
    box-shadow: 0 0 10px rgba(255, 197, 95, 0.46);
  }

  .life-hud__actions {
    gap: 6px;
  }

  .life-hud__action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 31px;
    height: 31px;
    border: 1px solid rgba(174, 207, 222, 0.18);
    border-radius: 5px;
    background: #131b26;
    color: #cee0e8;
    cursor: pointer;
  }

  .life-hud__action:hover {
    border-color: rgba(85, 228, 192, 0.5);
    color: #ffffff;
  }

  .life-hud__action:focus-visible {
    outline: 2px solid #55e4c0;
    outline-offset: 2px;
  }

  .life-hud__divider {
    width: 1px;
    height: 21px;
    margin: 0 2px;
    background: rgba(184, 212, 224, 0.14);
  }

  .life-hud__stats {
    justify-content: space-between;
    gap: 16px;
    margin-top: 9px;
    padding-top: 8px;
    border-top: 1px solid rgba(174, 207, 222, 0.12);
    color: #7f96a3;
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
  }

  .life-hud__stats strong {
    color: #d9eaf0;
    font-weight: 720;
  }

  @media (max-width: 650px) {
    .life-hud {
      top: 70px;
      width: min(540px, calc(100vw - 28px));
    }

    .life-hud__stats {
      gap: 9px;
      font-size: 0.62rem;
    }
  }
`;

export default function Demo023PaperThreeLife() {
  const controls = useControls('Evolution Life', {
    rule: {label: 'Rule Set', options: {Conway: 'conway', HighLife: 'highlife', Seeds: 'seeds'}, value: 'conway'},
    gridSize: {label: 'Grid Size', options: {Compact: 64, Standard: 96, Dense: 128, Ultra: 160}, value: 96},
    speed: {label: 'Generations / s', max: 30, min: 1, step: 1, value: 12},
    initialDensity: {label: 'Initial Density', max: 0.42, min: 0.08, step: 0.01, value: 0.24},
    mutation: {label: 'Mutation', max: 0.18, min: 0, step: 0.005, value: 0.06},
    brushSize: {label: 'Brush Size', max: 9, min: 1, step: 1, value: 2},
    cellHeight: {label: 'Cell Height', max: 0.32, min: 0.03, step: 0.01, value: 0.11},
    trailDecay: {label: 'Afterglow', max: 0.985, min: 0.72, step: 0.005, value: 0.92},
    palette: {label: 'Species Palette', options: {Spectrum: 0, Ocean: 1, Bioelectric: 2}, value: 0},
  });
  const [paused, setPaused] = useState(false);
  const [runSeed, setRunSeed] = useState(1);
  const [resetRequest, setResetRequest] = useState<LifeResetRequest>(DEFAULT_RESET);
  const [stats, setStats] = useState<LifeStats>({generation: 0, population: 0, species: 0});
  const [stepToken, setStepToken] = useState(0);

  const requestReset = useCallback((mode: LifeResetMode) => {
    const nextSeed = mode === 'random' ? runSeed + 1 : runSeed;
    if (mode === 'random') setRunSeed(nextSeed);
    setResetRequest((request) => ({mode, seed: nextSeed, token: request.token + 1}));
  }, [runSeed]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        setPaused((value) => !value);
      } else if (event.key.toLowerCase() === 'r') {
        requestReset('random');
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        requestReset('clear');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [requestReset]);

  const gridSize = clampGridSize(controls.gridSize);
  const rule = controls.rule as LifeRule;

  return (
    <div className="life-lab">
      <style>{LIFE_STYLES}</style>
      <div className="life-hud" data-paused={paused}>
        <div className="life-hud__row">
          <div className="life-hud__title">
            <strong>Evolution Life Lab</strong>
            <span className="life-hud__mode">{paused ? 'PAUSED' : rule.toUpperCase()}</span>
          </div>
          <div className="life-hud__actions">
            <button
              aria-label={paused ? 'Resume simulation' : 'Pause simulation'}
              className="life-hud__action"
              onClick={() => setPaused((value) => !value)}
              title={paused ? 'Resume simulation' : 'Pause simulation'}
              type="button"
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
            <button
              aria-label="Advance one generation"
              className="life-hud__action"
              onClick={() => {
                setPaused(true);
                setStepToken((value) => value + 1);
              }}
              title="Advance one generation"
              type="button"
            >
              <StepForward size={15} />
            </button>
            <span className="life-hud__divider" />
            <button
              aria-label="Randomize world"
              className="life-hud__action"
              onClick={() => requestReset('random')}
              title="Randomize world"
              type="button"
            >
              <Shuffle size={15} />
            </button>
            <button
              aria-label="Clear world"
              className="life-hud__action"
              onClick={() => requestReset('clear')}
              title="Clear world"
              type="button"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
        <div className="life-hud__stats">
          <span>Grid <strong>{gridSize}x{gridSize}</strong></span>
          <span>Generation <strong>{stats.generation}</strong></span>
          <span>Population <strong>{stats.population}</strong></span>
          <span>Species <strong>{stats.species}</strong></span>
        </div>
      </div>

      <DemoScene
        engineConfig={{
          background: '#060910',
          bloom: {intensity: 0.08, luminanceSmoothing: 0.42, luminanceThreshold: 0.82},
          vignette: {darkness: 0.35, offset: 0.32},
        }}
        orbitControls={false}
      >
        <ThreeLifeEffect
          brushSize={THREE.MathUtils.clamp(controls.brushSize, 1, 9)}
          cellHeight={THREE.MathUtils.clamp(controls.cellHeight, 0.03, 0.32)}
          gridSize={gridSize}
          initialDensity={THREE.MathUtils.clamp(controls.initialDensity, 0.08, 0.42)}
          mutation={THREE.MathUtils.clamp(controls.mutation, 0, 0.18)}
          onStats={setStats}
          palette={THREE.MathUtils.clamp(controls.palette, 0, 2)}
          paused={paused}
          resetRequest={resetRequest}
          rule={rule}
          seed={runSeed}
          speed={THREE.MathUtils.clamp(controls.speed, 1, 30)}
          stepToken={stepToken}
          trailDecay={THREE.MathUtils.clamp(controls.trailDecay, 0.72, 0.985)}
        />
      </DemoScene>
    </div>
  );
}
