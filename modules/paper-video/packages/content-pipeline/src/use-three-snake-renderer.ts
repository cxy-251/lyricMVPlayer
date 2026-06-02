import {useEffect, useMemo, useRef} from "react";
import * as THREE from "three";
import {resolveCellularEffectConfig} from "./module-api";
import {buildSnakeGridCells} from "./snake-grid-effect.service";
import type {ThreeLifeEffectProps} from "./three-life-effect.types";

type SnakeMeshRefs = {
  body: THREE.InstancedMesh | null;
  head: THREE.InstancedMesh | null;
  collision: THREE.InstancedMesh | null;
  foodLow: THREE.InstancedMesh | null;
  foodMid: THREE.InstancedMesh | null;
  foodHigh: THREE.InstancedMesh | null;
};

const MAX_SNAKE_INSTANCES = 4096;
const SNAKE_GRID_WIDTH_RATIO = 0.58;
const SNAKE_GRID_HEIGHT_RATIO = 0.58;
const toEvenAtLeast = (value: number, minimum: number) => {
  const evenMinimum = minimum % 2 === 0 ? minimum : minimum + 1;
  const floored = Math.max(evenMinimum, value);
  return floored % 2 === 0 ? floored : floored - 1;
};

const disposeMeshMaterial = (mesh: THREE.InstancedMesh | null) => {
  if (!mesh) {
    return;
  }

  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((material) => material.dispose());
    return;
  }

  mesh.material.dispose();
};

