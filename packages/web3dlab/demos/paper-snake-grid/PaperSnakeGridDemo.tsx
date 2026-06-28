import React, {useMemo, useRef} from 'react';
import { resolveCellularEffectConfig } from '@paper-to-video/content-pipeline';
import * as THREE from 'three';
import {useFrame, useThree} from '@react-three/fiber';
import {useControls} from 'leva';
import {OrthographicCamera} from '@react-three/drei';
import {DemoScene} from '../../core/DemoScene';

import {buildSnakeGridCells} from './core/snake-grid-simulation';

const MAX_SNAKE_INSTANCES = 4096;
const SNAKE_GRID_WIDTH_RATIO = 0.58;
const SNAKE_GRID_HEIGHT_RATIO = 0.58;

const toEvenAtLeast = (value: number, minimum: number) => {
  const evenMinimum = minimum % 2 === 0 ? minimum : minimum + 1;
  const floored = Math.max(evenMinimum, value);
  return floored % 2 === 0 ? floored : floored - 1;
};

export function SnakeGridEffect({ seed = 1, absoluteFrame, simulationFrame }: { seed?: number; absoluteFrame?: number; simulationFrame?: number }) {
  const { size, scene } = useThree();
  const helper = useMemo(() => new THREE.Object3D(), []);
  
  const config = useMemo(() => resolveCellularEffectConfig(undefined), []);
  
  const foodLowColor = useMemo(
    () => new THREE.Color().setHSL((((config.birthHue + 40) % 360) + 360) / 360, 0.88, 0.72),
    [config.birthHue]
  );
  const foodMidColor = useMemo(
    () =>
      new THREE.Color().setHSL(
        (((config.birthHue + 0) % 360) + 360) / 360,
        Math.min(1, config.birthSaturation / 100),
        Math.min(1, Math.max(0, config.birthLightness / 100))
      ),
    [config.birthHue, config.birthLightness, config.birthSaturation]
  );
  const foodHighColor = useMemo(
    () => new THREE.Color().setHSL((((config.birthHue - 34) % 360) + 360) / 360, 1, 0.66),
    [config.birthHue]
  );

  const meshes = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1);
    
    const createLayerMesh = (colorValue: string | THREE.Color) => {
      const material = new THREE.MeshBasicMaterial({
        color: colorValue instanceof THREE.Color ? colorValue : new THREE.Color(colorValue),
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, MAX_SNAKE_INSTANCES);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      return mesh;
    };

    return {
      geometry,
      body: createLayerMesh(config.primaryColor),
      head: createLayerMesh(config.secondaryColor),
      collision: createLayerMesh("#ff425f"),
      foodLow: createLayerMesh(foodLowColor),
      foodMid: createLayerMesh(foodMidColor),
      foodHigh: createLayerMesh(foodHighColor),
    };
  }, [config.primaryColor, config.secondaryColor, foodLowColor, foodMidColor, foodHighColor, scene]);

  React.useEffect(() => {
    return () => {
      const disposeMesh = (mesh: THREE.InstancedMesh) => {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
        scene.remove(mesh);
        mesh.dispose();
      };
      
      disposeMesh(meshes.body);
      disposeMesh(meshes.head);
      disposeMesh(meshes.collision);
      disposeMesh(meshes.foodLow);
      disposeMesh(meshes.foodMid);
      disposeMesh(meshes.foodHigh);
      meshes.geometry.dispose();
    };
  }, [meshes, scene]);

  useFrame((state) => {
    const resolvedFrame = simulationFrame ?? absoluteFrame;
    const timeInSeconds = resolvedFrame !== undefined ? resolvedFrame / 60 : state.clock.elapsedTime;
    const frame = timeInSeconds * 60;
    
    const cols = toEvenAtLeast(Math.round(config.cellColumns * SNAKE_GRID_WIDTH_RATIO), 14);
    const rows = toEvenAtLeast(Math.round(config.cellRows * SNAKE_GRID_HEIGHT_RATIO), 24);
    
    const cells = buildSnakeGridCells({
      cols,
      rows,
      frame: Math.floor(frame / Math.max(1, config.stepEveryFrames)),
      seed,
      foodCount: config.foodCount,
      strategy: config.snakeStrategy,
    });
    
    const cellWidth = size.width / cols;
    const cellHeight = size.height / rows;

    let bodyCount = 0;
    let headCount = 0;
    let collisionCount = 0;
    let foodLowCount = 0;
    let foodMidCount = 0;
    let foodHighCount = 0;

    cells.forEach((cell: any) => {
      const isFood = cell.tone.startsWith("food");
      const inset = isFood ? 2.4 + config.cellPadding * 1.15 : 1.1 + config.cellPadding;
      const drawWidth = Math.max(2, (cellWidth - inset * 2) * config.cellScale);
      const drawHeight = Math.max(2, (cellHeight - inset * 2) * config.cellScale);
      
      helper.position.set(
        cell.x * cellWidth + cellWidth / 2,
        cell.y * cellHeight + cellHeight / 2,
        0
      );
      helper.scale.set(drawWidth, drawHeight, 1);
      helper.updateMatrix();
      
      if (cell.tone === "head") {
        meshes.head.setMatrixAt(headCount, helper.matrix);
        headCount += 1;
      } else if (cell.tone === "collision") {
        meshes.collision.setMatrixAt(collisionCount, helper.matrix);
        collisionCount += 1;
      } else if (cell.tone === "food-low") {
        meshes.foodLow.setMatrixAt(foodLowCount, helper.matrix);
        foodLowCount += 1;
      } else if (cell.tone === "food-mid") {
        meshes.foodMid.setMatrixAt(foodMidCount, helper.matrix);
        foodMidCount += 1;
      } else if (cell.tone === "food-high") {
        meshes.foodHigh.setMatrixAt(foodHighCount, helper.matrix);
        foodHighCount += 1;
      } else {
        meshes.body.setMatrixAt(bodyCount, helper.matrix);
        bodyCount += 1;
      }
    });

    meshes.body.count = bodyCount;
    meshes.head.count = headCount;
    meshes.collision.count = collisionCount;
    meshes.foodLow.count = foodLowCount;
    meshes.foodMid.count = foodMidCount;
    meshes.foodHigh.count = foodHighCount;
    
    meshes.body.instanceMatrix.needsUpdate = true;
    meshes.head.instanceMatrix.needsUpdate = true;
    meshes.collision.instanceMatrix.needsUpdate = true;
    meshes.foodLow.instanceMatrix.needsUpdate = true;
    meshes.foodMid.instanceMatrix.needsUpdate = true;
    meshes.foodHigh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <OrthographicCamera makeDefault left={0} right={size.width} top={size.height} bottom={0} near={-100} far={100} position={[0, 0, 10]} />
    </>
  );
}

export default function PaperSnakeGridDemo() {
  const { showStats } = useControls('Debug', { showStats: false });
  
  return (
    <DemoScene
      debug={showStats}
      engineConfig={{
        background: '#000000',
      }}
      orbitControls={false}
    >
      <SnakeGridEffect seed={1} />
    </DemoScene>
  );
}
