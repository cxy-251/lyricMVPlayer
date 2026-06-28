import * as THREE from "three";
import {createStageDisc} from "../../../core/createStageDisc";
import type {ThreeLightsMeshBundle} from "../lights-beams.types";

const createLayer = ({
  color,
  count,
  geometry,
  layerName,
  opacity,
  root,
}: {
  color: string;
  count: number;
  geometry: THREE.SphereGeometry;
  layerName: "accent" | "core" | "glow";
  opacity: number;
  root: THREE.Group;
}) => {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: layerName !== "core",
    opacity,
    depthWrite: layerName === "core",
    blending: layerName === "core" ? THREE.NormalBlending : THREE.AdditiveBlending,
    wireframe: layerName === "accent",
    vertexColors: true,
    fog: false,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
  mesh.count = count;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(mesh);

  return {
    material,
    mesh,
    name: layerName,
  } as const;
};

const createGroundLayer = ({
  color,
  count,
  geometry,
  opacity,
  root,
}: {
  color: string;
  count: number;
  geometry: THREE.CircleGeometry | THREE.RingGeometry;
  opacity: number;
  root: THREE.Group;
}) => {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
  mesh.count = count;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(mesh);

  return {
    material,
    mesh,
    name: "glow",
  } as const;
};

const createGuidePlane = ({
  color,
  length,
  opacity,
  root,
  width,
  xOffset,
  zOffset,
}: {
  color: string;
  length: number;
  opacity: number;
  root: THREE.Group;
  width: number;
  xOffset: number;
  zOffset: number;
}) => {
  const geometry = new THREE.PlaneGeometry(width, length, 1, Math.max(1, Math.round(length * 3)));
  geometry.rotateX(-Math.PI / 2);
  const basePositions = new Float32Array(geometry.attributes.position.array as ArrayLike<number>);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(xOffset, -2.06, zOffset);
  root.add(mesh);

  return {
    basePositions,
    geometry,
    material,
    mesh,
    xOffset,
    zOffset,
  } as const;
};

const createPulseHeroes = ({
  root,
}: {
  root: THREE.Group;
}) => {
  const geometry = new THREE.SphereGeometry(1, 28, 28);
  const materials = Array.from({length: 2}, () =>
    new THREE.MeshStandardMaterial({
      color: "#ffffff",
      emissive: "#ffffff",
      emissiveIntensity: 0.36,
      fog: false,
      metalness: 0.04,
      roughness: 0.26,
    }),
  );
  const meshes = materials.map((material) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    root.add(mesh);
    return mesh;
  });

  return {
    materials,
    meshes,
  } as const;
};

