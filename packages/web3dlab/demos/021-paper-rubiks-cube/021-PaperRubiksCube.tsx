import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BrainCircuit,
  Pause,
  Play,
  RefreshCcw,
  RotateCcw,
  RotateCw,
  Shuffle,
  SkipForward,
  Square,
  Timer,
  Undo2,
} from 'lucide-react';
import {resolveRubiksEffectConfig} from '@paper-to-video/content-pipeline';
import {useFrame, useThree, type ThreeEvent} from '@react-three/fiber';
import {useControls} from 'leva';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';
import {createStageDisc} from '../../core/createStageDisc';
import {
  applyRubiksMoveProgress,
  applyRubiksMoveToState,
  buildRubiksSequenceCache,
  createRubiksFaceMove,
  createRubiksLayerMove,
  createSolvedRubiksState,
  generateRubiksScramble,
  getRubiksOrientationCorrection,
  invertRubiksMove,
  isSolvedRubiksState,
  parseRubiksAlgorithm,
  serializeRubiksFacelets,
} from './applyRubiksMove';
import {applyRubiksAppearance, createRubiksCubelets} from './createRubiksCubelets';
import {
  createRubiksStateSolver,
  releaseRubiksSolverBackend,
  RubiksBackendError,
  type RubiksMoveFamily,
  type RubiksSolverState,
} from './rubiksStateSolver';
import {updateRubiksCubelets} from './updateRubiksCubelets';
import type {
  RubiksBodyFinish,
  RubiksCubieState,
  RubiksDimension,
  RubiksMove,
  RubiksStickerPalette,
} from './rubiks-cube.types';

type CubePhase = 'calculating' | 'paused' | 'ready' | 'scrambling' | 'solved' | 'solving' | 'turning';
type TurnDirection = 1 | -1;
type MoveOrigin = 'scramble' | 'solve' | 'undo' | 'user';

type RubiksStatus = {
  busy: boolean;
  canSolve: boolean;
  canUndo: boolean;
  moveCount: number;
  notice: string | null;
  phase: CubePhase;
  solutionCompleted: number;
  solutionLength: number;
};

type QueuedMove = {
  algorithmAction: 'append' | 'pop';
  move: RubiksMove;
  origin: MoveOrigin;
};

type ActiveMove = QueuedMove & {
  elapsed: number;
  fromState: RubiksCubieState[];
};

type PointerGesture = {
  committed: boolean;
  cubieCoord: THREE.Vector3;
  faceNormal: THREE.Vector3;
  move: RubiksMove;
  screenRight: THREE.Vector3;
  screenUp: THREE.Vector3;
  x: number;
  y: number;
};

export type RubiksCubeController = {
  reset: () => void;
  scramble: () => void;
  solve: () => void;
  step: () => void;
  togglePause: () => void;
  undo: () => void;
};

type RubiksCubeEffectProps = {
  absoluteFrame?: number;
  bodyFinish?: RubiksBodyFinish;
  controllerRef?: React.Ref<RubiksCubeController>;
  dimension?: RubiksDimension;
  interactive?: boolean;
  onStatusChange?: (status: RubiksStatus) => void;
  seed?: number;
  simulationFrame?: number;
  solveSpeed?: number;
  stickerPalette?: RubiksStickerPalette;
  turnDirection?: TurnDirection;
};

const INTERACTIVE_CUBIE_GAP = 0.028;
const TURN_DURATION_SECONDS = 0.3;
const CLICK_DISTANCE = 7;
const LAYER_DRAG_DISTANCE = 16;
const BASE_CUBE_EXTENT = 2.94;

const getDimensionScale = (dimension: RubiksDimension) => {
  const cubieSize = (2 / (dimension - 1)) * 0.94;
  return BASE_CUBE_EXTENT / (2 + cubieSize);
};

const getMoveFamilies = (
  history: string[],
  dimension: RubiksDimension,
): RubiksMoveFamily[] => {
  const families = new Map<string, RubiksMoveFamily>();
  history.flatMap((notation) => parseRubiksAlgorithm(notation, dimension)).forEach((move) => {
    if (move.wholeCube) return;
    const layer = Math.round(((move.layer + 1) * (dimension - 1)) / 2);
    families.set(`${move.axis}:${layer}`, {axis: move.axis, layer});
  });
  return [...families.values()];
};

const PHASE_LABELS: Record<CubePhase, string> = {
  calculating: '正在规划完整解法',
  paused: '解算已暂停',
  ready: '等待操作',
  scrambling: '正在打乱',
  solved: '已复原',
  solving: '正在解算',
  turning: '正在转层',
};

const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

const getStickerWorldNormal = (object: THREE.Object3D) =>
  new THREE.Vector3(0, 0, 1).transformDirection(object.matrixWorld);

const isSelectableStickerHit = (event: ThreeEvent<PointerEvent>) => {
  if (event.object.userData.rubiksSticker !== true || event.intersections[0]?.object !== event.object) {
    return false;
  }

  return getStickerWorldNormal(event.object).dot(event.ray.direction) < -0.02;
};

const getStickerLocalNormal = (
  object: THREE.Object3D,
  root: THREE.Group,
) => {
  const worldNormal = getStickerWorldNormal(object);
  const rootQuaternion = root.getWorldQuaternion(new THREE.Quaternion()).invert();
  return worldNormal.applyQuaternion(rootQuaternion).normalize();
};

