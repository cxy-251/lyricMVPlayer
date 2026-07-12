import * as THREE from "three";
import {RoundedBoxGeometry} from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {createRubiksCoordinates} from "./applyRubiksMove";
import type {
  RubiksBodyFinish,
  RubiksCubelet,
  RubiksDimension,
  RubiksFace,
  RubiksStickerPalette,
  ThreeRubiksCubeletBundle,
} from "./rubiks-cube.types";

const STICKER_PALETTES: Record<RubiksStickerPalette, Record<RubiksFace, string>> = {
  classic: {
    back: "#1769d1",
    down: "#ffd500",
    front: "#00a86b",
    left: "#ff7a18",
    right: "#d83245",
    up: "#f4f1e8",
  },
  neon: {
    back: "#245cff",
    down: "#fff200",
    front: "#00e894",
    left: "#ff8500",
    right: "#ff2852",
    up: "#f7fbff",
  },
  pastel: {
    back: "#78a8f8",
    down: "#f5df82",
    front: "#79cfa9",
    left: "#f2a46d",
    right: "#e8798a",
    up: "#f4efe7",
  },
};

type MaterialStyle = {
  clearcoat: number;
  clearcoatRoughness: number;
  color: string;
  emissiveIntensity: number;
  metalness: number;
  roughness: number;
};

const BODY_FINISHES: Record<RubiksBodyFinish, MaterialStyle> = {
  glossy: {
    clearcoat: 0.62,
    clearcoatRoughness: 0.16,
    color: "#101216",
    emissiveIntensity: 0,
    metalness: 0.03,
    roughness: 0.26,
  },
  matte: {
    clearcoat: 0.08,
    clearcoatRoughness: 0.62,
    color: "#14171c",
    emissiveIntensity: 0,
    metalness: 0,
    roughness: 0.72,
  },
  metal: {
    clearcoat: 0.34,
    clearcoatRoughness: 0.2,
    color: "#252b34",
    emissiveIntensity: 0,
    metalness: 0.72,
    roughness: 0.25,
  },
};

const STICKER_FINISHES: Record<RubiksStickerPalette, Omit<MaterialStyle, "color">> = {
  classic: {
    clearcoat: 0.58,
    clearcoatRoughness: 0.18,
    emissiveIntensity: 0.025,
    metalness: 0,
    roughness: 0.24,
  },
  neon: {
    clearcoat: 0.72,
    clearcoatRoughness: 0.12,
    emissiveIntensity: 0.09,
    metalness: 0,
    roughness: 0.17,
  },
  pastel: {
    clearcoat: 0.34,
    clearcoatRoughness: 0.3,
    emissiveIntensity: 0.012,
    metalness: 0,
    roughness: 0.34,
  },
};

const applyMaterialStyle = (material: THREE.MeshPhysicalMaterial, style: MaterialStyle) => {
  material.color.set(style.color);
  material.emissive.set(style.color).multiplyScalar(style.emissiveIntensity);
  material.clearcoat = style.clearcoat;
  material.clearcoatRoughness = style.clearcoatRoughness;
  material.metalness = style.metalness;
  material.roughness = style.roughness;
  material.needsUpdate = true;
};

const createPhysicalMaterial = (style: MaterialStyle) => {
  const material = new THREE.MeshPhysicalMaterial();
  applyMaterialStyle(material, style);
  return material;
};

const STICKER_FACE_LAYOUT = [
  {
    axis: "x",
    axisValue: 1,
    face: "right",
    normal: new THREE.Vector3(1, 0, 0),
    rotation: new THREE.Euler(0, Math.PI / 2, 0),
  },
  {
    axis: "x",
    axisValue: -1,
    face: "left",
    normal: new THREE.Vector3(-1, 0, 0),
    rotation: new THREE.Euler(0, -Math.PI / 2, 0),
  },
  {
    axis: "y",
    axisValue: 1,
    face: "up",
    normal: new THREE.Vector3(0, 1, 0),
    rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
  },
  {
    axis: "y",
    axisValue: -1,
    face: "down",
    normal: new THREE.Vector3(0, -1, 0),
    rotation: new THREE.Euler(Math.PI / 2, 0, 0),
  },
  {
    axis: "z",
    axisValue: 1,
    face: "front",
    normal: new THREE.Vector3(0, 0, 1),
    rotation: new THREE.Euler(0, 0, 0),
  },
  {
    axis: "z",
    axisValue: -1,
    face: "back",
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
  geometry,
  material,
  normal,
  offset,
  rotation,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  normal: THREE.Vector3;
  offset: number;
  rotation: THREE.Euler;
}) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(normal).multiplyScalar(offset);
  mesh.rotation.copy(rotation);
  mesh.userData.rubiksSticker = true;
  return mesh;
};

export const applyRubiksAppearance = ({
  bodyFinish,
  bundle,
  stickerPalette,
}: {
  bodyFinish: RubiksBodyFinish;
  bundle: ThreeRubiksCubeletBundle;
  stickerPalette: RubiksStickerPalette;
}) => {
  applyMaterialStyle(bundle.bodyMaterial, BODY_FINISHES[bodyFinish]);
  const finish = STICKER_FINISHES[stickerPalette];
  bundle.stickerMaterials.forEach((material, face) => {
    applyMaterialStyle(material, {
      ...finish,
      color: STICKER_PALETTES[stickerPalette][face],
    });
  });
};

export const createRubiksCubelets = ({
  dimension,
  root,
}: {
  dimension: RubiksDimension;
  root: THREE.Group;
}): ThreeRubiksCubeletBundle => {
  const spacing = 2 / (dimension - 1);
  const bodySize = spacing * 0.94;
  const stickerSize = bodySize * (0.76 / 0.94);
  const stickerDepth = bodySize * (0.038 / 0.94);
  const bodyRadius = bodySize * (0.1 / 0.94);
  const stickerRadius = bodySize * (0.065 / 0.94);
  const stickerOffset = bodySize * (0.478 / 0.94);
  const bodyGeometry = new RoundedBoxGeometry(bodySize, bodySize, bodySize, 5, bodyRadius);
  const stickerGeometry = new RoundedBoxGeometry(stickerSize, stickerSize, stickerDepth, 4, stickerRadius);
  const bodyMaterial = createPhysicalMaterial(BODY_FINISHES.glossy);
  const stickerMaterials = new Map<RubiksFace, THREE.MeshPhysicalMaterial>(
    STICKER_FACE_LAYOUT.map((face) => [
      face.face,
      createPhysicalMaterial({
        ...STICKER_FINISHES.classic,
        color: STICKER_PALETTES.classic[face.face],
      }),
    ] as const),
  );
  const materials = [bodyMaterial, ...stickerMaterials.values()];
  const cubelets: RubiksCubelet[] = createRubiksCoordinates(dimension).map(([x, y, z], index) => {
    const initialCoord = new THREE.Vector3(x, y, z);
    const object = new THREE.Group();
    object.userData.rubiksCubeletIndex = index;
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    object.add(bodyMesh);

    STICKER_FACE_LAYOUT.forEach((face) => {
      if (getCoordAxisValue(initialCoord, face.axis) !== face.axisValue) {
        return;
      }

      object.add(
        createStickerMesh({
          geometry: stickerGeometry,
          material: stickerMaterials.get(face.face)!,
          normal: face.normal,
          offset: stickerOffset,
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
    bodyMaterial,
    bodyGeometry,
    cubelets,
    materials,
    stickerGeometry,
    stickerMaterials,
  };
};
