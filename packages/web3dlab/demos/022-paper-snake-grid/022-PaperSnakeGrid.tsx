import {OrthographicCamera} from '@react-three/drei';
import {useFrame, useThree, type ThreeEvent} from '@react-three/fiber';
import {Pause, Play, RefreshCcw} from 'lucide-react';
import {useControls} from 'leva';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';
import {
  cycleSnakeBoardCell,
  getSnakeSnapshot,
  type SnakeRouteMode,
  type SnakeSnapshot,
} from './snakeSimulation';

const MAX_INSTANCES = 1024;

type SnakeGridEffectProps = {
  absoluteFrame?: number;
  boardSize?: number;
  movesPerSecond?: number;
  onSnapshot?: (snapshot: SnakeSnapshot) => void;
  paused?: boolean;
  seed?: number;
  simulationFrame?: number;
};

const clampBoardSize = (value: number) => {
  const clamped = THREE.MathUtils.clamp(Math.round(value), 10, 24);
  return clamped % 2 === 0 ? clamped : clamped + 1;
};

const MODE_LABELS: Record<SnakeRouteMode, string> = {
  complete: 'BOARD CLEARED',
  'cycle-guard': 'CYCLE GUARD',
  'safe-detour': 'SAFE DETOUR',
  'safe-shortcut': 'SAFE SHORTEST',
  'tail-guard': 'TAIL GUARD',
};

type BoardMetrics = {
  boardExtent: number;
  cellSize: number;
  originX: number;
  originY: number;
};

const getBoardMetrics = (
  width: number,
  height: number,
  boardSize: number,
): BoardMetrics => {
  const availableWidth = Math.max(220, width - 44);
  const availableHeight = Math.max(220, height - 158);
  const boardExtent = Math.min(availableWidth, availableHeight, 860);
  return {
    boardExtent,
    cellSize: boardExtent / boardSize,
    originX: (width - boardExtent) / 2,
    originY: Math.max(18, (height - boardExtent) / 2 - 22),
  };
};

const SNAKE_DEMO_STYLES = `
  .snake-demo {
    position: relative;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    background: #080b10;
  }

  .snake-hud {
    position: fixed;
    z-index: 12;
    top: 22px;
    left: 50%;
    width: min(390px, calc(100vw - 124px));
    transform: translateX(-50%);
    padding: 12px 14px;
    border: 1px solid rgba(195, 215, 207, 0.18);
    border-radius: 6px;
    background: rgba(10, 14, 20, 0.88);
    color: #f3f7f5;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24);
    backdrop-filter: blur(12px);
    pointer-events: auto;
  }

  .snake-hud__top,
  .snake-hud__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .snake-hud__title {
    min-width: 0;
  }

  .snake-hud__title strong {
    display: block;
    overflow: hidden;
    color: #f4faf7;
    font-size: 0.86rem;
    font-weight: 760;
    line-height: 1.2;
    letter-spacing: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .snake-hud__mode {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 4px;
    color: #9eb0aa;
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0;
  }

  .snake-hud__dot {
    width: 7px;
    height: 7px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: #48d79c;
    box-shadow: 0 0 10px rgba(72, 215, 156, 0.55);
  }

  .snake-hud[data-complete='true'] .snake-hud__dot {
    background: #ffcc62;
    box-shadow: 0 0 10px rgba(255, 204, 98, 0.5);
  }

  .snake-hud__actions {
    display: flex;
    gap: 7px;
  }

  .snake-hud__action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
    border: 1px solid rgba(205, 224, 217, 0.2);
    border-radius: 5px;
    background: #151c23;
    color: #dbe8e3;
    cursor: pointer;
  }

  .snake-hud__action:hover {
    border-color: rgba(72, 215, 156, 0.5);
    color: #ffffff;
  }

  .snake-hud__action:focus-visible {
    outline: 2px solid #48d79c;
    outline-offset: 2px;
  }

  .snake-hud__action:disabled {
    opacity: 0.38;
    cursor: default;
  }

  .snake-hud__progress {
    height: 4px;
    margin: 11px 0 8px;
    overflow: hidden;
    border-radius: 2px;
    background: #222b32;
  }

  .snake-hud__progress > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #48d79c;
    transition: width 180ms ease;
  }

  .snake-hud[data-complete='true'] .snake-hud__progress > span {
    background: #ffcc62;
  }

  .snake-hud__meta {
    color: #899a94;
    font-size: 0.69rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
  }

  .snake-hud__meta strong {
    color: #d9e5e0;
    font-weight: 720;
  }

  @media (max-width: 620px) {
    .snake-hud {
      top: 70px;
      width: min(360px, calc(100vw - 28px));
    }
  }
`;

