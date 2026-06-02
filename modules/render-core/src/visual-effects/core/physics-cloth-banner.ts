import * as THREE from "three";

import type {EffectClock, EffectInputState, EffectViewport, PhysicsClothBannerConfig, VisualEffectScene} from "../types";
import {clampToStep, damp, dampFactor, disposeObject, createSeededRandom} from "./scene-utils";

type ClothPoint = {
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  pz: number;
  bx: number;
  by: number;
  pinned: boolean;
};

export const DEFAULT_PHYSICS_CLOTH_BANNER_CONFIG: PhysicsClothBannerConfig = {
  windStrength: 0.82,
  damping: 0.965,
  clothResolution: 24,
  interactionRadius: 0.62,
  interactionStrength: 1.1,
  glowStrength: 1.05,
};

export const sanitizePhysicsClothBannerConfig = (config: PhysicsClothBannerConfig): PhysicsClothBannerConfig => ({
  windStrength: clampToStep(config.windStrength, 0, 2.2, 0.01),
  damping: clampToStep(config.damping, 0.9, 0.995, 0.001),
  clothResolution: clampToStep(config.clothResolution, 14, 32, 1),
  interactionRadius: clampToStep(config.interactionRadius, 0.25, 1.4, 0.01),
  interactionStrength: clampToStep(config.interactionStrength, 0, 2.5, 0.01),
  glowStrength: clampToStep(config.glowStrength, 0, 2.5, 0.01),
});

