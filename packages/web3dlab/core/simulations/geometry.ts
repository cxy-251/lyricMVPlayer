import * as THREE from "three";

import type {EffectFrameContext, EffectViewport, VisualEffectAtom, VisualEffectLayer} from "../../types";
import {createSeededRandom} from "../../runtime/random";
import {
  createLayerTarget,
  PROCEDURAL_CONTROLS,
  type ProceduralEffectConfig,
  sanitizeProceduralConfig,
} from "./config";

export type GeometryKind = "fibonacci" | "city" | "tunnel" | "network" | "cloth" | "physics";

type InstanceSeed = {x: number; y: number; z: number; scale: number; phase: number};

const clothVertexShader = `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uAudio;
  uniform vec2 uPointer;
  varying float vWave;
  void main() {
    vec3 p = position;
    float pin = smoothstep(3.2, -3.2, p.y);
    float wave = sin(p.x * 1.8 + uTime * uSpeed * 2.2) * 0.18 + sin(p.y * 2.4 - uTime * 1.4) * 0.09;
    float pointerWave = exp(-length(p.xy / vec2(5.0, 3.2) - uPointer) * 3.2) * 0.45;
    p.z += (wave + pointerWave + uAudio * sin(p.x * 3.0) * 0.16) * pin;
    vWave = wave + pointerWave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const clothFragmentShader = `
  precision highp float;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform float uIntensity;
  varying float vWave;
  void main() {
    vec3 color = mix(uPrimary, uSecondary, clamp(vWave * 1.6 + 0.45, 0.0, 1.0));
    gl_FragColor = vec4(color * (0.75 + uIntensity * 0.35), 0.78);
  }