const createRoundedSquareGeometry = () => {
  const shape = new THREE.Shape();
  const radius = 0.18;
  const low = -0.5;
  const high = 0.5;
  shape.moveTo(low + radius, low);
  shape.lineTo(high - radius, low);
  shape.quadraticCurveTo(high, low, high, low + radius);
  shape.lineTo(high, high - radius);
  shape.quadraticCurveTo(high, high, high - radius, high);
  shape.lineTo(low + radius, high);
  shape.quadraticCurveTo(low, high, low, high - radius);
  shape.lineTo(low, low + radius);
  shape.quadraticCurveTo(low, low, low + radius, low);
  return new THREE.ShapeGeometry(shape, 4);
};

const createSurfaceMaterial = ({
  color,
  emissive,
  emissiveIntensity,
  metalness,
  roughness,
}: {
  color: THREE.ColorRepresentation;
  emissive: THREE.ColorRepresentation;
  emissiveIntensity: number;
  metalness: number;
  roughness: number;
}) => new THREE.MeshStandardMaterial({
  color,
  emissive,
  emissiveIntensity,
  metalness,
  roughness,
});

const createInstancedLayer = ({
  geometry,
  material,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}) => {
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
};

export function SnakeGridEffect({
  absoluteFrame,
  boardSize = 16,
  movesPerSecond = 8,
  onSnapshot,
  paused = false,
  seed = 1,
  simulationFrame,
}: SnakeGridEffectProps) {
  const {scene, size} = useThree();
  const helper = useMemo(() => new THREE.Object3D(), []);
  const accumulatedStepsRef = useRef(0);
  const dragPointerRef = useRef<number | null>(null);
  const dragPreviousCellRef = useRef<{x: number; y: number} | null>(null);
  const dragVisitedCellsRef = useRef(new Set<string>());
  const lastPublishedStepRef = useRef(-1);
  const snapshotCallbackRef = useRef(onSnapshot);
  snapshotCallbackRef.current = onSnapshot;

  const meshes = useMemo(() => {
    const gridGeometry = new THREE.PlaneGeometry(1, 1);
    const markerGeometry = new THREE.CircleGeometry(0.5, 24);
    const roundedGeometry = createRoundedSquareGeometry();
    const layers = {
      background: createInstancedLayer({
        geometry: gridGeometry,
        material: new THREE.MeshBasicMaterial({color: '#151b23', opacity: 0.72, transparent: true}),
      }),
      bodyA: createInstancedLayer({
        geometry: roundedGeometry,
        material: createSurfaceMaterial({color: '#19bca5', emissive: '#063f3a', emissiveIntensity: 0.2, metalness: 0.16, roughness: 0.42}),
      }),
      bodyB: createInstancedLayer({
        geometry: roundedGeometry,
        material: createSurfaceMaterial({color: '#286fce', emissive: '#0b2856', emissiveIntensity: 0.18, metalness: 0.18, roughness: 0.44}),
      }),
      bodyC: createInstancedLayer({
        geometry: roundedGeometry,
        material: createSurfaceMaterial({color: '#7651c9', emissive: '#2b195e', emissiveIntensity: 0.18, metalness: 0.18, roughness: 0.46}),
      }),
      food: createInstancedLayer({
        geometry: roundedGeometry,
        material: createSurfaceMaterial({color: '#e83279', emissive: '#7f0b3d', emissiveIntensity: 0.38, metalness: 0.08, roughness: 0.36}),
      }),
      foodCore: createInstancedLayer({
        geometry: roundedGeometry,
        material: createSurfaceMaterial({color: '#ff9fc7', emissive: '#c92769', emissiveIntensity: 0.45, metalness: 0.04, roughness: 0.34}),
      }),
      head: createInstancedLayer({
        geometry: markerGeometry,
        material: createSurfaceMaterial({color: '#caff45', emissive: '#527800', emissiveIntensity: 0.42, metalness: 0.08, roughness: 0.32}),
      }),
      headCore: createInstancedLayer({
        geometry: markerGeometry,
        material: createSurfaceMaterial({color: '#18331e', emissive: '#07170d', emissiveIntensity: 0.08, metalness: 0.02, roughness: 0.62}),
      }),
      tail: createInstancedLayer({
        geometry: markerGeometry,
        material: createSurfaceMaterial({color: '#8bd8ff', emissive: '#18577a', emissiveIntensity: 0.25, metalness: 0.08, roughness: 0.38}),
      }),
      obstacle: createInstancedLayer({
        geometry: roundedGeometry,
        material: createSurfaceMaterial({color: '#d88732', emissive: '#6b2d08', emissiveIntensity: 0.24, metalness: 0.3, roughness: 0.48}),
      }),
      overlap: createInstancedLayer({
        geometry: roundedGeometry,
        material: createSurfaceMaterial({color: '#f02c48', emissive: '#8d071c', emissiveIntensity: 0.5, metalness: 0.05, roughness: 0.36}),
      }),
      wall: createInstancedLayer({
        geometry: gridGeometry,
        material: new THREE.MeshBasicMaterial({color: '#527080'}),
      }),
    };

    Object.values(layers).forEach((mesh) => scene.add(mesh));
    return {gridGeometry, markerGeometry, roundedGeometry, ...layers};
  }, [scene]);

  useEffect(() => {
    accumulatedStepsRef.current = 0;
    lastPublishedStepRef.current = -1;
  }, [boardSize, seed]);

  useEffect(() => () => {
    document.body.style.cursor = '';
  }, []);

  useEffect(() => () => {
    Object.entries(meshes).forEach(([key, value]) => {
      if (key === 'gridGeometry' || key === 'markerGeometry' || key === 'roundedGeometry') return;
      const mesh = value as THREE.InstancedMesh;
      scene.remove(mesh);
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    });
    meshes.gridGeometry.dispose();
    meshes.markerGeometry.dispose();
    meshes.roundedGeometry.dispose();
  }, [meshes, scene]);

  useFrame((_frameState, delta) => {
    const resolvedBoardSize = clampBoardSize(boardSize);
    const timelineFrame = simulationFrame ?? absoluteFrame;
    if (timelineFrame === undefined && !paused) {
      accumulatedStepsRef.current += Math.min(delta, 0.1) * THREE.MathUtils.clamp(movesPerSecond, 1, 18);
    }
    const step = timelineFrame !== undefined
      ? Math.floor((timelineFrame / 60) * THREE.MathUtils.clamp(movesPerSecond, 1, 18))
      : Math.floor(accumulatedStepsRef.current);
    const snapshot = getSnakeSnapshot({frame: step, seed, size: resolvedBoardSize});

    if (snapshot.steps !== lastPublishedStepRef.current) {
      lastPublishedStepRef.current = snapshot.steps;
      snapshotCallbackRef.current?.(snapshot);
    }

    const {boardExtent, cellSize, originX, originY} = getBoardMetrics(
      size.width,
      size.height,
      resolvedBoardSize,
    );
    const backgroundScale = Math.max(2, cellSize * 0.94);
    const bodyScale = Math.max(2, cellSize * 0.72);
    const headScale = Math.max(3, cellSize * 0.86);
    const tailScale = Math.max(2, cellSize * 0.54);

    const setCellMatrix = (
      mesh: THREE.InstancedMesh,
      index: number,
      x: number,
      y: number,
      scale: number,
      z: number,
    ) => {
      helper.position.set(
        originX + (x + 0.5) * cellSize,
        originY + boardExtent - (y + 0.5) * cellSize,
        z,
      );
      helper.scale.set(scale, scale, 1);
      helper.updateMatrix();
      mesh.setMatrixAt(index, helper.matrix);
    };

    const setRectMatrix = (
      mesh: THREE.InstancedMesh,
      index: number,
      x: number,
      y: number,
      width: number,
      height: number,
      z: number,
    ) => {
      helper.position.set(x, y, z);
      helper.scale.set(width, height, 1);
      helper.updateMatrix();
      mesh.setMatrixAt(index, helper.matrix);
    };

    let backgroundCount = 0;
    for (let y = 0; y < resolvedBoardSize; y += 1) {
      for (let x = 0; x < resolvedBoardSize; x += 1) {
        setCellMatrix(meshes.background, backgroundCount, x, y, backgroundScale, 0);
        backgroundCount += 1;
      }
    }

    let bodyACount = 0;
    let bodyBCount = 0;
    let bodyCCount = 0;
    let foodCount = 0;
    let headCount = 0;
    let obstacleCount = 0;
    let overlapCount = 0;
    let tailCount = 0;
    snapshot.cells.forEach((cell) => {
      if (cell.tone === 'head') {
        setCellMatrix(meshes.head, headCount, cell.x, cell.y, headScale, 3);
        setCellMatrix(meshes.headCore, headCount, cell.x, cell.y, headScale * 0.3, 4);
        headCount += 1;
      } else if (cell.tone === 'body-a') {
        setCellMatrix(meshes.bodyA, bodyACount, cell.x, cell.y, bodyScale, 2);
        bodyACount += 1;
      } else if (cell.tone === 'body-b') {
        setCellMatrix(meshes.bodyB, bodyBCount, cell.x, cell.y, bodyScale, 2);
        bodyBCount += 1;
      } else if (cell.tone === 'body-c') {
        setCellMatrix(meshes.bodyC, bodyCCount, cell.x, cell.y, bodyScale, 2);
        bodyCCount += 1;
      } else if (cell.tone === 'food') {
        setCellMatrix(meshes.food, foodCount, cell.x, cell.y, cellSize * 0.62, 2);
        setCellMatrix(meshes.foodCore, foodCount, cell.x, cell.y, cellSize * 0.24, 3);
        foodCount += 1;
      } else if (cell.tone === 'obstacle') {
        setCellMatrix(meshes.obstacle, obstacleCount, cell.x, cell.y, cellSize * 0.78, 2);
        obstacleCount += 1;
      } else if (cell.tone === 'tail') {
        setCellMatrix(meshes.tail, tailCount, cell.x, cell.y, tailScale, 3);
        tailCount += 1;
      } else {
        setCellMatrix(meshes.overlap, overlapCount, cell.x, cell.y, headScale, 4);
        overlapCount += 1;
      }
    });

    const wallThickness = Math.max(2, cellSize * 0.1);
    const wallOffset = wallThickness * 0.7;
    setRectMatrix(meshes.wall, 0, originX + boardExtent / 2, originY - wallOffset, boardExtent + wallThickness * 2, wallThickness, 1);
    setRectMatrix(meshes.wall, 1, originX + boardExtent / 2, originY + boardExtent + wallOffset, boardExtent + wallThickness * 2, wallThickness, 1);
    setRectMatrix(meshes.wall, 2, originX - wallOffset, originY + boardExtent / 2, wallThickness, boardExtent, 1);
    setRectMatrix(meshes.wall, 3, originX + boardExtent + wallOffset, originY + boardExtent / 2, wallThickness, boardExtent, 1);

    meshes.background.count = backgroundCount;
    meshes.bodyA.count = bodyACount;
    meshes.bodyB.count = bodyBCount;
    meshes.bodyC.count = bodyCCount;
    meshes.food.count = foodCount;
    meshes.foodCore.count = foodCount;
    meshes.head.count = headCount;
    meshes.headCore.count = headCount;
    meshes.obstacle.count = obstacleCount;
    meshes.overlap.count = overlapCount;
    meshes.tail.count = tailCount;
    meshes.wall.count = 4;
    [meshes.background, meshes.bodyA, meshes.bodyB, meshes.bodyC, meshes.food, meshes.foodCore, meshes.head, meshes.headCore, meshes.obstacle, meshes.overlap, meshes.tail, meshes.wall]
      .forEach((mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
      });
  });

  const resolvedBoardSize = clampBoardSize(boardSize);
  const pointerMetrics = getBoardMetrics(size.width, size.height, resolvedBoardSize);
  const cycleBoardCellAtPointer = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const x = Math.floor((event.point.x - pointerMetrics.originX) / pointerMetrics.cellSize);
    const y = Math.floor(
      (pointerMetrics.originY + pointerMetrics.boardExtent - event.point.y) / pointerMetrics.cellSize,
    );
    const previous = dragPreviousCellRef.current ?? {x, y};
    const steps = Math.max(Math.abs(x - previous.x), Math.abs(y - previous.y), 1);
    for (let step = 0; step <= steps; step += 1) {
      const cellX = Math.round(previous.x + ((x - previous.x) * step) / steps);
      const cellY = Math.round(previous.y + ((y - previous.y) * step) / steps);
      const cellKey = `${cellX},${cellY}`;
      if (dragVisitedCellsRef.current.has(cellKey)) continue;
      dragVisitedCellsRef.current.add(cellKey);
      if (cycleSnakeBoardCell({seed, size: resolvedBoardSize, x: cellX, y: cellY})) {
        lastPublishedStepRef.current = -1;
      }
    }
    dragPreviousCellRef.current = {x, y};
  }, [pointerMetrics, resolvedBoardSize, seed]);

  const handleBoardPointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;
    dragPointerRef.current = event.pointerId;
    dragPreviousCellRef.current = null;
    dragVisitedCellsRef.current.clear();
    (event.target as Element | null)?.setPointerCapture(event.pointerId);
    cycleBoardCellAtPointer(event);
  }, [cycleBoardCellAtPointer]);

  const handleBoardPointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (dragPointerRef.current !== event.pointerId || (event.buttons & 1) === 0) return;
    cycleBoardCellAtPointer(event);
  }, [cycleBoardCellAtPointer]);

  const handleBoardPointerUp = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (dragPointerRef.current !== event.pointerId) return;
    event.stopPropagation();
    dragPointerRef.current = null;
    dragPreviousCellRef.current = null;
    dragVisitedCellsRef.current.clear();
    (event.target as Element | null)?.releasePointerCapture(event.pointerId);
  }, []);

  return (
    <>
      <ambientLight intensity={0.42} />
      <directionalLight intensity={1.05} position={[-5, 7, 10]} />
      <mesh
        onPointerDown={handleBoardPointerDown}
        onPointerMove={handleBoardPointerMove}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'crosshair';
        }}
        onPointerUp={handleBoardPointerUp}
        position={[
          pointerMetrics.originX + pointerMetrics.boardExtent / 2,
          pointerMetrics.originY + pointerMetrics.boardExtent / 2,
          4,
        ]}
      >
        <planeGeometry args={[pointerMetrics.boardExtent, pointerMetrics.boardExtent]} />
        <meshBasicMaterial depthWrite={false} opacity={0} transparent />
      </mesh>
      <OrthographicCamera
        makeDefault
        bottom={0}
        far={100}
        left={0}
        near={-100}
        position={[0, 0, 10]}
        right={size.width}
        top={size.height}
      />
    </>
  );
}

