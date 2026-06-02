import * as THREE from "three";

import type {EffectClock, EffectInputState, EffectViewport, NeonEnergyTunnelConfig, VisualEffectScene} from "../types";
import {clampToStep, damp, dampFactor, decay, disposeObject, createSeededRandom} from "./scene-utils";

const TAU = Math.PI * 2;
const DEPTH_SPACING = 1.08;
const RADIAL_LINE_COUNT = 34;

export const DEFAULT_NEON_ENERGY_TUNNEL_CONFIG: NeonEnergyTunnelConfig = {
  travelSpeed: 4.2,
  tunnelRadius: 2.15,
  segmentCount: 64,
  glowStrength: 1.15,
  distortionStrength: 0.72,
  particleDensity: 620,
};

export const sanitizeNeonEnergyTunnelConfig = (config: NeonEnergyTunnelConfig): NeonEnergyTunnelConfig => ({
  travelSpeed: clampToStep(config.travelSpeed, 0.6, 10, 0.1),
  tunnelRadius: clampToStep(config.tunnelRadius, 1.2, 3.3, 0.01),
  segmentCount: clampToStep(config.segmentCount, 36, 110, 1),
  glowStrength: clampToStep(config.glowStrength, 0.2, 2.5, 0.01),
  distortionStrength: clampToStep(config.distortionStrength, 0, 2, 0.01),
  particleDensity: clampToStep(config.particleDensity, 180, 1600, 20),
});

const wrappedZ = (index: number, travel: number, totalDepth: number) =>
  -(((index * DEPTH_SPACING + travel) % totalDepth) + 1.8);

const tunnelCenter = (
  z: number,
  travel: number,
  distortion: number,
  pointer: THREE.Vector2,
  target: THREE.Vector3,
) => {
  const depth = Math.abs(z);
  target.set(
    Math.sin(depth * 0.21 + travel * 0.035) * distortion * 0.48 + pointer.x * 0.22,
    Math.cos(depth * 0.17 - travel * 0.028) * distortion * 0.38 + pointer.y * 0.16,
    z,
  );
};

const tunnelRadius = (baseRadius: number, z: number, travel: number, distortion: number) =>
  baseRadius * (1 + Math.sin(Math.abs(z) * 0.62 + travel * 0.11) * distortion * 0.045);

export class NeonEnergyTunnelScene implements VisualEffectScene<NeonEnergyTunnelConfig> {
  private readonly renderer = new THREE.WebGLRenderer({antialias: true, alpha: false, powerPreference: "high-performance"});
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(68, 1, 0.1, 160);
  private readonly pointer = new THREE.Vector2();
  private readonly pointerTarget = new THREE.Vector2();
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly color = new THREE.Color();
  private ringMesh: THREE.InstancedMesh | null = null;
  private lattice: THREE.LineSegments | null = null;
  private streaks: THREE.LineSegments | null = null;
  private streakSeeds: Array<{angle: number; lane: number; speed: number; z: number; hue: number}> = [];
  private config: NeonEnergyTunnelConfig;
  private travel = 0;
  private drag = 0;
  private wheel = 0;
  private seed: number;

  constructor({config, seed = 1307}: {config: NeonEnergyTunnelConfig; seed?: number}) {
    this.config = sanitizeNeonEnergyTunnelConfig(config);
    this.seed = seed;
    this.renderer.setClearColor("#03040a", 1);
    this.scene.background = new THREE.Color("#03040a");
    this.scene.fog = new THREE.FogExp2("#03040a", 0.032);
    this.camera.position.set(0, 0, 0.2);
    this.rebuild();
  }

  mount(target: HTMLElement) {
    target.appendChild(this.renderer.domElement);
  }

  setConfig(config: NeonEnergyTunnelConfig) {
    const nextConfig = sanitizeNeonEnergyTunnelConfig(config);
    const shouldRebuild =
      nextConfig.segmentCount !== this.config.segmentCount ||
      nextConfig.particleDensity !== this.config.particleDensity;
    this.config = nextConfig;
    if (shouldRebuild) {
      this.rebuild();
    }
  }