const getFaceMove = (
  localNormal: THREE.Vector3,
  direction: TurnDirection,
): RubiksMove => {
  const components = {
    x: Math.abs(localNormal.x),
    y: Math.abs(localNormal.y),
    z: Math.abs(localNormal.z),
  };
  const axis = (Object.keys(components) as Array<keyof typeof components>).reduce((largest, candidate) =>
    components[candidate] > components[largest] ? candidate : largest,
  );
  const layer = (localNormal[axis] >= 0 ? 1 : -1) as -1 | 1;
  return createRubiksFaceMove({
    axis,
    direction,
    layer,
  });
};

const getLayerDragMove = ({
  cubieCoord,
  deltaX,
  deltaY,
  dimension,
  faceNormal,
  screenRight,
  screenUp,
}: {
  cubieCoord: THREE.Vector3;
  deltaX: number;
  deltaY: number;
  dimension: RubiksDimension;
  faceNormal: THREE.Vector3;
  screenRight: THREE.Vector3;
  screenUp: THREE.Vector3;
}): RubiksMove | null => {
  const dragDirection = screenRight.clone().multiplyScalar(deltaX)
    .addScaledVector(screenUp, -deltaY);
  dragDirection.addScaledVector(faceNormal, -dragDirection.dot(faceNormal));
  if (dragDirection.lengthSq() < 0.0001) {
    return null;
  }

  const rotationAxis = faceNormal.clone().cross(dragDirection.normalize());
  const components = {
    x: Math.abs(rotationAxis.x),
    y: Math.abs(rotationAxis.y),
    z: Math.abs(rotationAxis.z),
  };
  const axis = (Object.keys(components) as Array<keyof typeof components>).reduce((largest, candidate) =>
    components[candidate] > components[largest] ? candidate : largest,
  );
  const quarterTurns = (rotationAxis[axis] >= 0 ? 1 : -1) as -1 | 1;

  return createRubiksLayerMove({
    axis,
    dimension,
    layer: cubieCoord[axis],
    quarterTurns,
  });
};

const blockOrbitGesture = (event: ThreeEvent<PointerEvent>) => {
  event.stopPropagation();
  event.nativeEvent.preventDefault();
  event.nativeEvent.stopImmediatePropagation();
};