const createInitialSnapshot = (boardSize: number): SnakeSnapshot => ({
  capacity: boardSize * boardSize,
  cells: [],
  complete: false,
  foodCount: 1,
  length: 5,
  mode: 'cycle-guard',
  obstacleCount: 0,
  steps: 0,
});

export default function Demo022PaperSnakeGrid() {
  const controls = useControls('Snake Pathfinder', {
    boardSize: {label: 'Map Size', max: 24, min: 10, step: 2, value: 12},
    movesPerSecond: {label: 'Move Speed', max: 14, min: 2, step: 1, value: 10},
  });
  const boardSize = clampBoardSize(controls.boardSize);
  const movesPerSecond = THREE.MathUtils.clamp(controls.movesPerSecond, 2, 14);
  const [runSeed, setRunSeed] = useState(1);
  const [snapshot, setSnapshot] = useState(() => createInitialSnapshot(boardSize));
  const [paused, setPaused] = useState(false);

  const restart = useCallback(() => {
    setRunSeed((seed) => seed + 1);
    setSnapshot(createInitialSnapshot(boardSize));
    setPaused(false);
  }, [boardSize]);

  useEffect(() => {
    setSnapshot(createInitialSnapshot(boardSize));
  }, [boardSize]);

  const progress = Math.min(100, (snapshot.length / Math.max(1, snapshot.capacity)) * 100);

  return (
    <div className="snake-demo">
      <style>{SNAKE_DEMO_STYLES}</style>
      <div className="snake-hud" data-complete={snapshot.complete}>
        <div className="snake-hud__top">
          <div className="snake-hud__title">
            <strong>Autonomous Snake</strong>
            <span className="snake-hud__mode">
              <span className="snake-hud__dot" />
              {paused && !snapshot.complete ? 'PAUSED' : MODE_LABELS[snapshot.mode]}
            </span>
          </div>
          <div className="snake-hud__actions">
            <button
              aria-label={paused ? 'Resume simulation' : 'Pause simulation'}
              className="snake-hud__action"
              disabled={snapshot.complete}
              onClick={() => setPaused((value) => !value)}
              title={paused ? 'Resume simulation' : 'Pause simulation'}
              type="button"
            >
              {paused ? <Play size={15} strokeWidth={2} /> : <Pause size={15} strokeWidth={2} />}
            </button>
            <button
              aria-label="Restart simulation"
              className="snake-hud__action"
              onClick={restart}
              title="Restart simulation"
              type="button"
            >
              <RefreshCcw size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="snake-hud__progress"><span style={{width: `${progress}%`}} /></div>
        <div className="snake-hud__meta">
          <span>Grid <strong>{boardSize}×{boardSize}</strong></span>
          <span>Food <strong>{snapshot.foodCount}</strong> · Blocks <strong>{snapshot.obstacleCount}</strong></span>
          <span><strong>{snapshot.length}</strong> / {snapshot.capacity}</span>
        </div>
      </div>

      <DemoScene
        engineConfig={{
          background: '#080b10',
        }}
        orbitControls={false}
      >
        <SnakeGridEffect
          boardSize={boardSize}
          movesPerSecond={movesPerSecond}
          onSnapshot={setSnapshot}
          paused={paused}
          seed={runSeed}
        />
      </DemoScene>
    </div>
  );
}