  update({clock, input}: {clock: EffectClock; viewport: EffectViewport; input: EffectInputState}) {
    const delta = Math.min(0.05, Math.max(0.001, clock.delta));
    this.pointerTarget.set(input.pointerX, input.pointerY);
    this.pointer.lerp(this.pointerTarget, dampFactor(8.5, delta));
    this.drag = damp(this.drag, input.dragTarget, 7.5, delta);
    this.wheel = decay(input.wheel, 2.7, delta);
    const distortion = this.config.distortionStrength + this.drag * 1.1 + Math.abs(this.wheel) * 0.25;
    const speed = THREE.MathUtils.clamp(this.config.travelSpeed + this.drag * 1.35 + this.wheel * 0.8, 0.6, 12);
    this.travel += delta * speed * 5.2;

    this.updateRings(distortion);
    this.updateLattice(distortion);
    this.updateStreaks(distortion, speed);

    this.camera.position.x = damp(this.camera.position.x, this.pointer.x * 0.28, 5, delta);
    this.camera.position.y = damp(this.camera.position.y, this.pointer.y * 0.2, 5, delta);
    this.camera.lookAt(this.pointer.x * 1.1, this.pointer.y * 0.75, -8.4);
    this.renderer.render(this.scene, this.camera);
  }

  resize({height, pixelRatio, width}: EffectViewport) {
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    this.camera.aspect = safeWidth / safeHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(pixelRatio, 1.75));
    this.renderer.setSize(safeWidth, safeHeight, false);
  }

  dispose() {
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private rebuild() {
    if (this.ringMesh) {
      this.scene.remove(this.ringMesh);
      disposeObject(this.ringMesh);
    }
    if (this.lattice) {
      this.scene.remove(this.lattice);
      disposeObject(this.lattice);
    }
    if (this.streaks) {
      this.scene.remove(this.streaks);
      disposeObject(this.streaks);
    }

    const ringGeometry = new THREE.TorusGeometry(1, 0.014, 6, 96);
    const ringMaterial = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      transparent: true,
      vertexColors: true,
    });
    this.ringMesh = new THREE.InstancedMesh(ringGeometry, ringMaterial, this.config.segmentCount);
    this.ringMesh.frustumCulled = false;
    this.scene.add(this.ringMesh);

    const latticePositions = new Float32Array(RADIAL_LINE_COUNT * (this.config.segmentCount - 1) * 2 * 3);
    const latticeGeometry = new THREE.BufferGeometry();
    latticeGeometry.setAttribute("position", new THREE.BufferAttribute(latticePositions, 3));
    this.lattice = new THREE.LineSegments(
      latticeGeometry,
      new THREE.LineBasicMaterial({
        blending: THREE.AdditiveBlending,
        color: "#39f5ff",
        depthWrite: false,
        opacity: 0.3,
        transparent: true,
      }),
    );
    this.lattice.frustumCulled = false;
    this.scene.add(this.lattice);

    const random = createSeededRandom(this.seed++);
    const totalDepth = this.config.segmentCount * DEPTH_SPACING;
    this.streakSeeds = Array.from({length: this.config.particleDensity}, () => ({
      angle: random() * TAU,
      lane: THREE.MathUtils.lerp(0.32, 1.05, random()),
      speed: THREE.MathUtils.lerp(0.62, 1.55, random()),
      z: random() * totalDepth,
      hue: random(),
    }));
    const streakGeometry = new THREE.BufferGeometry();
    streakGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.streakSeeds.length * 2 * 3), 3));
    streakGeometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(this.streakSeeds.length * 2 * 3), 3));
    this.streaks = new THREE.LineSegments(
      streakGeometry,
      new THREE.LineBasicMaterial({
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        vertexColors: true,
      }),
    );
    this.streaks.frustumCulled = false;
    this.scene.add(this.streaks);
  }

  private updateRings(distortion: number) {
    if (!this.ringMesh) {
      return;
    }
    const totalDepth = this.config.segmentCount * DEPTH_SPACING;
    for (let i = 0; i < this.config.segmentCount; i += 1) {
      const z = wrappedZ(i, this.travel, totalDepth);
      const radius = tunnelRadius(this.config.tunnelRadius, z, this.travel, distortion);
      const pulse = Math.sin(Math.abs(z) * 0.62 + this.travel * 0.18 + i * 0.17);
      tunnelCenter(z, this.travel, distortion, this.pointer, this.position);
      this.scale.setScalar(radius * (1 + pulse * 0.025));
      this.quaternion.setFromEuler(
        new THREE.Euler(
          Math.sin(Math.abs(z) * 0.07 + this.travel * 0.02) * distortion * 0.06,
          Math.cos(Math.abs(z) * 0.065 - this.travel * 0.025) * distortion * 0.06,
          this.travel * 0.012 + i * 0.11,
        ),
      );
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.ringMesh.setMatrixAt(i, this.matrix);
      this.color.setHSL((0.55 + i * 0.021 + this.travel * 0.006) % 1, 0.95, 0.6);
      this.color.multiplyScalar(1.2 + this.config.glowStrength * 0.55 + Math.max(pulse, 0) * 0.22);
      this.ringMesh.setColorAt(i, this.color);
    }
    this.ringMesh.instanceMatrix.needsUpdate = true;
    if (this.ringMesh.instanceColor) {
      this.ringMesh.instanceColor.needsUpdate = true;
    }
  }

  private updateLattice(distortion: number) {
    if (!this.lattice) {
      return;
    }
    const geometry = this.lattice.geometry;
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    const array = positions.array as Float32Array;
    const totalDepth = this.config.segmentCount * DEPTH_SPACING;
    let cursor = 0;
    for (let radial = 0; radial < RADIAL_LINE_COUNT; radial += 1) {
      const baseAngle = (radial / RADIAL_LINE_COUNT) * TAU;
      for (let segment = 0; segment < this.config.segmentCount - 1; segment += 1) {
        for (let endpoint = 0; endpoint < 2; endpoint += 1) {
          const z = wrappedZ(segment + endpoint, this.travel, totalDepth);
          const radius = tunnelRadius(this.config.tunnelRadius, z, this.travel, distortion) * 1.01;
          const twist = this.travel * 0.018 + Math.sin(Math.abs(z) * 0.12 + this.travel * 0.03) * distortion * 0.12;
          const angle = baseAngle + twist;
          tunnelCenter(z, this.travel, distortion, this.pointer, this.position);
          array[cursor++] = this.position.x + Math.cos(angle) * radius;
          array[cursor++] = this.position.y + Math.sin(angle) * radius;
          array[cursor++] = z;
        }
      }
    }
    positions.needsUpdate = true;
  }

  private updateStreaks(distortion: number, speed: number) {
    if (!this.streaks) {
      return;
    }
    const geometry = this.streaks.geometry;
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
    const positionArray = positions.array as Float32Array;
    const colorArray = colors.array as Float32Array;
    const totalDepth = this.config.segmentCount * DEPTH_SPACING;
    const length = 0.45 + speed * 0.045 + distortion * 0.08;
    let p = 0;
    let c = 0;
    for (const seed of this.streakSeeds) {
      const z = -(((seed.z + this.travel * seed.speed) % totalDepth) + 1.2);
      const z2 = z + length;
      const radius = tunnelRadius(this.config.tunnelRadius, z, this.travel, distortion) * seed.lane;
      const angle = seed.angle + this.travel * 0.02;
      tunnelCenter(z, this.travel, distortion, this.pointer, this.position);
      const x = this.position.x + Math.cos(angle) * radius;
      const y = this.position.y + Math.sin(angle) * radius;
      positionArray[p++] = x;
      positionArray[p++] = y;
      positionArray[p++] = z;
      positionArray[p++] = x * 0.96;
      positionArray[p++] = y * 0.96;
      positionArray[p++] = z2;
      this.color.setHSL((0.55 + seed.hue * 0.16 + this.travel * 0.006) % 1, 0.95, 0.62);
      this.color.multiplyScalar(0.8 + this.config.glowStrength * 0.35);
      for (let endpoint = 0; endpoint < 2; endpoint += 1) {
        colorArray[c++] = this.color.r;
        colorArray[c++] = this.color.g;
        colorArray[c++] = this.color.b;
      }
    }
    positions.needsUpdate = true;
    colors.needsUpdate = true;
  }
}
