import * as THREE from "three";
import {createStageDisc} from "../../../shared/createStageDisc";
import type {ThreeDonutMeshBundle} from "../donut-spin.types";

export const createDonutMeshes = ({
  pearlCount,
  primaryColor,
  radius,
  root,
  secondaryColor,
  tubeRadius,
}: {
  pearlCount: number;
  primaryColor: string;
  radius: number;
  root: THREE.Group;
  secondaryColor: string;
  tubeRadius: number;
}): ThreeDonutMeshBundle => {
  const bodyGeometry = new THREE.TorusGeometry(radius, tubeRadius, 42, 160);
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: primaryColor,
    roughness: 0.24,
    metalness: 0.16,
    clearcoat: 0.82,
    clearcoatRoughness: 0.18,
    emissive: new THREE.Color(primaryColor).multiplyScalar(0.028),
    sheen: 0.22,
    sheenColor: new THREE.Color(secondaryColor),
  });
  const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);

  const glowGeometry = new THREE.TorusGeometry(radius * 1.015, tubeRadius * 1.18, 28, 128);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: secondaryColor,
    transparent: true,
    opacity: 0.028,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);

  const wireGeometry = new THREE.TorusGeometry(radius * 1.028, tubeRadius * 0.22, 12, 96);
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: secondaryColor,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    wireframe: true,
  });
  const wireMesh = new THREE.Mesh(wireGeometry, wireMaterial);

  const pearlGeometry = new THREE.SphereGeometry(tubeRadius * 0.52, 20, 20);
  const pearlMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(secondaryColor).multiplyScalar(0.08),
    emissiveIntensity: 0.72,
    roughness: 0.32,
    metalness: 0.12,
    transparent: true,
    opacity: 0.92,
    vertexColors: true,
  });
  const pearlMesh = new THREE.InstancedMesh(pearlGeometry, pearlMaterial, pearlCount);
  pearlMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const shadowDisc = createStageDisc({
    color: 0x04070b,
    opacity: 0.14,
    radius: radius * 3.4,
    scaleY: 0.84,
    y: -radius * 1.72,
  });
  const haloDisc = createStageDisc({
    additive: true,
    color: 0x000000,
    opacity: 0,
    radius: radius * 4.6,
    scaleY: 0.92,
    y: -radius * 1.75,
    z: 0.05,
    segments: 64,
  });

  root.add(bodyMesh, glowMesh, wireMesh, pearlMesh);

  return {
    bodyGeometry,
    bodyMaterial,
    bodyMesh,
    glowGeometry,
    glowMaterial,
    glowMesh,
    wireGeometry,
    wireMaterial,
    wireMesh,
    pearlGeometry,
    pearlMaterial,
    pearlMesh,
    shadowDisc,
    haloDisc,
    signature: `${radius.toFixed(3)}:${tubeRadius.toFixed(3)}:${pearlCount}:${primaryColor}:${secondaryColor}`,
  };
};