export class PhysicsClothBannerScene implements VisualEffectScene<PhysicsClothBannerConfig> {
  private readonly renderer = new THREE.WebGLRenderer({antialias: true, alpha: false, powerPreference: "high-performance"});
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 60);
  private readonly light = new THREE.PointLight("#76f8ff", 8, 14);
  private readonly pointer = new THREE.Vector2();
  private readonly pointerTarget = new THREE.Vector2();
  private readonly rayPoint = new THREE.Vector3();
  private config: PhysicsClothBannerConfig;
  private geometry: THREE.PlaneGeometry | null = null;
  private clothMesh: THREE.Mesh | null = null;
  private wireMesh: THREE.Mesh | null = null;
  private sparks: THREE.Points | null = null;
  private points: ClothPoint[] = [];
  private cols = 0;
  private rows = 0;
  private restX = 0;
  private restY = 0;
  private drag = 0;
  private lastClickCount = 0;
  private rippleAge = 99;
  private rippleX = 0;
  private rippleY = 0;
  private seed: number;

  constructor({config, seed = 1307}: {config: PhysicsClothBannerConfig; seed?: number}) {
    this.config = sanitizePhysicsClothBannerConfig(config);
    this.seed = seed;
    this.renderer.setClearColor("#03040a", 1);
    this.scene.background = new THREE.Color("#03040a");
    this.scene.fog = new THREE.Fog("#03040a", 5, 14);
    this.camera.position.set(0, 0.15, 6.3);
    this.light.position.set(0, 2.2, 2.8);
    this.scene.add(this.light);
    this.rebuild();
  }

  mount(target: HTMLElement) {
    target.appendChild(this.renderer.domElement);
  }

  setConfig(config: PhysicsClothBannerConfig) {
    const nextConfig = sanitizePhysicsClothBannerConfig(config);
    if (nextConfig.clothResolution !== this.config.clothResolution) {
      this.config = nextConfig;
      this.rebuild();
      return;
    }
    this.config = nextConfig;
  }

  update({clock, input}: {clock: EffectClock; viewport: EffectViewport; input: EffectInputState}) {
    const delta = Math.min(0.035, Math.max(0.001, clock.delta));
    this.pointerTarget.set(input.pointerX, input.pointerY);
    this.pointer.lerp(this.pointerTarget, dampFactor(10, delta));
    this.drag = damp(this.drag, input.dragTarget, 8, delta);
    if (input.clickCount !== this.lastClickCount) {
      this.lastClickCount = input.clickCount;
      this.rippleAge = 0;
      this.rippleX = this.pointer.x * 2.25;
      this.rippleY = this.pointer.y * 1.25;
    }
    this.rippleAge += delta;
    this.simulate(delta, clock.time);
    this.updateGeometry();
    this.updateSparks(clock.time);
    this.light.intensity = 7 + this.config.glowStrength * 5;
    this.camera.position.x = damp(this.camera.position.x, this.pointer.x * 0.18, 3.5, delta);
    this.camera.position.y = damp(this.camera.position.y, 0.15 + this.pointer.y * 0.08, 3.5, delta);
    this.camera.lookAt(0, -0.1, 0);
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
    if (this.clothMesh) {
      this.scene.remove(this.clothMesh);
    }
    if (this.wireMesh) {
      this.scene.remove(this.wireMesh);
    }
    if (this.sparks) {
      this.scene.remove(this.sparks);
    }
    this.geometry?.dispose();

    this.cols = this.config.clothResolution;
    this.rows = Math.max(9, Math.round(this.cols * 0.64));
    const width = 4.8;
    const height = 2.9;
    this.restX = width / (this.cols - 1);
    this.restY = height / (this.rows - 1);
    this.geometry = new THREE.PlaneGeometry(width, height, this.cols - 1, this.rows - 1);
    this.points = [];
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.cols; x += 1) {
        const bx = -width / 2 + x * this.restX;
        const by = height / 2 - y * this.restY;
        const z = Math.sin(x * 0.4 + y * 0.23) * 0.045;
        this.points.push({x: bx, y: by, z, px: bx, py: by, pz: z, bx, by, pinned: y === 0});
      }
    }

    this.clothMesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshBasicMaterial({
        color: "#64eaff",
        opacity: 0.13,
        side: THREE.DoubleSide,
        transparent: true,
      }),
    );
    this.wireMesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshBasicMaterial({
        blending: THREE.AdditiveBlending,
        color: "#a8fff5",
        opacity: 0.58,
        side: THREE.DoubleSide,
        transparent: true,
        wireframe: true,
      }),
    );
    this.scene.add(this.clothMesh, this.wireMesh);

    const random = createSeededRandom(this.seed++);
    const sparkPositions = new Float32Array(140 * 3);
    for (let i = 0; i < 140; i += 1) {
      sparkPositions[i * 3] = (random() > 0.5 ? 1 : -1) * (2.25 + random() * 0.6);
      sparkPositions[i * 3 + 1] = THREE.MathUtils.lerp(-1.45, 1.45, random());
      sparkPositions[i * 3 + 2] = THREE.MathUtils.lerp(-0.4, 0.5, random());
    }
    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
    this.sparks = new THREE.Points(
      sparkGeometry,
      new THREE.PointsMaterial({
        blending: THREE.AdditiveBlending,
        color: "#7ff8ff",
        depthWrite: false,
        opacity: 0.62,
        size: 0.025,
        transparent: true,
      }),
    );
    this.scene.add(this.sparks);
  }

  private index(x: number, y: number) {
    return y * this.cols + x;
  }

  private simulate(delta: number, time: number) {
    const pointerWorldX = this.pointer.x * 2.35;
    const pointerWorldY = this.pointer.y * 1.35;
    for (const point of this.points) {
      if (point.pinned) {
        point.x = point.bx;
        point.y = point.by;
        point.z = Math.sin(time * 1.4 + point.bx * 1.2) * 0.025;
        point.px = point.x;
        point.py = point.y;
        point.pz = point.z;
        continue;
      }

      const vx = (point.x - point.px) * this.config.damping;
      const vy = (point.y - point.py) * this.config.damping;
      const vz = (point.z - point.pz) * this.config.damping;
      point.px = point.x;
      point.py = point.y;
      point.pz = point.z;
      const wind = Math.sin(time * 1.7 + point.bx * 1.3 + point.by * 1.8) * this.config.windStrength * 0.018;
      point.x += vx;
      point.y += vy - 0.16 * delta * delta;
      point.z += vz + wind;

      const dx = point.x - pointerWorldX;
      const dy = point.y - pointerWorldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const influence = Math.max(0, 1 - dist / this.config.interactionRadius);
      if (influence > 0) {
        const force = influence * influence * this.config.interactionStrength * (0.045 + this.drag * 0.065);
        point.z += force;
        point.x += dx * force * 0.08;
        point.y += dy * force * 0.04;
      }

      if (this.rippleAge < 1.25) {
        const rx = point.x - this.rippleX;
        const ry = point.y - this.rippleY;
        const radius = this.rippleAge * 2.8;
        const wave = Math.exp(-Math.pow(Math.sqrt(rx * rx + ry * ry) - radius, 2) * 5.5) * (1 - this.rippleAge / 1.25);
        point.z += wave * 0.08 * this.config.interactionStrength;
      }
    }

    for (let iteration = 0; iteration < 3; iteration += 1) {
      for (let y = 0; y < this.rows; y += 1) {
        for (let x = 0; x < this.cols; x += 1) {
          if (x < this.cols - 1) {
            this.satisfy(this.points[this.index(x, y)], this.points[this.index(x + 1, y)], this.restX);
          }
          if (y < this.rows - 1) {
            this.satisfy(this.points[this.index(x, y)], this.points[this.index(x, y + 1)], this.restY);
          }
        }
      }
    }
  }

  private satisfy(a: ClothPoint, b: ClothPoint, rest: number) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const correction = (length - rest) / length;
    const cx = dx * correction * 0.5;
    const cy = dy * correction * 0.5;
    const cz = dz * correction * 0.5;
    if (!a.pinned) {
      a.x += cx;
      a.y += cy;
      a.z += cz;
    }
    if (!b.pinned) {
      b.x -= cx;
      b.y -= cy;
      b.z -= cz;
    }
  }

  private updateGeometry() {
    if (!this.geometry) {
      return;
    }
    const position = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    const array = position.array as Float32Array;
    for (let i = 0; i < this.points.length; i += 1) {
      const point = this.points[i];
      array[i * 3] = point.x;
      array[i * 3 + 1] = point.y;
      array[i * 3 + 2] = point.z;
    }
    position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    if (this.wireMesh?.material instanceof THREE.MeshBasicMaterial) {
      this.wireMesh.material.opacity = 0.36 + this.config.glowStrength * 0.13;
    }
  }

  private updateSparks(time: number) {
    if (!this.sparks) {
      return;
    }
    const position = this.sparks.geometry.getAttribute("position") as THREE.BufferAttribute;
    const array = position.array as Float32Array;
    for (let i = 0; i < array.length / 3; i += 1) {
      array[i * 3 + 1] += Math.sin(time * 1.7 + i) * 0.0009;
      array[i * 3 + 2] += Math.cos(time * 1.3 + i * 0.7) * 0.0008;
    }
    position.needsUpdate = true;
  }
}
