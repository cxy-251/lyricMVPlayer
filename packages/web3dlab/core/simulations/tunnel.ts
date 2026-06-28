import * as THREE from "three";
import type { EffectFrameContext, EffectViewport, VisualEffectAtom, VisualEffectLayer } from "../../types";
import { createSeededRandom } from "../../runtime/random";
import { createLayerTarget } from "./config";
import { clamp, record, resizeTarget, disposeScene, disposeSceneObject, controls } from "./utils";

type TunnelConfig = {
  travelSpeed: number;
  tunnelRadius: number;
  segmentCount: number;
  glowStrength: number;
  distortionStrength: number;
  particleDensity: number;
  audioReactivity: number;
};

const tunnelDefaults: TunnelConfig = {travelSpeed: 4.2, tunnelRadius: 2.15, segmentCount: 64, glowStrength: 1.15, distortionStrength: 0.72, particleDensity: 620, audioReactivity: 0.65};
const sanitizeTunnel = (value: unknown): TunnelConfig => {
  const source = record(value);
  return {
    travelSpeed: clamp(source.travelSpeed, tunnelDefaults.travelSpeed, 0.6, 10),
    tunnelRadius: clamp(source.tunnelRadius, tunnelDefaults.tunnelRadius, 1.2, 3.3),
    segmentCount: Math.round(clamp(source.segmentCount, tunnelDefaults.segmentCount, 36, 110)),
    glowStrength: clamp(source.glowStrength, tunnelDefaults.glowStrength, 0.2, 2.5),
    distortionStrength: clamp(source.distortionStrength, tunnelDefaults.distortionStrength, 0, 2),
    particleDensity: Math.round(clamp(source.particleDensity, tunnelDefaults.particleDensity, 180, 1600) / 20) * 20,
    audioReactivity: clamp(source.audioReactivity, tunnelDefaults.audioReactivity, 0, 2),
  };
};

type StreakSeed = {angle: number; lane: number; speed: number; z: number; hue: number};

class SignatureTunnelLayer implements VisualEffectLayer<TunnelConfig> {
  private readonly target = createLayerTarget();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(68, 1, 0.1, 160);
  private readonly position = new THREE.Vector3();
  private readonly color = new THREE.Color();
  private ringLines: THREE.LineSegments | null = null;
  private lattice: THREE.LineSegments | null = null;
  private streaks: THREE.LineSegments | null = null;
  private streakSeeds: StreakSeed[] = [];
  private config: TunnelConfig;
  private readonly seed: number;

  constructor(seed: number, config: TunnelConfig) {
    this.seed = seed;
    this.config = config;
    this.camera.position.z = 0.2;
    this.scene.fog = new THREE.FogExp2("#03040a", 0.032);
    this.rebuild();
  }

  setConfig(config: TunnelConfig) {
    const structural = config.segmentCount !== this.config.segmentCount || config.particleDensity !== this.config.particleDensity;
    this.config = config;
    if (structural) this.rebuild();
  }

  resize(viewport: EffectViewport) {
    resizeTarget(this.target, viewport);
    this.camera.aspect = viewport.width / Math.max(1, viewport.height);
    this.camera.updateProjectionMatrix();
  }