export const createLightsMeshes = ({
  accentColor,
  beamCount,
  coreColor,
  glowColor,
  root,
}: {
  accentColor: string;
  beamCount: number;
  coreColor: string;
  glowColor: string;
  root: THREE.Group;
}): ThreeLightsMeshBundle => {
  const orbGeometry = new THREE.SphereGeometry(1, 24, 24);
  const dotGeometry = new THREE.SphereGeometry(1, 10, 10);
  const groundDiscGeometry = new THREE.CircleGeometry(1, 40);
  const groundRingGeometry = new THREE.RingGeometry(0.78, 1, 40);
  const surfaceDotCount = Math.max(144, beamCount * 14);
  const starCount = Math.max(220, beamCount * 18);

  const floorTiles = Array.from({length: 4}, (_, index) => {
    const geometry = new THREE.PlaneGeometry(30, 18, 44, 42);
    geometry.rotateX(-Math.PI / 2);
    const basePositions = new Float32Array(geometry.attributes.position.array as ArrayLike<number>);

    const fillMaterial = new THREE.MeshBasicMaterial({
      color: coreColor,
      transparent: true,
      opacity: 0.1,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    const fillMesh = new THREE.Mesh(geometry, fillMaterial);
    fillMesh.position.set(0, -2.1, 0 - index * 18);
    root.add(fillMesh);

    const wireMaterial = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      wireframe: true,
    });
    const wireMesh = new THREE.Mesh(geometry, wireMaterial);
    wireMesh.position.copy(fillMesh.position);
    root.add(wireMesh);

    const guideRails = [
      createGuidePlane({
        color: glowColor,
        length: 18,
        opacity: 0.28,
        root,
        width: 0.24,
        xOffset: -7.85,
        zOffset: fillMesh.position.z,
      }),
      createGuidePlane({
        color: glowColor,
        length: 18,
        opacity: 0.28,
        root,
        width: 0.24,
        xOffset: 7.85,
        zOffset: fillMesh.position.z,
      }),
    ];

    const dashOffsets = [-6.2, -2.4, 1.4, 5.2];
    const guideDashes = [-6.9, 6.9].flatMap((xOffset) =>
      dashOffsets.map((offset) =>
        createGuidePlane({
          color: accentColor,
          length: 1.42,
          opacity: 0.34,
          root,
          width: 0.52,
          xOffset,
          zOffset: fillMesh.position.z + offset,
        }),
      ),
    );

    return {
      basePositions,
      fillMaterial,
      fillMesh,
      geometry,
      guideDashes,
      guideRails,
      wireMaterial,
      wireMesh,
    };
  });

  const horizon = createStageDisc({
    additive: true,
    color: Number.parseInt(accentColor.replace("#", ""), 16),
    opacity: 0.16,
    radius: 10,
    rotationX: 0,
    scaleX: 1.8,
    scaleY: 0.72,
    y: 5.4,
    z: -30,
    segments: 64,
  });
  const horizonMesh = horizon.mesh;
  root.add(horizonMesh);

  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: glowColor,
    size: 0.18,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    fog: true,
  });
  const starPoints = new THREE.Points(starGeometry, starMaterial);
  starPoints.frustumCulled = false;
  root.add(starPoints);
  const pulseHeroes = createPulseHeroes({root});

  return {
    orbGeometry,
    dotGeometry,
    groundDiscGeometry,
    groundRingGeometry,
    floorTiles,
    horizonGeometry: horizon.geometry,
    horizonMaterial: horizon.material,
    horizonMesh,
    pulseHeroes,
    signature: `orbs:${beamCount}`,
    stars: {
      colors: starColors,
      geometry: starGeometry,
      material: starMaterial,
      points: starPoints,
      positions: starPositions,
    },
    glow: createLayer({
      color: glowColor,
      count: beamCount,
      geometry: orbGeometry,
      layerName: "glow",
      opacity: 0.1,
      root,
    }),
    core: createLayer({
      color: coreColor,
      count: beamCount,
      geometry: orbGeometry,
      layerName: "core",
      opacity: 0.28,
      root,
    }),
    accent: createLayer({
      color: accentColor,
      count: beamCount,
      geometry: orbGeometry,
      layerName: "accent",
      opacity: 0.34,
      root,
    }),
    surfaceDots: createLayer({
      color: glowColor,
      count: surfaceDotCount,
      geometry: dotGeometry,
      layerName: "glow",
      opacity: 0.16,
      root,
    }),
    surfaceAccent: createLayer({
      color: accentColor,
      count: surfaceDotCount,
      geometry: dotGeometry,
      layerName: "core",
      opacity: 0.22,
      root,
    }),
    groundGlow: createGroundLayer({
      color: glowColor,
      count: beamCount,
      geometry: groundDiscGeometry,
      opacity: 0.14,
      root,
    }),
    groundAura: createGroundLayer({
      color: glowColor,
      count: beamCount,
      geometry: groundDiscGeometry,
      opacity: 0.055,
      root,
    }),
    groundRim: createGroundLayer({
      color: accentColor,
      count: beamCount,
      geometry: groundRingGeometry,
      opacity: 0.26,
      root,
    }),
  };
};