export const useThreeSnakeRenderer = ({
  width,
  height,
  absoluteFrame,
  simulationFrame,
  seed,
  modules,
}: ThreeLifeEffectProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const meshRefs = useRef<SnakeMeshRefs>({
    body: null,
    head: null,
    collision: null,
    foodLow: null,
    foodMid: null,
    foodHigh: null,
  });
  const helper = useMemo(() => new THREE.Object3D(), []);
  const config = resolveCellularEffectConfig(modules);
  const foodLowColor = useMemo(
    () => new THREE.Color().setHSL((((config.birthHue + 40) % 360) + 360) / 360, 0.88, 0.72),
    [config.birthHue],
  );
  const foodMidColor = useMemo(
    () =>
      new THREE.Color().setHSL(
        (((config.birthHue + 0) % 360) + 360) / 360,
        Math.min(1, config.birthSaturation / 100),
        Math.min(1, Math.max(0, config.birthLightness / 100)),
      ),
    [config.birthHue, config.birthLightness, config.birthSaturation],
  );
  const foodHighColor = useMemo(
    () => new THREE.Color().setHSL((((config.birthHue - 34) % 360) + 360) / 360, 1, 0.66),
    [config.birthHue],
  );

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const context = (
      canvas.getContext("webgl2", {alpha: true, antialias: false}) ??
      canvas.getContext("webgl", {alpha: true, antialias: false}) ??
      canvas.getContext("experimental-webgl", {alpha: true, antialias: false})
    ) as WebGL2RenderingContext | WebGLRenderingContext | null;

    if (!context) {
      throw new Error("Unable to acquire a WebGL context for ThreeSnakeEffect");
    }

    const renderer = new THREE.WebGLRenderer({canvas, context, alpha: true, antialias: false});
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, width, height, 0, -100, 100);
    camera.position.z = 10;

    const geometry = new THREE.PlaneGeometry(1, 1);
    const createLayerMesh = (colorValue: string) => {
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorValue),
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, MAX_SNAKE_INSTANCES);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      return mesh;
    };

    const bodyMesh = createLayerMesh(config.primaryColor);
    const headMesh = createLayerMesh(config.secondaryColor);
    const collisionMesh = createLayerMesh("#ff425f");
    const foodLowMesh = createLayerMesh(foodLowColor.getStyle());
    const foodMidMesh = createLayerMesh(foodMidColor.getStyle());
    const foodHighMesh = createLayerMesh(foodHighColor.getStyle());

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    meshRefs.current = {
      body: bodyMesh,
      head: headMesh,
      collision: collisionMesh,
      foodLow: foodLowMesh,
      foodMid: foodMidMesh,
      foodHigh: foodHighMesh,
    };

    return () => {
      disposeMeshMaterial(meshRefs.current.body);
      disposeMeshMaterial(meshRefs.current.head);
      disposeMeshMaterial(meshRefs.current.collision);
      disposeMeshMaterial(meshRefs.current.foodLow);
      disposeMeshMaterial(meshRefs.current.foodMid);
      disposeMeshMaterial(meshRefs.current.foodHigh);
      meshRefs.current.body?.dispose();
      meshRefs.current.head?.dispose();
      meshRefs.current.collision?.dispose();
      meshRefs.current.foodLow?.dispose();
      meshRefs.current.foodMid?.dispose();
      meshRefs.current.foodHigh?.dispose();
      geometry.dispose();
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      meshRefs.current = {body: null, head: null, collision: null, foodLow: null, foodMid: null, foodHigh: null};
    };
  }, [foodHighColor, foodLowColor, foodMidColor, height, width]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const {
      body: bodyMesh,
      head: headMesh,
      collision: collisionMesh,
      foodLow: foodLowMesh,
      foodMid: foodMidMesh,
      foodHigh: foodHighMesh,
    } = meshRefs.current;
    if (!renderer || !scene || !camera || !bodyMesh || !headMesh || !collisionMesh || !foodLowMesh || !foodMidMesh || !foodHighMesh) {
      return;
    }

    const resolvedFrame = simulationFrame ?? absoluteFrame ?? 0;
    const cols = toEvenAtLeast(Math.round(config.cellColumns * SNAKE_GRID_WIDTH_RATIO), 14);
    const rows = toEvenAtLeast(Math.round(config.cellRows * SNAKE_GRID_HEIGHT_RATIO), 24);
    const cells = buildSnakeGridCells({
      cols,
      rows,
      frame: Math.floor(resolvedFrame / Math.max(1, config.stepEveryFrames)),
      seed,
      foodCount: config.foodCount,
      strategy: config.snakeStrategy,
    });
    const cellWidth = width / cols;
    const cellHeight = height / rows;

    renderer.setSize(width, height, false);
    camera.right = width;
    camera.top = height;
    camera.bottom = 0;
    camera.updateProjectionMatrix();

    (bodyMesh.material as THREE.MeshBasicMaterial).color.set(config.primaryColor);
    (headMesh.material as THREE.MeshBasicMaterial).color.set(config.secondaryColor);
    (foodLowMesh.material as THREE.MeshBasicMaterial).color.copy(foodLowColor);
    (foodMidMesh.material as THREE.MeshBasicMaterial).color.copy(foodMidColor);
    (foodHighMesh.material as THREE.MeshBasicMaterial).color.copy(foodHighColor);

    let bodyCount = 0;
    let headCount = 0;
    let collisionCount = 0;
    let foodLowCount = 0;
    let foodMidCount = 0;
    let foodHighCount = 0;
    cells.forEach((cell) => {
      const isFood = cell.tone.startsWith("food");
      const inset = isFood ? 2.4 + config.cellPadding * 1.15 : 1.1 + config.cellPadding;
      const drawWidth = Math.max(2, (cellWidth - inset * 2) * config.cellScale);
      const drawHeight = Math.max(2, (cellHeight - inset * 2) * config.cellScale);
      helper.position.set(
        cell.x * cellWidth + cellWidth / 2,
        cell.y * cellHeight + cellHeight / 2,
        0,
      );
      helper.scale.set(drawWidth, drawHeight, 1);
      helper.updateMatrix();
      if (cell.tone === "head") {
        headMesh.setMatrixAt(headCount, helper.matrix);
        headCount += 1;
      } else if (cell.tone === "collision") {
        collisionMesh.setMatrixAt(collisionCount, helper.matrix);
        collisionCount += 1;
      } else if (cell.tone === "food-low") {
        foodLowMesh.setMatrixAt(foodLowCount, helper.matrix);
        foodLowCount += 1;
      } else if (cell.tone === "food-mid") {
        foodMidMesh.setMatrixAt(foodMidCount, helper.matrix);
        foodMidCount += 1;
      } else if (cell.tone === "food-high") {
        foodHighMesh.setMatrixAt(foodHighCount, helper.matrix);
        foodHighCount += 1;
      } else {
        bodyMesh.setMatrixAt(bodyCount, helper.matrix);
        bodyCount += 1;
      }
    });

    bodyMesh.count = bodyCount;
    headMesh.count = headCount;
    collisionMesh.count = collisionCount;
    foodLowMesh.count = foodLowCount;
    foodMidMesh.count = foodMidCount;
    foodHighMesh.count = foodHighCount;
    bodyMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    collisionMesh.instanceMatrix.needsUpdate = true;
    foodLowMesh.instanceMatrix.needsUpdate = true;
    foodMidMesh.instanceMatrix.needsUpdate = true;
    foodHighMesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  }, [
    absoluteFrame,
    config.cellColumns,
    config.cellPadding,
    config.cellScale,
    config.cellRows,
    config.foodCount,
    config.snakeStrategy,
    config.primaryColor,
    config.secondaryColor,
    config.stepEveryFrames,
    foodHighColor,
    foodLowColor,
    foodMidColor,
    height,
    helper,
    modules,
    seed,
    simulationFrame,
    width,
  ]);

  return {canvasRef};
};