  render(renderer: THREE.WebGLRenderer, context: EffectFrameContext) {
    const audio = (context.audio.energy * 0.45 + context.audio.bass * 0.25 + context.audio.onset * 0.3) * this.config.audioReactivity;
    const travel = context.time * (this.config.travelSpeed + audio * 2.2) * 5.2;
    const distortion = this.config.distortionStrength + context.pointer.pressed * 1.1 + audio * 0.4;
    const pointer = new THREE.Vector2(context.pointer.x, context.pointer.y);
    const totalDepth = this.config.segmentCount * 1.08;
    const center = (z: number) => this.position.set(
      Math.sin(Math.abs(z) * 0.21 + travel * 0.035) * distortion * 0.48 + pointer.x * 0.22,
      Math.cos(Math.abs(z) * 0.17 - travel * 0.028) * distortion * 0.38 + pointer.y * 0.16,
      z,
    );
    const radiusAt = (z: number) => this.config.tunnelRadius * (1 + Math.sin(Math.abs(z) * 0.62 + travel * 0.11) * distortion * 0.045);
    if (this.ringLines) {
      const ringPositions = this.ringLines.geometry.getAttribute("position") as THREE.BufferAttribute;
      const ringColors = this.ringLines.geometry.getAttribute("color") as THREE.BufferAttribute;
      const positionValues = ringPositions.array as Float32Array;
      const colorValues = ringColors.array as Float32Array;
      let positionCursor = 0;
      let colorCursor = 0;
      const ringSides = 72;
      for (let index = 0; index < this.config.segmentCount; index += 1) {
        const z = -(((index * 1.08 + travel) % totalDepth) + 1.8);
        const pulse = Math.sin(Math.abs(z) * 0.62 + travel * 0.18 + index * 0.17);
        center(z);
        const centerX = this.position.x;
        const centerY = this.position.y;
        const radius = radiusAt(z) * (1 + pulse * 0.025);
        const twist = travel * 0.012 + index * 0.11;
        const hue = 0.53 + index / Math.max(1, this.config.segmentCount - 1) * 0.34 + Math.sin(travel * 0.006) * 0.012;
        this.color.setHSL(hue, 0.96, 0.62);
        this.color.multiplyScalar(1.35 + this.config.glowStrength * 0.48 + audio * 0.62);
        for (let side = 0; side < ringSides; side += 1) {
          for (let endpoint = 0; endpoint < 2; endpoint += 1) {
            const angle = (side + endpoint) / ringSides * Math.PI * 2 + twist;
            positionValues[positionCursor++] = centerX + Math.cos(angle) * radius;
            positionValues[positionCursor++] = centerY + Math.sin(angle) * radius;
            positionValues[positionCursor++] = z;
            colorValues[colorCursor++] = this.color.r;
            colorValues[colorCursor++] = this.color.g;
            colorValues[colorCursor++] = this.color.b;
          }
        }
      }
      ringPositions.needsUpdate = true;
      ringColors.needsUpdate = true;
    }
    if (this.lattice) {
      const attribute = this.lattice.geometry.getAttribute("position") as THREE.BufferAttribute;
      const values = attribute.array as Float32Array;
      let cursor = 0;
      for (let radial = 0; radial < 34; radial += 1) {
        const base = radial / 34 * Math.PI * 2;
        for (let segment = 0; segment < this.config.segmentCount - 1; segment += 1) {
          for (let endpoint = 0; endpoint < 2; endpoint += 1) {
            const z = -((((segment + endpoint) * 1.08 + travel) % totalDepth) + 1.8);
            const angle = base + travel * 0.018 + Math.sin(Math.abs(z) * 0.12) * distortion * 0.12;
            center(z);
            const radius = radiusAt(z) * 1.01;
            values[cursor++] = this.position.x + Math.cos(angle) * radius;
            values[cursor++] = this.position.y + Math.sin(angle) * radius;
            values[cursor++] = z;
          }
        }
      }
      attribute.needsUpdate = true;
    }
    if (this.streaks) {
      const positions = this.streaks.geometry.getAttribute("position") as THREE.BufferAttribute;
      const colors = this.streaks.geometry.getAttribute("color") as THREE.BufferAttribute;
      const positionValues = positions.array as Float32Array;
      const colorValues = colors.array as Float32Array;
      let p = 0;
      let c = 0;
      for (const seed of this.streakSeeds) {
        const z = -(((seed.z + travel * seed.speed) % totalDepth) + 1.2);
        const angle = seed.angle + travel * 0.02;
        center(z);
        const radius = radiusAt(z) * seed.lane;
        const x = this.position.x + Math.cos(angle) * radius;
        const y = this.position.y + Math.sin(angle) * radius;
        const length = 0.45 + this.config.travelSpeed * 0.045 + audio * 0.7;
        positionValues.set([x, y, z, x * 0.96, y * 0.96, z + length], p); p += 6;
        this.color.setHSL(0.53 + seed.hue * 0.36, 0.96, 0.64);
        this.color.multiplyScalar(1 + this.config.glowStrength * 0.42 + audio * 0.5);
        for (let endpoint = 0; endpoint < 2; endpoint += 1) { colorValues[c++] = this.color.r; colorValues[c++] = this.color.g; colorValues[c++] = this.color.b; }
      }
      positions.needsUpdate = true;
      colors.needsUpdate = true;
    }
    this.camera.position.set(pointer.x * 0.28, pointer.y * 0.2, 0.2);
    this.camera.lookAt(pointer.x * 1.1, pointer.y * 0.75, -8.4);
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(this.scene, this.camera);
    return this.target.texture;
  }