function ResponsiveCamera() {
  const {camera, size} = useThree();

  useLayoutEffect(() => {
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const verticalFov = THREE.MathUtils.degToRad(perspectiveCamera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * size.width / Math.max(1, size.height));
    const limitingFov = Math.min(verticalFov, horizontalFov);
    const fitDistance = THREE.MathUtils.clamp(2.72 / Math.tan(limitingFov / 2), 7.8, 15.5);
    const viewDirection = new THREE.Vector3(0.78, 0.62, 1).normalize();

    perspectiveCamera.position.copy(viewDirection.multiplyScalar(fitDistance));
    perspectiveCamera.lookAt(0, 0.04, 0);
    perspectiveCamera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  return null;
}

export function RubiksCubeEffect({
  absoluteFrame,
  bodyFinish = 'glossy',
  controllerRef,
  dimension = 3,
  interactive,
  onStatusChange,
  seed = 1,
  simulationFrame,
  solveSpeed = 1.2,
  stickerPalette = 'classic',
  turnDirection = 1,
}: RubiksCubeEffectProps) {
  const {camera, controls, scene} = useThree();
  const orbitControls = controls as unknown as {enabled: boolean} | undefined;
  const isTimelineDriven = simulationFrame !== undefined || absoluteFrame !== undefined;
  const interactionEnabled = interactive ?? !isTimelineDriven;
  const config = useMemo(() => resolveRubiksEffectConfig(undefined), []);
  const sequence = useMemo(() => buildRubiksSequenceCache(seed, dimension), [dimension, seed]);
  const solver = useMemo(() => createRubiksStateSolver(dimension), [dimension]);
  const dimensionScale = getDimensionScale(dimension);
  const initialSolverState = useMemo(() => solver.createSolvedState(), [solver]);
  const statusCallbackRef = useRef(onStatusChange);
  const solveSpeedRef = useRef(solveSpeed);
  const turnDirectionRef = useRef(turnDirection);
  const cubeStateRef = useRef(createSolvedRubiksState(dimension));
  const solverStateRef = useRef<Promise<RubiksSolverState>>(initialSolverState);
  const queueRef = useRef<QueuedMove[]>([]);
  const activeMoveRef = useRef<ActiveMove | null>(null);
  const moveHistoryRef = useRef<string[]>([]);
  const moveCountRef = useRef(0);
  const noticeRef = useRef<string | null>(null);
  const phaseRef = useRef<CubePhase>('solved');
  const solutionCompletedRef = useRef(0);
  const solutionLengthRef = useRef(0);
  const solverRequestRef = useRef(0);
  const stepRequestedRef = useRef(false);
  const resumeNeedsSolveRef = useRef(false);
  const afterScramblePhaseRef = useRef<CubePhase>('ready');
  const pointerDownRef = useRef<PointerGesture | null>(null);

  statusCallbackRef.current = onStatusChange;
  solveSpeedRef.current = solveSpeed;
  turnDirectionRef.current = turnDirection;

  const bundle = useMemo(() => {
    const root = new THREE.Group();
    root.position.y = 0.08;

    const contactShadow = createStageDisc({
      color: 0x030508,
      opacity: 0.42,
      radius: 2.65,
      scaleY: 0.72,
      y: -1.75,
      segments: 72,
    });
    const floorGlow = createStageDisc({
      additive: true,
      color: 0x2d5f91,
      opacity: 0.055,
      radius: 4.5,
      scaleY: 0.7,
      y: -1.79,
      segments: 72,
    });

    return {
      root,
      contactShadow,
      floorGlow,
      cubelets: createRubiksCubelets({dimension, root}),
    };
  }, [dimension]);

  const publishStatus = useCallback(() => {
    statusCallbackRef.current?.({
      busy: phaseRef.current !== 'ready' && phaseRef.current !== 'solved',
      canSolve: !isSolvedRubiksState(cubeStateRef.current, dimension),
      canUndo: moveHistoryRef.current.length > 0,
      moveCount: moveCountRef.current,
      notice: noticeRef.current,
      phase: phaseRef.current,
      solutionCompleted: solutionCompletedRef.current,
      solutionLength: solutionLengthRef.current,
    });
  }, [dimension]);

  const reset = useCallback(() => {
    queueRef.current = [];
    activeMoveRef.current = null;
    moveHistoryRef.current = [];
    moveCountRef.current = 0;
    noticeRef.current = null;
    solutionCompletedRef.current = 0;
    solutionLengthRef.current = 0;
    solverRequestRef.current += 1;
    stepRequestedRef.current = false;
    resumeNeedsSolveRef.current = false;
    afterScramblePhaseRef.current = 'ready';
    phaseRef.current = 'solved';
    cubeStateRef.current = createSolvedRubiksState(dimension);
    solverStateRef.current = solver.createSolvedState();
    updateRubiksCubelets({
      cubieGap: INTERACTIVE_CUBIE_GAP,
      cubelets: bundle.cubelets.cubelets,
      states: cubeStateRef.current,
    });
    publishStatus();
  }, [bundle, dimension, publishStatus, solver]);

  const scramble = useCallback(() => {
    if (phaseRef.current !== 'ready' && phaseRef.current !== 'solved' && phaseRef.current !== 'paused') {
      return;
    }

    const returnToPause = phaseRef.current === 'paused';
    noticeRef.current = null;
    if (returnToPause) {
      queueRef.current = [];
      activeMoveRef.current = null;
      stepRequestedRef.current = false;
      resumeNeedsSolveRef.current = true;
      solutionCompletedRef.current = 0;
      solutionLengthRef.current = 0;
    }
    const moves = generateRubiksScramble(Date.now(), dimension, solver.scrambleMoveCount);
    queueRef.current = moves.map((move) => ({algorithmAction: 'append', move, origin: 'scramble'}));
    afterScramblePhaseRef.current = returnToPause ? 'paused' : 'ready';
    phaseRef.current = 'scrambling';
    publishStatus();
  }, [dimension, publishStatus, solver.scrambleMoveCount]);

  const solve = useCallback(async () => {
    if (phaseRef.current !== 'ready' || isSolvedRubiksState(cubeStateRef.current, dimension)) {
      return;
    }

    const requestId = ++solverRequestRef.current;
    noticeRef.current = null;
    afterScramblePhaseRef.current = 'ready';
    phaseRef.current = 'calculating';
    publishStatus();

    await new Promise<void>((resolve) => window.setTimeout(resolve, 40));
    let solverState: RubiksSolverState | null = null;
    try {
      solverState = await solverStateRef.current;
      if (requestId !== solverRequestRef.current) {
        return;
      }

      const orientationCorrection = getRubiksOrientationCorrection(cubeStateRef.current, dimension);
      const orientedCubeState = orientationCorrection.reduce(
        (state, move) => applyRubiksMoveToState(state, move),
        cubeStateRef.current,
      );
      solverState = orientationCorrection.reduce(
        (state, move) => solver.applyMove(state, move.notation),
        solverState,
      );

      const solutionAlgorithm = await solver.solve(
        solverState,
        dimension >= 4 ? serializeRubiksFacelets(orientedCubeState, dimension) : undefined,
        dimension >= 4 && orientationCorrection.length === 0
          ? getMoveFamilies(moveHistoryRef.current, dimension)
          : undefined,
      );
      if (requestId !== solverRequestRef.current) {
        return;
      }

      const solution = [
        ...orientationCorrection,
        ...parseRubiksAlgorithm(solutionAlgorithm, dimension),
      ];
      solutionCompletedRef.current = 0;
      solutionLengthRef.current = solution.length;
      queueRef.current = solution.map((move) => ({algorithmAction: 'append', move, origin: 'solve'}));
      phaseRef.current = solution.length === 0 ? 'solved' : 'solving';
      publishStatus();
    } catch (error) {
      if (requestId !== solverRequestRef.current) {
        return;
      }
      if (error instanceof RubiksBackendError) {
        noticeRef.current = error.message;
      } else {
        console.error('Rubik solver failed', error);
        noticeRef.current = '当前局面求解失败';
      }
      phaseRef.current = 'ready';
      publishStatus();
    }
  }, [dimension, publishStatus, solver]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === 'solving') {
      phaseRef.current = 'paused';
      stepRequestedRef.current = false;
      publishStatus();
      return;
    }

    if (phaseRef.current === 'paused') {
      if (resumeNeedsSolveRef.current) {
        resumeNeedsSolveRef.current = false;
        phaseRef.current = 'ready';
        void solve();
        return;
      }
      phaseRef.current = 'solving';
      stepRequestedRef.current = false;
      publishStatus();
    }
  }, [publishStatus, solve]);

  const step = useCallback(() => {
    if (phaseRef.current !== 'paused' || stepRequestedRef.current) {
      return;
    }
    stepRequestedRef.current = true;
    publishStatus();
  }, [publishStatus]);

  const undo = useCallback(() => {
    if ((phaseRef.current !== 'ready' && phaseRef.current !== 'solved') || moveHistoryRef.current.length === 0) {
      return;
    }

    const previousMove = parseRubiksAlgorithm(moveHistoryRef.current.at(-1)!, dimension)[0];
    noticeRef.current = null;
    queueRef.current = [{algorithmAction: 'pop', move: invertRubiksMove(previousMove), origin: 'undo'}];
    phaseRef.current = 'turning';
    publishStatus();
  }, [dimension, publishStatus]);

  useImperativeHandle(
    controllerRef,
    () => ({reset, scramble, solve: () => void solve(), step, togglePause, undo}),
    [reset, scramble, solve, step, togglePause, undo],
  );

  useEffect(() => {
    applyRubiksAppearance({
      bodyFinish,
      bundle: bundle.cubelets,
      stickerPalette,
    });
  }, [bodyFinish, bundle.cubelets, stickerPalette]);

  useEffect(() => {
    scene.fog = new THREE.Fog(0x090b11, 11, 25);
    publishStatus();

    return () => {
      scene.fog = null;
      document.body.style.cursor = '';
      bundle.cubelets.bodyGeometry.dispose();
      bundle.cubelets.stickerGeometry.dispose();
      bundle.cubelets.materials.forEach((material) => material.dispose());
      bundle.contactShadow.geometry.dispose();
      bundle.contactShadow.material.dispose();
      bundle.floorGlow.geometry.dispose();
      bundle.floorGlow.material.dispose();
    };
  }, [bundle, publishStatus, scene]);

  const queueUserMove = useCallback((move: RubiksMove) => {
    noticeRef.current = null;
    if (phaseRef.current === 'paused') {
      queueRef.current = [];
      activeMoveRef.current = null;
      stepRequestedRef.current = false;
      resumeNeedsSolveRef.current = true;
      solutionCompletedRef.current = 0;
      solutionLengthRef.current = 0;
      queueRef.current.push({algorithmAction: 'append', move, origin: 'user'});
      moveCountRef.current += 1;
      phaseRef.current = 'turning';
      afterScramblePhaseRef.current = 'paused';
      publishStatus();
      return;
    }

    if (phaseRef.current !== 'ready' && phaseRef.current !== 'solved' && phaseRef.current !== 'turning') {
      return;
    }

    if (queueRef.current.length >= 3) {
      return;
    }
    queueRef.current.push({algorithmAction: 'append', move, origin: 'user'});
    moveCountRef.current += 1;
    phaseRef.current = 'turning';
    publishStatus();
  }, [publishStatus]);

  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (!isSelectableStickerHit(event)) {
      pointerDownRef.current = null;
      return;
    }
    event.stopPropagation();
    const direction = (event.nativeEvent.shiftKey ? -turnDirectionRef.current : turnDirectionRef.current) as TurnDirection;
    const cubeletIndex = event.object.parent?.userData.rubiksCubeletIndex;
    if (typeof cubeletIndex !== 'number') {
      pointerDownRef.current = null;
      return;
    }
    const faceNormal = getStickerLocalNormal(event.object, bundle.root);
    const rootQuaternion = bundle.root.getWorldQuaternion(new THREE.Quaternion()).invert();
    const cameraQuaternion = camera.getWorldQuaternion(new THREE.Quaternion());
    const screenRight = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraQuaternion).applyQuaternion(rootQuaternion);
    const screenUp = new THREE.Vector3(0, 1, 0).applyQuaternion(cameraQuaternion).applyQuaternion(rootQuaternion);
    const captureTarget = event.target as unknown as {setPointerCapture?: (pointerId: number) => void};
    captureTarget.setPointerCapture?.(event.pointerId);
    if (dimension > 2) {
      blockOrbitGesture(event);
      if (orbitControls) {
        orbitControls.enabled = false;
      }
    }
    pointerDownRef.current = {
      committed: false,
      cubieCoord: cubeStateRef.current[cubeletIndex].coord.clone(),
      faceNormal,
      move: getFaceMove(faceNormal, direction),
      screenRight,
      screenUp,
      x: event.nativeEvent.clientX,
      y: event.nativeEvent.clientY,
    };
  }, [bundle.root, camera, dimension, orbitControls]);

  const queueLayerGesture = useCallback((pointerDown: PointerGesture, clientX: number, clientY: number) => {
    const deltaX = clientX - pointerDown.x;
    const deltaY = clientY - pointerDown.y;
    const layerMove = getLayerDragMove({
      cubieCoord: pointerDown.cubieCoord,
      deltaX,
      deltaY,
      dimension,
      faceNormal: pointerDown.faceNormal,
      screenRight: pointerDown.screenRight,
      screenUp: pointerDown.screenUp,
    });
    if (!layerMove) {
      return false;
    }

    queueUserMove(layerMove);
    return true;
  }, [dimension, queueUserMove]);

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    const pointerDown = pointerDownRef.current;
    if (!pointerDown || dimension <= 2) {
      return;
    }
    blockOrbitGesture(event);
    if (pointerDown.committed) {
      return;
    }

    const distance = Math.hypot(
      event.nativeEvent.clientX - pointerDown.x,
      event.nativeEvent.clientY - pointerDown.y,
    );
    if (distance < LAYER_DRAG_DISTANCE) {
      return;
    }

    pointerDown.committed = queueLayerGesture(
      pointerDown,
      event.nativeEvent.clientX,
      event.nativeEvent.clientY,
    );
  }, [dimension, queueLayerGesture]);

  useEffect(() => {
    if (!interactionEnabled || dimension <= 2) {
      return;
    }

    const blockNativeEvent = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    const handleWindowPointerMove = (event: PointerEvent) => {
      const pointerDown = pointerDownRef.current;
      if (!pointerDown) {
        return;
      }
      blockNativeEvent(event);
      if (pointerDown.committed) {
        return;
      }

      const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
      if (distance < LAYER_DRAG_DISTANCE) {
        return;
      }
      pointerDown.committed = queueLayerGesture(pointerDown, event.clientX, event.clientY);
    };
    const handleWindowPointerUp = (event: PointerEvent) => {
      const pointerDown = pointerDownRef.current;
      if (!pointerDown) {
        return;
      }
      pointerDownRef.current = null;
      blockNativeEvent(event);
      if (orbitControls) {
        orbitControls.enabled = true;
      }
      if (pointerDown.committed) {
        return;
      }

      const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
      if (distance <= CLICK_DISTANCE) {
        queueUserMove(pointerDown.move);
      } else if (distance >= LAYER_DRAG_DISTANCE) {
        queueLayerGesture(pointerDown, event.clientX, event.clientY);
      }
    };
    const handleWindowPointerCancel = () => {
      pointerDownRef.current = null;
      if (orbitControls) {
        orbitControls.enabled = true;
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove, true);
    window.addEventListener('pointerup', handleWindowPointerUp, true);
    window.addEventListener('pointercancel', handleWindowPointerCancel, true);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove, true);
      window.removeEventListener('pointerup', handleWindowPointerUp, true);
      window.removeEventListener('pointercancel', handleWindowPointerCancel, true);
      if (orbitControls) {
        orbitControls.enabled = true;
      }
    };
  }, [dimension, interactionEnabled, orbitControls, queueLayerGesture, queueUserMove]);

  const handlePointerUp = useCallback((event: ThreeEvent<PointerEvent>) => {
    const pointerDown = pointerDownRef.current;
    pointerDownRef.current = null;
    if (orbitControls) {
      orbitControls.enabled = true;
    }
    if (!pointerDown) {
      return;
    }
    if (dimension > 2) {
      blockOrbitGesture(event);
    } else {
      event.stopPropagation();
    }

    if (pointerDown.committed) {
      return;
    }

    const deltaX = event.nativeEvent.clientX - pointerDown.x;
    const deltaY = event.nativeEvent.clientY - pointerDown.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance <= CLICK_DISTANCE) {
      queueUserMove(pointerDown.move);
      return;
    }

    if (dimension <= 2 || distance < LAYER_DRAG_DISTANCE) {
      return;
    }

    queueLayerGesture(pointerDown, event.nativeEvent.clientX, event.nativeEvent.clientY);
  }, [dimension, orbitControls, queueLayerGesture, queueUserMove]);

  const cancelPointerGesture = useCallback(() => {
    pointerDownRef.current = null;
    if (orbitControls) {
      orbitControls.enabled = true;
    }
  }, [orbitControls]);

  useFrame((state, delta) => {
    if (isTimelineDriven) {
      const resolvedFrame = simulationFrame ?? absoluteFrame ?? 0;
      const cycle = Math.max(1, config.turnFrames + config.holdFrames);
      const stepIndex = Math.floor(resolvedFrame / cycle);
      const stepFrame = resolvedFrame % cycle;
      const lastState = sequence.statesByStep[sequence.statesByStep.length - 1];
      let states = lastState;

      if (stepIndex < sequence.solve.length) {
        states = stepFrame < config.turnFrames
          ? applyRubiksMoveProgress(
              sequence.statesByStep[stepIndex],
              sequence.solve[stepIndex],
              easeInOutCubic(stepFrame / Math.max(1, config.turnFrames)),
            )
          : sequence.statesByStep[Math.min(stepIndex + 1, sequence.statesByStep.length - 1)];
      }

      updateRubiksCubelets({
        cubieGap: config.cubieGap,
        cubelets: bundle.cubelets.cubelets,
        states,
      });
      bundle.root.scale.setScalar(config.cubeScale * dimensionScale);
      return;
    }

    if (phaseRef.current === 'paused' && !stepRequestedRef.current) {
      bundle.root.scale.setScalar(1.06 * dimensionScale);
      return;
    }

    let activeMove = activeMoveRef.current;
    if (!activeMove) {
      const queuedMove = queueRef.current.shift();
      if (queuedMove) {
        activeMove = {
          ...queuedMove,
          elapsed: 0,
          fromState: cubeStateRef.current,
        };
        activeMoveRef.current = activeMove;
      }
    }

    if (activeMove) {
      const animationSpeed = activeMove.origin === 'solve'
        ? solveSpeedRef.current
        : activeMove.origin === 'scramble'
          ? 1.8
          : 1.25;
      activeMove.elapsed += Math.min(delta, 0.05) * animationSpeed;
      const progress = Math.min(1, activeMove.elapsed / TURN_DURATION_SECONDS);
      const visibleState = applyRubiksMoveProgress(
        activeMove.fromState,
        activeMove.move,
        easeInOutCubic(progress),
      );
      updateRubiksCubelets({
        cubieGap: INTERACTIVE_CUBIE_GAP,
        cubelets: bundle.cubelets.cubelets,
        states: visibleState,
      });

      if (progress >= 1) {
        cubeStateRef.current = applyRubiksMoveToState(activeMove.fromState, activeMove.move);
        solverStateRef.current = solverStateRef.current.then((solverState) =>
          solver.applyMove(solverState, activeMove.move.notation),
        );
        if (activeMove.algorithmAction === 'pop') {
          moveHistoryRef.current.pop();
          moveCountRef.current = Math.max(0, moveCountRef.current - 1);
        } else {
          moveHistoryRef.current.push(activeMove.move.notation);
        }
        if (activeMove.origin === 'solve') {
          solutionCompletedRef.current += 1;
        }
        activeMoveRef.current = null;

        const solvedState = isSolvedRubiksState(cubeStateRef.current, dimension);
        if (solvedState) {
          noticeRef.current = null;
          moveHistoryRef.current = [];
          queueRef.current = [];
          stepRequestedRef.current = false;
          resumeNeedsSolveRef.current = false;
          afterScramblePhaseRef.current = 'ready';
          phaseRef.current = 'solved';
          publishStatus();
        } else if (activeMove.origin === 'solve' && stepRequestedRef.current) {
          stepRequestedRef.current = false;
          phaseRef.current = 'paused';
          publishStatus();
        } else if (queueRef.current.length === 0) {
          phaseRef.current = afterScramblePhaseRef.current;
          if (phaseRef.current !== 'paused') {
            afterScramblePhaseRef.current = 'ready';
          }
          publishStatus();
        } else if (activeMove.origin === 'solve') {
          publishStatus();
        }
      }
    } else {
      updateRubiksCubelets({
        cubieGap: INTERACTIVE_CUBIE_GAP,
        cubelets: bundle.cubelets.cubelets,
        states: cubeStateRef.current,
      });
    }

    bundle.root.scale.setScalar(1.06 * dimensionScale);
    bundle.contactShadow.mesh.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 0.55) * 0.012);
  });

  return (
    <>
      <primitive
        object={bundle.root}
        onPointerCancel={interactionEnabled ? cancelPointerGesture : undefined}
        onPointerDown={interactionEnabled ? handlePointerDown : undefined}
        onPointerMove={interactionEnabled ? handlePointerMove : undefined}
        onPointerOut={interactionEnabled ? () => {
          document.body.style.cursor = '';
        } : undefined}
        onPointerOver={interactionEnabled ? (event: ThreeEvent<PointerEvent>) => {
          if (isSelectableStickerHit(event)) {
            event.stopPropagation();
            document.body.style.cursor = 'pointer';
          }
        } : undefined}
        onPointerUp={interactionEnabled ? handlePointerUp : undefined}
      />
      <primitive object={bundle.contactShadow.mesh} />
      <primitive object={bundle.floorGlow.mesh} />
      <ambientLight intensity={0.58} color="#dce8ff" />
      <hemisphereLight args={[0xf7fbff, 0x101722, 1.2]} />
      <directionalLight position={[6, 8, 8]} intensity={2.1} color="#ffffff" />
      <directionalLight position={[-5, 2, 6]} intensity={1.05} color="#ffd7b0" />
      <directionalLight position={[-7, 5, -7]} intensity={1.4} color="#75baff" />
    </>
  );
}

