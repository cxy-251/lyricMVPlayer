import * as THREE from "three";
import {RoundedBoxGeometry} from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {RUBIKS_COORDINATES} from "./applyRubiksMove";
import type {RubiksCubelet, ThreeRubiksCubeletBundle} from "../rubiks-cube.types";

const STICKER_PALETTE = {
  back: "#8cff7b",
  body: "#111417",
  down: "#ffd86b",
  front: "#67d8ff",
  left: "#ff9f45",
  right: "#ff5d7a",
  up: "#f6f5f2",
};

const createFaceMaterial = (color: string, isSticker: boolean) =>
  new THREE.MeshPhysicalMaterial({
    color,
    clearcoat: isSticker ? 0.36 : 0.05,
    clearcoatRoughness: isSticker ? 0.22 : 0.65,
    emissive: isSticker ? new THREE.Color(color).multiplyScalar(0.1) : new THREE.Color(0x000000),
    metalness: isSticker ? 0.02 : 0.18,
    roughness: isSticker ? 0.3 : 0.84,
  });

const STICKER_FACE_LAYOUT = [
  {
    axis: "x",
    axisValue: 1,
    color: STICKER_PALETTE.right,
    normal: new THREE.Vector3(1, 0, 0),
    rotation: new THREE.Euler(0, Math.PI / 2, 0),
  },
  {
    axis: "x",
    axisValue: -1,
    color: STICKER_PALETTE.left,
    normal: new THREE.Vector3(-1, 0, 0),
    rotation: new THREE.Euler(0, -Math.PI / 2, 0),
  },
  {
    axis: "y",
    axisValue: 1,
    color: STICKER_PALETTE.up,
    normal: new THREE.Vector3(0, 1, 0),
    rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
  },
  {
    axis: "y",
    axisValue: -1,
    color: STICKER_PALETTE.down,
    normal: new THREE.Vector3(0, -1, 0),
    rotation: new THREE.Euler(Math.PI / 2, 0, 0),
  },
  {
    axis: "z",
    axisValue: 1,
    color: STICKER_PALETTE.front,
    normal: new THREE.Vector3(0, 0, 1),
    rotation: new THREE.Euler(0, 0, 0),
  },
  {
    axis: "z",
    axisValue: -1,
    color: STICKER_PALETTE.back,
    normal: new THREE.Vector3(0, 0, -1),
    rotation: new THREE.Euler(Math.PI, 0, 0),
  },
] as const;

const getCoordAxisValue = (coord: THREE.Vector3, axis: "x" | "y" | "z") => {
  if (axis === "x") {
    return coord.x;
  }

  if (axis === "y") {
    return coord.y;
  }

  return coord.z;
};

const createStickerMesh = ({
  color,
  geometry,
  normal,
  rotation,
}: {
  color: string;
  geometry: THREE.BufferGeometry;
  normal: THREE.Vector3;
  rotation: THREE.Euler;
}) => {
  const mesh = new THREE.Mesh(geometry, createFaceMaterial(color, true));
  mesh.position.copy(normal).multiplyScalar(0.46);
  mesh.rotation.copy(rotation);
  return mesh;
};

export const createRubiksCubelets = ({
  root,
}: {
  root: THREE.Group;
}): ThreeRubiksCubeletBundle => {
  const bodyGeometry = new RoundedBoxGeometry(0.9, 0.9, 0.9, 4, 0.09);
  const stickerGeometry = new RoundedBoxGeometry(0.64, 0.64, 0.05, 3, 0.08);
  const cubelets: RubiksCubelet[] = RUBIKS_COORDINATES.map(([x, y, z], index) => {
    const initialCoord = new THREE.Vector3(x, y, z);
    const object = new THREE.Group();
    const bodyMesh = new THREE.Mesh(
      bodyGeometry,
      new THREE.MeshPhysicalMaterial({
        color: STICKER_PALETTE.body,
        metalness: 0.2,
        roughness: 0.78,
        clearcoat: 0.06,
        clearcoatRoughness: 0.7,
      }),
    );
    object.add(bodyMesh);

    STICKER_FACE_LAYOUT.forEach((face) => {
      if (getCoordAxisValue(initialCoord, face.axis) !== face.axisValue) {
        return;
      }

      object.add(
        createStickerMesh({
          color: face.color,
          geometry: stickerGeometry,
          normal: face.normal,
          rotation: face.rotation,
        }),
      );
    });

    root.add(object);

    return {
      id: `rubiks-cubie-${index}`,
      initialCoord,
      object,
    };
  });

  return {
    bodyGeometry,
    cubelets,
    stickerGeometry,
  };
};