  dispose() { disposeScene(this.scene); this.target.dispose(); }

  private rebuild() {
    [this.ringLines, this.lattice, this.streaks].forEach((object) => { if (object) { this.scene.remove(object); disposeSceneObject(object); } });
    const ringSides = 72;
    const ringGeometry = new THREE.BufferGeometry();
    ringGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.config.segmentCount * ringSides * 2 * 3), 3));
    ringGeometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(this.config.segmentCount * ringSides * 2 * 3), 3));
    this.ringLines = new THREE.LineSegments(ringGeometry, new THREE.LineBasicMaterial({blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.96, transparent: true, vertexColors: true}));
    this.ringLines.frustumCulled = false;
    this.scene.add(this.ringLines);
    const latticeGeometry = new THREE.BufferGeometry();
    latticeGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(34 * (this.config.segmentCount - 1) * 2 * 3), 3));
    this.lattice = new THREE.LineSegments(latticeGeometry, new THREE.LineBasicMaterial({blending: THREE.AdditiveBlending, color: "#39f5ff", depthWrite: false, opacity: 0.3, transparent: true}));
    this.lattice.frustumCulled = false;
    this.scene.add(this.lattice);
    const random = createSeededRandom(this.seed);
    const totalDepth = this.config.segmentCount * 1.08;
    this.streakSeeds = Array.from({length: this.config.particleDensity}, () => ({angle: random() * Math.PI * 2, lane: THREE.MathUtils.lerp(0.32, 1.05, random()), speed: THREE.MathUtils.lerp(0.62, 1.55, random()), z: random() * totalDepth, hue: random()}));
    const streakGeometry = new THREE.BufferGeometry();
    streakGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.streakSeeds.length * 6), 3));
    streakGeometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(this.streakSeeds.length * 6), 3));
    this.streaks = new THREE.LineSegments(streakGeometry, new THREE.LineBasicMaterial({blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, vertexColors: true}));
    this.streaks.frustumCulled = false;
    this.scene.add(this.streaks);
  }
}

export const signatureTunnelAtom: VisualEffectAtom<TunnelConfig> = {
  id: "neon-tunnel", title: "Neon Energy Tunnel", description: "Independent rings, radial lattice and deterministic speed streaks.", tags: ["tunnel", "neon", "signature"], defaultConfig: tunnelDefaults,
  controls: controls([["travelSpeed", "Travel speed", 0.6, 10, 0.1], ["tunnelRadius", "Radius", 1.2, 3.3, 0.01], ["segmentCount", "Segments", 36, 110, 1], ["glowStrength", "Glow", 0.2, 2.5, 0.01], ["distortionStrength", "Distortion", 0, 2, 0.01], ["particleDensity", "Streaks", 180, 1600, 20], ["audioReactivity", "Audio", 0, 2, 0.01]]),
  capabilities: {audio: true, pointer: true, gpuHeavy: true}, sanitizeConfig: sanitizeTunnel, createLayer: ({seed, config}) => new SignatureTunnelLayer(seed, config),
};