`;

class GeometryLayer implements VisualEffectLayer<ProceduralEffectConfig> {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
  private readonly target = createLayerTarget();
  private readonly root = new THREE.Group();
  private readonly resources: Array<{dispose(): void}> = [];
  private readonly seeds: InstanceSeed[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly kind: GeometryKind;
  private config: ProceduralEffectConfig;
  private instancedMesh: THREE.InstancedMesh | null = null;
  private clothMaterial: THREE.ShaderMaterial | null = null;

  constructor(kind: GeometryKind, seed: number, config: ProceduralEffectConfig) {
    this.kind = kind;
    this.config = config;
    this.scene.add(this.root);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(config.secondary, 2.4);
    key.position.set(-4, 7, 6);
    this.scene.add(key);
    if (kind === "city") this.scene.fog = new THREE.Fog("#01030a", 15, 36);
    this.camera.position.set(0, kind === "city" ? 7.6 : kind === "physics" ? 4.8 : 0.5, kind === "city" ? 17.5 : kind === "cloth" ? 8.4 : kind === "network" ? 8.2 : kind === "physics" ? 15.5 : 11);
    if (kind === "city") this.camera.lookAt(0, 1.1, 0);
    if (kind === "physics") this.camera.lookAt(0, 0.1, 0);
    this.build(seed);
  }

  setConfig(config: ProceduralEffectConfig) { this.config = config; }

  resize(viewport: EffectViewport) {
    const width = Math.max(1, Math.round(viewport.width * Math.min(2, viewport.pixelRatio)));
    const height = Math.max(1, Math.round(viewport.height * Math.min(2, viewport.pixelRatio)));
    this.target.setSize(width, height);
    this.camera.aspect = viewport.width / Math.max(1, viewport.height);
    this.camera.updateProjectionMatrix();
  }

  render(renderer: THREE.WebGLRenderer, context: EffectFrameContext) {
    const audio = (context.audio.energy * 0.5 + context.audio.bass * 0.35 + context.audio.onset * 0.15) * this.config.audioReactivity;
    const t = context.time * this.config.speed;
    if (this.kind === "fibonacci") {
      this.root.rotation.y = t * 0.22 + context.pointer.x * 0.46;
      this.root.rotation.x = Math.sin(t * 0.17) * 0.12 + context.pointer.y * 0.34;
      this.root.scale.setScalar(this.config.scale * (1 + audio * 0.06));
    } else if (this.kind === "city") {
      this.root.scale.setScalar(this.config.scale);
      this.root.rotation.y = Math.sin(t * 0.08) * 0.12 + context.pointer.x * 0.08;
      this.camera.position.x = Math.sin(t * 0.12) * 1.6 + context.pointer.x * 1.8;
      this.camera.position.y = 7.6 + context.pointer.y * 0.7;
      this.camera.lookAt(context.pointer.x * 0.55, 1.1 + context.pointer.y * 0.35, 0);
      const scanner = this.root.getObjectByName("city-scanner");
      if (scanner) scanner.position.y = -2.7 + ((t * 0.65) % 6.8);
    } else if (this.kind === "tunnel" && this.instancedMesh) {
      this.seeds.forEach((item, index) => {
        const z = ((item.z + t * 5 + 18) % 36) - 18;
        this.dummy.position.set(0, 0, z);
        this.dummy.rotation.set(Math.sin(item.phase) * 0.025, Math.cos(item.phase) * 0.025, item.phase * 0.035 + t * 0.08);
        this.dummy.scale.setScalar(this.config.scale * (0.72 + audio * 0.12));
        this.dummy.updateMatrix();
        this.instancedMesh!.setMatrixAt(index, this.dummy.matrix);
      });
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      this.camera.position.x = context.pointer.x * 0.45;
      this.camera.position.y = context.pointer.y * 0.3;
    } else if (this.kind === "physics" && this.instancedMesh) {
      this.seeds.forEach((item, index) => {
        const cycle = (t * (0.35 + item.scale * 0.18) + item.phase * 6) % 8;
        const parabola = 1 - Math.pow(cycle / 4 - 1, 2);
        const impulse = context.pointer.pressed * Math.sin(index * 2.17 + t * 3.2) * (0.35 + item.scale);
        this.dummy.position.set(item.x + impulse + context.pointer.x * item.scale * 0.35, -2.75 + Math.max(0, parabola) * (5.2 + item.y) + Math.abs(impulse) * 0.8, item.z + context.pointer.y * item.scale * 0.28);
        this.dummy.rotation.set(t * item.scale + item.phase, t * 0.7 + item.phase * 3, t * 0.45);
        this.dummy.scale.setScalar(item.scale * this.config.scale);
        this.dummy.updateMatrix();
        this.instancedMesh!.setMatrixAt(index, this.dummy.matrix);
      });
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      this.root.rotation.y = context.pointer.x * 0.22;
      this.root.rotation.x = context.pointer.y * 0.07;
      this.camera.position.x = context.pointer.x * 1.1;
      this.camera.position.y = 4.8 + context.pointer.y * 0.55;
      this.camera.lookAt(0, 0.1, 0);
      const hero = this.root.getObjectByName("physics-hero");
      if (hero) hero.scale.setScalar(1 + audio * 0.18 + context.pointer.pressed * 0.16);
    } else if (this.kind === "network") {
      this.root.rotation.y = t * 0.08 + context.pointer.x * 0.12;
      this.root.rotation.x = Math.sin(t * 0.12) * 0.08 + context.pointer.y * 0.08;
      this.root.scale.setScalar(this.config.scale * (1 + audio * 0.04));
      const line = this.root.children.find((child) => child instanceof THREE.LineSegments) as THREE.LineSegments | undefined;
      if (line && line.material instanceof THREE.LineBasicMaterial) line.material.opacity = 0.34 + audio * 0.34;
    } else if (this.kind === "cloth" && this.clothMaterial) {
      this.clothMaterial.uniforms.uTime.value = context.time;
      this.clothMaterial.uniforms.uSpeed.value = this.config.speed;
      this.clothMaterial.uniforms.uAudio.value = audio;
      this.clothMaterial.uniforms.uPointer.value.set(context.pointer.x, context.pointer.y);
      this.clothMaterial.uniforms.uPrimary.value.set(this.config.primary);
      this.clothMaterial.uniforms.uSecondary.value.set(this.config.secondary);
      this.clothMaterial.uniforms.uIntensity.value = this.config.intensity;
      this.root.scale.setScalar(this.config.scale);
    }

    this.updateMaterials();
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(this.scene, this.camera);
    return this.target.texture;
  }

  dispose() {
    this.resources.forEach((resource) => resource.dispose());
    this.target.dispose();
  }

  private build(seed: number) {
    const random = createSeededRandom(seed);
    if (this.kind === "fibonacci") {
      const count = 420;
      const geometry = new THREE.SphereGeometry(0.065, 8, 8);
      const material = new THREE.MeshStandardMaterial({color: this.config.primary, emissive: this.config.secondary, emissiveIntensity: 0.24, metalness: 0.82, roughness: 0.18, transparent: true, opacity: 0.94});
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      for (let index = 0; index < count; index += 1) {
        const y = 1 - (index / (count - 1)) * 2;
        const radius = Math.sqrt(1 - y * y);
        const theta = Math.PI * (3 - Math.sqrt(5)) * index;
        this.dummy.position.set(Math.cos(theta) * radius * 3.15, y * 3.15, Math.sin(theta) * radius * 3.15);
        this.dummy.scale.setScalar(0.55 + random() * 1.05);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(index, this.dummy.matrix);
      }
      this.root.add(mesh); this.resources.push(geometry, material);
      const cageGeometry = new THREE.IcosahedronGeometry(3.18, 2);
      const cageMaterial = new THREE.MeshBasicMaterial({color: this.config.secondary, transparent: true, opacity: 0.08, wireframe: true});
      this.root.add(new THREE.Mesh(cageGeometry, cageMaterial)); this.resources.push(cageGeometry, cageMaterial);
    } else if (this.kind === "city") {
      const count = 280;
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshStandardMaterial({color: "#d8efff", emissive: this.config.secondary, emissiveIntensity: 0.16, metalness: 0.72, roughness: 0.26, transparent: true, opacity: 0.93});
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      const roofPositions = new Float32Array(count * 3);
      for (let index = 0; index < count; index += 1) {
        const x = (random() - 0.5) * 16;
        const z = (random() - 0.5) * 22;
        const height = 0.65 + Math.pow(random(), 2.35) * 7.8;
        this.dummy.position.set(x, height / 2 - 3, z);
        this.dummy.scale.set(0.28 + random() * 0.6, height, 0.28 + random() * 0.6);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(index, this.dummy.matrix);
        const towerColor = new THREE.Color().setHSL(0.5 + random() * 0.42, 0.76, 0.3 + random() * 0.27);
        if (index % 7 === 0) towerColor.setHSL(0.88 + random() * 0.08, 0.86, 0.56);
        mesh.setColorAt(index, towerColor);
        roofPositions.set([x, height - 3 + 0.08, z], index * 3);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.root.add(mesh); this.resources.push(geometry, material);
      const roofGeometry = new THREE.BufferGeometry();
      roofGeometry.setAttribute("position", new THREE.BufferAttribute(roofPositions, 3));
      const roofMaterial = new THREE.PointsMaterial({blending: THREE.AdditiveBlending, color: "#8ffff8", depthWrite: false, size: 0.085, transparent: true, opacity: 0.9});
      this.root.add(new THREE.Points(roofGeometry, roofMaterial)); this.resources.push(roofGeometry, roofMaterial);
      const grid = new THREE.GridHelper(22, 36, this.config.secondary, this.config.primary);
      grid.position.y = -3; this.root.add(grid);
      if (Array.isArray(grid.material)) grid.material.forEach((materialItem) => this.resources.push(materialItem));
      else this.resources.push(grid.material);
      const scannerGeometry = new THREE.RingGeometry(0.8, 8.2, 96);
      const scannerMaterial = new THREE.MeshBasicMaterial({color: "#67fff0", blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.16, side: THREE.DoubleSide, transparent: true});
      const scanner = new THREE.Mesh(scannerGeometry, scannerMaterial);
      scanner.name = "city-scanner"; scanner.rotation.x = -Math.PI / 2; scanner.position.y = -2.7;
      this.root.add(scanner); this.resources.push(scannerGeometry, scannerMaterial);
    } else if (this.kind === "tunnel") {
      const count = 72;
      const geometry = new THREE.TorusGeometry(2.5, 0.026, 5, 52);
      const material = new THREE.MeshBasicMaterial({color: this.config.primary, transparent: true, opacity: 0.72});
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      for (let index = 0; index < count; index += 1) this.seeds.push({x: 0, y: 0, z: index / count * 36 - 18, scale: 1, phase: index * 0.24});
      this.instancedMesh = mesh; this.root.add(mesh); this.resources.push(geometry, material);
    } else if (this.kind === "network") {
      const points: THREE.Vector3[] = [];
      for (let index = 0; index < 110; index += 1) {
        const radius = 4.2 * Math.cbrt(random());
        const theta = random() * Math.PI * 2;
        const phi = Math.acos(random() * 2 - 1);
        points.push(new THREE.Vector3(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta)));
      }
      const segments: number[] = [];
      points.forEach((point, index) => points.slice(index + 1).forEach((other) => {
        if (point.distanceToSquared(other) < 4.2) segments.push(point.x, point.y, point.z, other.x, other.y, other.z);
      }));
      const lineGeometry = new THREE.BufferGeometry(); lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(segments, 3));
      const lineMaterial = new THREE.LineBasicMaterial({blending: THREE.AdditiveBlending, color: this.config.secondary, transparent: true, opacity: 0.46});
      this.root.add(new THREE.LineSegments(lineGeometry, lineMaterial)); this.resources.push(lineGeometry, lineMaterial);
      const nodeGeometry = new THREE.SphereGeometry(0.014, 10, 8);
      const nodeMaterial = new THREE.MeshBasicMaterial({blending: THREE.AdditiveBlending, color: this.config.primary, transparent: true, opacity: 0.76});
      const nodes = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, points.length);
      points.forEach((point, index) => {
        this.dummy.position.copy(point);
        this.dummy.scale.setScalar(0.8 + (index % 7) * 0.08);
        this.dummy.updateMatrix();
        nodes.setMatrixAt(index, this.dummy.matrix);
      });
      this.root.add(nodes); this.resources.push(nodeGeometry, nodeMaterial);
    } else if (this.kind === "cloth") {
      const geometry = new THREE.PlaneGeometry(8, 5, 46, 30);
      const material = new THREE.ShaderMaterial({vertexShader: clothVertexShader, fragmentShader: clothFragmentShader, side: THREE.DoubleSide, wireframe: true, transparent: true, uniforms: {
        uTime: {value: 0}, uSpeed: {value: this.config.speed}, uAudio: {value: 0}, uPointer: {value: new THREE.Vector2()},
        uPrimary: {value: new THREE.Color(this.config.primary)}, uSecondary: {value: new THREE.Color(this.config.secondary)}, uIntensity: {value: this.config.intensity},
      }});
      this.clothMaterial = material; this.root.add(new THREE.Mesh(geometry, material)); this.resources.push(geometry, material);
    } else {
      const count = 92;
      const geometry = new THREE.BoxGeometry(0.64, 0.64, 0.64);
      const material = new THREE.MeshStandardMaterial({color: "#ffffff", emissive: this.config.secondary, emissiveIntensity: 0.2, metalness: 0.7, roughness: 0.18, transparent: true, opacity: 0.92});
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      const palette = ["#39dfff", "#736dff", "#ff4fc3", "#f5fbff"];
      for (let index = 0; index < count; index += 1) {
        this.seeds.push({x: (random() - 0.5) * 9, y: random() * 2.6, z: (random() - 0.5) * 5, scale: 0.28 + random() * 0.58, phase: random()});
        mesh.setColorAt(index, new THREE.Color(palette[index % palette.length]));
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.instancedMesh = mesh; this.root.add(mesh); this.resources.push(geometry, material);
      const heroGeometry = new THREE.IcosahedronGeometry(1.25, 4);
      const heroMaterial = new THREE.MeshStandardMaterial({color: "#ff4aaa", emissive: "#ff087f", emissiveIntensity: 0.92, metalness: 0.38, roughness: 0.2});
      const hero = new THREE.Mesh(heroGeometry, heroMaterial); hero.name = "physics-hero"; hero.position.set(0, -1.05, 0); this.root.add(hero); this.resources.push(heroGeometry, heroMaterial);
      const floorGeometry = new THREE.CircleGeometry(7.4, 96);
      const floorMaterial = new THREE.MeshStandardMaterial({color: "#030713", emissive: "#122868", emissiveIntensity: 0.22, metalness: 0.9, roughness: 0.16, side: THREE.DoubleSide});
      const floor = new THREE.Mesh(floorGeometry, floorMaterial); floor.rotation.x = -Math.PI / 2; floor.position.y = -3.08; this.root.add(floor); this.resources.push(floorGeometry, floorMaterial);
      const floorGrid = new THREE.GridHelper(14, 24, "#62eaff", "#182759"); floorGrid.position.y = -3.04; this.root.add(floorGrid);
      if (Array.isArray(floorGrid.material)) floorGrid.material.forEach((item) => this.resources.push(item)); else this.resources.push(floorGrid.material);
    }
  }

  private updateMaterials() {
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
      if (this.kind === "city" || this.kind === "physics") {
        if (object.name === "physics-hero") return;
        object.material.emissive.set(this.config.secondary);
        object.material.emissiveIntensity = this.kind === "physics" ? 0.28 + this.config.intensity * 0.18 : 0.08 + this.config.intensity * 0.12;
        return;
      }
      object.material.color.set(this.config.primary);
      object.material.emissive.set(this.config.secondary);
      object.material.emissiveIntensity = 0.25 + this.config.intensity * 0.3;
    });
  }
}

export const createGeometryAtom = (options: {
  id: string;
  title: string;
  description: string;
  kind: GeometryKind;
  defaults: ProceduralEffectConfig;
  audio?: boolean;
  pointer?: boolean;
}): VisualEffectAtom<ProceduralEffectConfig> => ({
  id: options.id,
  title: options.title,
  description: options.description,
  tags: ["three", options.kind],
  defaultConfig: options.defaults,
  controls: PROCEDURAL_CONTROLS,
  capabilities: {audio: options.audio, pointer: options.pointer, gpuHeavy: options.kind === "city"},
  sanitizeConfig: (value) => sanitizeProceduralConfig(value, options.defaults),
  createLayer: ({seed, config}) => new GeometryLayer(options.kind, seed, config),
});