function ControlButton({
  children,
  disabled = false,
  onClick,
  primary = false,
  testId,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  primary?: boolean;
  testId: string;
}) {
  return (
    <button
      className={`rubiks-control-button${primary ? ' rubiks-control-button--primary' : ''}`}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

const RUBIKS_GAME_STYLES = `
  .rubiks-game {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #090b11;
    color: #f7f9fc;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  }

  .rubiks-game-status {
    position: absolute;
    z-index: 12;
    top: 20px;
    left: 50%;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 42px;
    padding: 0 15px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    background: rgba(12, 15, 21, 0.82);
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.24);
    backdrop-filter: blur(14px);
    transform: translateX(-50%);
    pointer-events: none;
    white-space: nowrap;
  }

  .rubiks-game-status strong {
    color: #ffffff;
    font-size: 13px;
    font-weight: 750;
  }

  .rubiks-game-status span {
    color: rgba(232, 238, 248, 0.62);
    font-size: 12px;
  }

  .rubiks-game-controls {
    position: absolute;
    z-index: 12;
    left: 50%;
    bottom: 20px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 8px;
    width: min(980px, calc(100% - 28px));
    min-height: 62px;
    padding: 9px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    background: rgba(12, 15, 21, 0.86);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.34);
    backdrop-filter: blur(18px);
    transform: translateX(-50%);
  }

  .rubiks-control-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .rubiks-control-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 42px;
    padding: 0 13px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.055);
    color: rgba(248, 250, 255, 0.88);
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
  }

  .rubiks-control-button:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.24);
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .rubiks-control-button--primary {
    border-color: rgba(86, 218, 178, 0.44);
    background: #1f8d70;
    color: #ffffff;
  }

  .rubiks-control-button--primary:hover:not(:disabled) {
    border-color: rgba(125, 239, 204, 0.7);
    background: #249d7d;
  }

  .rubiks-control-button:disabled {
    opacity: 0.38;
    cursor: default;
  }

  .rubiks-direction-control {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 42px;
    padding: 0 11px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.035);
    color: rgba(232, 238, 248, 0.68);
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .rubiks-speed-control {
    display: grid;
    grid-template-columns: auto 112px 34px;
    align-items: center;
    gap: 8px;
    min-width: 204px;
    margin-left: 2px;
    padding: 0 8px;
    color: rgba(232, 238, 248, 0.7);
    font-size: 12px;
    font-weight: 700;
  }

  .rubiks-speed-control input {
    width: 112px;
    accent-color: #58d9b1;
  }

  .rubiks-speed-value {
    color: #ffffff;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  @media (max-width: 720px) {
    .rubiks-game-status {
      top: 76px;
      gap: 8px;
      padding: 0 10px;
    }

    .rubiks-game-status span:last-child {
      display: none;
    }

    .rubiks-game-controls {
      bottom: 12px;
    }

    .rubiks-control-group {
      flex-wrap: wrap;
      justify-content: center;
    }

    .rubiks-speed-control {
      order: 2;
      flex-basis: 100%;
      grid-template-columns: auto minmax(80px, 1fr) 34px;
      min-width: 0;
      margin-left: 0;
    }

    .rubiks-speed-control input {
      width: 100%;
    }

  }
`;

const INITIAL_STATUS: RubiksStatus = {
  busy: false,
  canSolve: false,
  canUndo: false,
  moveCount: 0,
  notice: null,
  phase: 'solved',
  solutionCompleted: 0,
  solutionLength: 0,
};

const formatElapsedTime = (milliseconds: number) => {
  const totalTenths = Math.floor(milliseconds / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor(totalTenths / 10) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${totalTenths % 10}`;
};

export default function Demo021PaperRubiksCube() {
  const appearance = useControls('Rubik Cube Appearance', {
    cubeDimension: {
      label: '魔方阶数',
      options: {
        '2×2': 2,
        '3×3': 3,
        '4×4': 4,
        '5×5': 5,
        '6×6': 6,
      },
      value: 3,
    },
    stickerPalette: {
      label: '贴纸配色',
      options: {
        经典高饱和: 'classic',
        柔和粉彩: 'pastel',
        霓虹亮色: 'neon',
      },
      value: 'classic',
    },
    bodyFinish: {
      label: '方块材质',
      options: {
        亮面树脂: 'glossy',
        哑光塑料: 'matte',
        枪灰金属: 'metal',
      },
      value: 'glossy',
    },
  });
  const controllerRef = useRef<RubiksCubeController>(null);
  const timerAccumulatedRef = useRef(0);
  const timerModeRef = useRef<'manual' | 'solver' | null>(null);
  const timerRunningRef = useRef(false);
  const timerStartedAtRef = useRef<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [solveSpeed, setSolveSpeed] = useState(1.2);
  const [status, setStatus] = useState<RubiksStatus>(INITIAL_STATUS);
  const [timerRunning, setTimerRunning] = useState(false);
  const [turnDirection, setTurnDirection] = useState<TurnDirection>(1);
  const cubeDimension = appearance.cubeDimension as RubiksDimension;

  useEffect(() => releaseRubiksSolverBackend, []);

  const pauseTimer = useCallback(() => {
    if (timerStartedAtRef.current !== null) {
      timerAccumulatedRef.current += performance.now() - timerStartedAtRef.current;
      timerStartedAtRef.current = null;
      setElapsedTime(timerAccumulatedRef.current);
    }
    timerRunningRef.current = false;
    setTimerRunning(false);
  }, []);

  const startTimer = useCallback((mode: 'manual' | 'solver', restart: boolean) => {
    if (restart) {
      timerAccumulatedRef.current = 0;
      setElapsedTime(0);
    }
    timerModeRef.current = mode;
    timerStartedAtRef.current = performance.now();
    timerRunningRef.current = true;
    setTimerRunning(true);
  }, []);

  const resetTimer = useCallback(() => {
    timerAccumulatedRef.current = 0;
    timerModeRef.current = null;
    timerRunningRef.current = false;
    timerStartedAtRef.current = null;
    setElapsedTime(0);
    setTimerRunning(false);
  }, []);

  useEffect(() => {
    resetTimer();
    setStatus(INITIAL_STATUS);
  }, [cubeDimension, resetTimer]);

  useEffect(() => {
    if ((status.phase === 'solved' || status.notice) && timerRunningRef.current) {
      pauseTimer();
    }
  }, [pauseTimer, status.notice, status.phase]);

  useEffect(() => {
    if (!timerRunning) {
      return;
    }

    const updateTimer = () => {
      if (timerStartedAtRef.current !== null) {
        setElapsedTime(timerAccumulatedRef.current + performance.now() - timerStartedAtRef.current);
      }
    };
    const timer = window.setInterval(updateTimer, 100);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  const handleSmartSolve = useCallback(() => {
    startTimer('solver', true);
    controllerRef.current?.solve();
  }, [startTimer]);

  const handleSolvePause = useCallback(() => {
    if (status.phase === 'solving') {
      pauseTimer();
    } else if (status.phase === 'paused' && timerModeRef.current === 'solver') {
      startTimer('solver', false);
    }
    controllerRef.current?.togglePause();
  }, [pauseTimer, startTimer, status.phase]);

  const handleReset = useCallback(() => {
    controllerRef.current?.reset();
    resetTimer();
  }, [resetTimer]);

  const progressLabel = status.notice ?? (
    status.phase === 'paused' && status.solutionLength === 0
      ? '局面已变化'
      : status.phase === 'solving' || status.phase === 'paused'
        ? `解算 ${status.solutionCompleted}/${status.solutionLength}`
        : `手动 ${status.moveCount} 步`
  );

  return (
    <div className="rubiks-game">
      <style>{RUBIKS_GAME_STYLES}</style>
      <DemoScene
        engineConfig={{
          background: '#090b11',
          camera: {fov: 40, far: 100, near: 0.1, position: [6.1, 4.9, 7.8]},
        }}
        orbitConfig={{enablePan: false, enableZoom: true, maxDistance: 18, minDistance: 5.4}}
      >
        <ResponsiveCamera />
        <RubiksCubeEffect
          bodyFinish={appearance.bodyFinish as RubiksBodyFinish}
          controllerRef={controllerRef}
          dimension={cubeDimension}
          interactive
          key={cubeDimension}
          onStatusChange={setStatus}
          seed={1}
          solveSpeed={solveSpeed}
          stickerPalette={appearance.stickerPalette as RubiksStickerPalette}
          turnDirection={turnDirection}
        />
      </DemoScene>

      <div className="rubiks-game-status" data-testid="rubiks-status">
        <strong>{PHASE_LABELS[status.phase]}</strong>
        <span>{formatElapsedTime(elapsedTime)}</span>
        <span>{progressLabel}</span>
      </div>

      <div className="rubiks-game-controls" aria-label="魔方操作">
        <div className="rubiks-control-group" aria-label="局面操作">
          <ControlButton
            disabled={status.busy && status.phase !== 'paused'}
            onClick={() => controllerRef.current?.scramble()}
            testId="rubiks-scramble"
          >
            <Shuffle aria-hidden size={16} />
            打乱
          </ControlButton>
          <ControlButton
            disabled={status.busy || !status.canUndo}
            onClick={() => controllerRef.current?.undo()}
            testId="rubiks-undo"
          >
            <Undo2 aria-hidden size={16} />
            撤销
          </ControlButton>
          <ControlButton
            onClick={handleReset}
            testId="rubiks-reset"
          >
            <RefreshCcw aria-hidden size={16} />
            复原
          </ControlButton>
        </div>
        <div className="rubiks-control-group" aria-label="解算播放">
          <ControlButton
            disabled={status.busy || !status.canSolve}
            onClick={handleSmartSolve}
            primary
            testId="rubiks-solve"
          >
            <BrainCircuit aria-hidden size={16} />
            智能解算
          </ControlButton>
          <ControlButton
            disabled={status.phase !== 'solving' && status.phase !== 'paused'}
            onClick={handleSolvePause}
            testId="rubiks-pause"
          >
            {status.phase === 'paused' ? <Play aria-hidden fill="currentColor" size={14} /> : <Pause aria-hidden size={15} />}
            {status.phase === 'paused' ? '继续' : '暂停'}
          </ControlButton>
          <ControlButton
            disabled={status.phase !== 'paused' || status.solutionCompleted >= status.solutionLength}
            onClick={() => controllerRef.current?.step()}
            testId="rubiks-step"
          >
            <SkipForward aria-hidden size={16} />
            单步
          </ControlButton>
        </div>
        <ControlButton
          onClick={() => timerRunning ? pauseTimer() : startTimer('manual', true)}
          testId="rubiks-timer"
        >
          {timerRunning ? <Square aria-hidden fill="currentColor" size={13} /> : <Timer aria-hidden size={16} />}
          {timerRunning ? '停止计时' : '开始计时'}
        </ControlButton>
        <button
          aria-label={turnDirection === 1 ? '当前顺时针，点击切换逆时针' : '当前逆时针，点击切换顺时针'}
          aria-pressed={turnDirection === -1}
          className="rubiks-direction-control"
          disabled={status.busy && status.phase !== 'paused'}
          onClick={() => setTurnDirection((direction) => direction === 1 ? -1 : 1)}
          type="button"
        >
          {turnDirection === 1 ? <RotateCw aria-hidden size={16} /> : <RotateCcw aria-hidden size={16} />}
          {turnDirection === 1 ? '顺时针' : '逆时针'}
        </button>
        <label className="rubiks-speed-control">
          <span>解算速度</span>
          <input
            aria-label="解算速度"
            max={2.4}
            min={0.5}
            onChange={(event) => setSolveSpeed(Number(event.target.value))}
            step={0.1}
            type="range"
            value={solveSpeed}
          />
          <span className="rubiks-speed-value">{solveSpeed.toFixed(1)}x</span>
        </label>
      </div>
    </div>
  );
}
