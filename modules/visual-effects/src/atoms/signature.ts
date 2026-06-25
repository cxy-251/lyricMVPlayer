import * as THREE from "three";

import type {
  EffectControl,
  EffectFrameContext,
  EffectViewport,
  VisualEffectAtom,
  VisualEffectLayer,
} from "../types";
import {createSeededRandom} from "../runtime/random";
import {createLayerTarget} from "./config";

const clamp = (value: unknown, fallback: number, min: number, max: number) =>
  THREE.MathUtils.clamp(typeof value === "number" && Number.isFinite(value) ? value : fallback, min, max);

const record = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};

const resizeTarget = (target: THREE.WebGLRenderTarget, viewport: EffectViewport) => {
  target.setSize(
    Math.max(1, Math.round(viewport.width * Math.min(2, viewport.pixelRatio))),
    Math.max(1, Math.round(viewport.height * Math.min(2, viewport.pixelRatio))),
  );
};

const disposeScene = (scene: THREE.Scene) => {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    }
  });
  scene.clear();
};

type GalaxyConfig = {
  particleCount: number;
  particleSize: number;
  rotationSpeed: number;
  interactionStrength: number;
  glowStrength: number;
  audioReactivity: number;
};

const galaxyDefaults: GalaxyConfig = {
  particleCount: 32000,
  particleSize: 1,
  rotationSpeed: 0.16,
  interactionStrength: 0.82,
  glowStrength: 0.78,
  audioReactivity: 0.7,
};

const sanitizeGalaxy = (value: unknown): GalaxyConfig => {
  const source = record(value);
  return {
    particleCount: Math.round(clamp(source.particleCount, galaxyDefaults.particleCount, 8000, 60000) / 500) * 500,
    particleSize: clamp(source.particleSize, galaxyDefaults.particleSize, 0.45, 2),
    rotationSpeed: clamp(source.rotationSpeed, galaxyDefaults.rotationSpeed, 0.02, 0.75),
    interactionStrength: clamp(source.interactionStrength, galaxyDefaults.interactionStrength, 0, 2),
    glowStrength: clamp(source.glowStrength, galaxyDefaults.glowStrength, 0.2, 3),
    audioReactivity: clamp(source.audioReactivity, galaxyDefaults.audioReactivity, 0, 2),
  };
};

const galaxyVertexShader = `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uParticleSize;
  uniform float uPixelRatio;
  uniform float uInteractionStrength;
  uniform float uAudio;
  uniform vec2 uPointer;
  attribute float aScale;
  attribute float aPhase;
  attribute float aRandom;
  attribute float aRadius;
  varying float vAlpha;
  varying float vColorMix;
  varying float vHot;
  mat2 rotate2d(float angle) { float s = sin(angle); float c = cos(angle); return mat2(c, -s, s, c); }
  void main() {
    vec3 p = position;
    float radius = max(length(p.xy), 0.001);
    float time = uTime * uSpeed;
    p.xy = rotate2d(time * (0.24 + 2.4 / (radius + 2.0))) * p.xy;
    vec2 pointer = uPointer * vec2(7.2, 4.2);
    float hover = smoothstep(5.8, 0.0, distance(p.xy, pointer));
    float interaction = hover * uInteractionStrength;
    vec2 direction = normalize(p.xy - pointer + vec2(0.001));
    float pulse = sin(time * 8.0 + aPhase * 6.283185 + radius * 0.72) * 0.5 + 0.5;
    p.xy += direction * interaction * (0.35 + pulse * 0.58);
    p.z += interaction * sin(aPhase * 13.0 + time * 5.0) * 0.7;
    p.z += sin(radius * 0.75 - time * 2.0 + aPhase * 6.283185) * (0.08 + aRandom * 0.11);
    p.z += sin(aPhase * 31.0 + time * 6.0) * uAudio * 0.12;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float perspective = 8.0 / max(-mvPosition.z, 0.001);
    gl_PointSize = aScale * uParticleSize * perspective * uPixelRatio * (1.0 + interaction + uAudio * 0.32);
    vAlpha = clamp(0.72 - aRadius * 0.036 + interaction * 0.38, 0.1, 0.86);
    vColorMix = clamp(aRandom * 0.72 + aRadius * 0.035, 0.0, 1.0);
    vHot = clamp(interaction + uAudio * 0.45 + (1.0 - aRadius * 0.12), 0.0, 1.0);
  }
`;

const galaxyFragmentShader = `
  precision highp float;
  uniform float uGlow;
  varying float vAlpha;
  varying float vColorMix;
  varying float vHot;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.5, 0.0, d);
    float spark = smoothstep(0.16, 0.0, d);
    vec3 color = mix(vec3(0.28, 0.92, 1.0), vec3(1.0, 0.34, 0.78), vColorMix);
    color = mix(color, vec3(1.0, 0.78, 0.34), vHot * 0.42);
    float alpha = core * vAlpha * (0.62 + uGlow * 0.1);
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(color * (0.34 + spark * (0.82 + uGlow * 0.24) + vHot * 0.2), alpha);
  }
`;

const createGalaxyGeometry = (count: number, seed: number) => {
  const random = createSeededRandom(seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const phases = new Float32Array(count);
  const randoms = new Float32Array(count);
  const radii = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const cursor = index * 3;
    const branchAngle = ((index % 5) / 5) * Math.PI * 2;
    const radius = Math.pow(random(), 0.62) * 5.8;
    const spread = Math.pow(random(), 2.4) * (0.22 + radius * 0.065);
    const spreadAngle = random() * Math.PI * 2;
    positions[cursor] = Math.cos(branchAngle + radius * 0.62) * radius + Math.cos(spreadAngle) * spread;
    positions[cursor + 1] = Math.sin(branchAngle + radius * 0.62) * radius + Math.sin(spreadAngle) * spread;
    positions[cursor + 2] = (random() - 0.5) * Math.pow(random(), 2.8) * 0.72;
    scales[index] = THREE.MathUtils.lerp(1.15, 4.6, Math.pow(random(), 2.1));
    phases[index] = random();
    randoms[index] = random();
    radii[index] = radius;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));
  geometry.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
  return geometry;
};

class SignatureGalaxyLayer implements VisualEffectLayer<GalaxyConfig> {
  private readonly target = createLayerTarget();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(54, 1, 0.1, 60);
  private readonly points = new THREE.Points();
  private readonly material = new THREE.ShaderMaterial({
    vertexShader: galaxyVertexShader,
    fragmentShader: galaxyFragmentShader,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    uniforms: {
      uTime: {value: 0}, uSpeed: {value: 0.16}, uParticleSize: {value: 1}, uPixelRatio: {value: 1},
      uInteractionStrength: {value: 0.82}, uAudio: {value: 0}, uGlow: {value: 0.78}, uPointer: {value: new THREE.Vector2()},
    },
  });
  private geometry: THREE.BufferGeometry;
  private config: GalaxyConfig;
  private seed: number;

  constructor(seed: number, config: GalaxyConfig) {
    this.seed = seed;
    this.config = config;
    this.geometry = createGalaxyGeometry(config.particleCount, seed);
    this.points.geometry = this.geometry;
    this.points.material = this.material;
    this.points.frustumCulled = false;
    this.points.rotation.x = -Math.PI / 2.7;
    this.scene.add(this.points);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), new THREE.MeshBasicMaterial({color: "#fff2b2", transparent: true, opacity: 0.8}));
    this.scene.add(core);
    this.camera.position.set(0, 0.85, 8.4);
    this.camera.lookAt(0, 0, 0);
  }

  setConfig(config: GalaxyConfig) {
    if (config.particleCount !== this.config.particleCount) {
      this.geometry.dispose();
      this.geometry = createGalaxyGeometry(config.particleCount, this.seed);
      this.points.geometry = this.geometry;
    }
    this.config = config;
  }

  resize(viewport: EffectViewport) {
    resizeTarget(this.target, viewport);
    this.camera.aspect = viewport.width / Math.max(1, viewport.height);
    this.camera.updateProjectionMatrix();
  }

  render(renderer: THREE.WebGLRenderer, context: EffectFrameContext) {
    const audio = (context.audio.energy * 0.45 + context.audio.bass * 0.35 + context.audio.onset * 0.2) * this.config.audioReactivity;
    this.material.uniforms.uTime.value = context.time;
    this.material.uniforms.uSpeed.value = this.config.rotationSpeed;
    this.material.uniforms.uParticleSize.value = this.config.particleSize;
    this.material.uniforms.uPixelRatio.value = Math.min(1.75, context.viewport.pixelRatio);
    this.material.uniforms.uInteractionStrength.value = this.config.interactionStrength;
    this.material.uniforms.uAudio.value = audio;
    this.material.uniforms.uGlow.value = this.config.glowStrength;
    this.material.uniforms.uPointer.value.set(context.pointer.x, context.pointer.y);
    this.points.rotation.z = context.time * (0.025 + this.config.rotationSpeed * 0.18);
    this.points.rotation.y = -context.pointer.x * 0.08;
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(this.scene, this.camera);
    return this.target.texture;
  }

  dispose() { disposeScene(this.scene); this.material.dispose(); this.target.dispose(); }
}

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

const disposeSceneObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
};

type FluidConfig = {distortionStrength: number; trailPersistence: number; rippleRadius: number; fluidDecay: number; backgroundScale: number; glowStrength: number; audioReactivity: number};
const fluidDefaults: FluidConfig = {distortionStrength: 1.05, trailPersistence: 0.72, rippleRadius: 0.105, fluidDecay: 0.82, backgroundScale: 2.2, glowStrength: 1.05, audioReactivity: 0.75};
const sanitizeFluid = (value: unknown): FluidConfig => {
  const source = record(value);
  return {
    distortionStrength: clamp(source.distortionStrength, fluidDefaults.distortionStrength, 0, 2.5), trailPersistence: clamp(source.trailPersistence, fluidDefaults.trailPersistence, 0, 1),
    rippleRadius: clamp(source.rippleRadius, fluidDefaults.rippleRadius, 0.025, 0.24), fluidDecay: clamp(source.fluidDecay, fluidDefaults.fluidDecay, 0, 2.5),
    backgroundScale: clamp(source.backgroundScale, fluidDefaults.backgroundScale, 0.8, 4), glowStrength: clamp(source.glowStrength, fluidDefaults.glowStrength, 0, 2.5),
    audioReactivity: clamp(source.audioReactivity, fluidDefaults.audioReactivity, 0, 2),
  };
};

const fullScreenVertex = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const fluidFragment = `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uTime;
  uniform float uAudio;
  uniform float uDistortion;
  uniform float uRippleRadius;
  uniform float uDecay;
  uniform float uScale;
  uniform float uGlow;
  uniform vec4 uImpulses[18];
  float lineField(vec2 uv) { vec2 grid = abs(fract(uv) - 0.5); return 1.0 - smoothstep(0.0, 0.018, min(grid.x, grid.y)); }
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main() {
    vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
    vec2 uv = (vUv - 0.5) * aspect;
    vec2 offset = vec2(0.0);
    float light = 0.0;
    for (int i = 0; i < 18; i++) {
      vec4 impulse = uImpulses[i];
      vec2 center = (impulse.xy - 0.5) * aspect;
      vec2 toPoint = uv - center;
      float dist = length(toPoint);
      float life = exp(-impulse.z * (1.2 + uDecay));
      float radius = max(uRippleRadius, 0.001) * (1.0 + impulse.z * 1.4);
      float ring = exp(-pow((dist - radius) / (radius * 0.42 + 0.035), 2.0));
      float swirl = exp(-dist * (2.8 + uDecay));
      vec2 tangent = vec2(-toPoint.y, toPoint.x) / max(dist, 0.001);
      offset += (tangent * swirl * 0.045 + normalize(toPoint + 0.0001) * ring * 0.028) * impulse.w * life * uDistortion;
      light += (ring * 0.8 + swirl * 0.35) * impulse.w * life;
    }
    vec2 warped = uv + offset + vec2(sin(uv.y * 8.0 + uTime * 0.55), cos(uv.x * 7.0 - uTime * 0.45)) * 0.018 * uDistortion;
    float gridA = lineField(warped * (6.0 * uScale));
    float gridB = lineField((warped + vec2(0.12, -0.08)) * (2.7 * uScale));
    float pointerGlow = exp(-length(vUv - (uPointer * 0.5 + 0.5)) * 6.0);
    vec3 base = mix(vec3(0.012, 0.017, 0.035), vec3(0.035, 0.02, 0.072), smoothstep(-0.7, 0.75, warped.y));
    vec3 cyan = vec3(0.12, 0.95, 1.0);
    vec3 magenta = vec3(1.0, 0.18, 0.65);
    vec3 color = base + cyan * gridA * 0.13 + magenta * gridB * 0.08;
    color += mix(cyan, magenta, sin(uTime * 0.2 + warped.x * 2.0) * 0.5 + 0.5) * light * (0.42 + uGlow * 0.32 + uAudio * 0.45);
    color += vec3(0.45, 0.85, 1.0) * pointerGlow * 0.08;
    color += (hash(floor(vUv * uResolution * 0.35) + uTime) - 0.5) * 0.012;
    color *= 1.0 - smoothstep(0.55, 1.25, length((vUv - 0.5) * aspect));
    gl_FragColor = vec4(color, 0.96);
  }
`;

class SignatureFluidLayer implements VisualEffectLayer<FluidConfig> {
  private readonly target = createLayerTarget();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly impulses = Array.from({length: 18}, () => new THREE.Vector4());
  private readonly material = new THREE.ShaderMaterial({vertexShader: fullScreenVertex, fragmentShader: fluidFragment, transparent: true, depthWrite: false, uniforms: {
    uResolution: {value: new THREE.Vector2(1, 1)}, uPointer: {value: new THREE.Vector2()}, uTime: {value: 0}, uAudio: {value: 0}, uDistortion: {value: 1},
    uRippleRadius: {value: 0.1}, uDecay: {value: 0.8}, uScale: {value: 2.2}, uGlow: {value: 1}, uImpulses: {value: this.impulses},
  }});
  private config: FluidConfig;
  private readonly phases: Array<{x: number; y: number; phase: number}>;
  constructor(seed: number, config: FluidConfig) {
    this.config = config;
    const random = createSeededRandom(seed);
    this.phases = this.impulses.map(() => ({x: random(), y: random(), phase: random() * 7}));
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }
  setConfig(config: FluidConfig) { this.config = config; }
  resize(viewport: EffectViewport) { resizeTarget(this.target, viewport); this.material.uniforms.uResolution.value.set(viewport.width, viewport.height); }
  render(renderer: THREE.WebGLRenderer, context: EffectFrameContext) {
    const audio = (context.audio.energy * 0.5 + context.audio.mid * 0.25 + context.audio.onset * 0.25) * this.config.audioReactivity;
    this.impulses.forEach((impulse, index) => {
      const item = this.phases[index];
      const cycle = ((context.time * (0.22 + index * 0.003) + item.phase) % 4 + 4) % 4;
      const pointerMix = index < 3 ? 0.86 : 0;
      const x = THREE.MathUtils.lerp(item.x, context.pointer.x * 0.5 + 0.5, pointerMix);
      const y = THREE.MathUtils.lerp(item.y, context.pointer.y * 0.5 + 0.5, pointerMix);
      impulse.set(x, y, cycle, ((index < 3 ? 0.34 : 0.18) + audio * 0.85 + context.pointer.pressed * 0.72) * (1 - cycle / 4));
    });
    this.material.uniforms.uPointer.value.set(context.pointer.x, context.pointer.y);
    this.material.uniforms.uTime.value = context.time;
    this.material.uniforms.uAudio.value = audio;
    this.material.uniforms.uDistortion.value = this.config.distortionStrength;
    this.material.uniforms.uRippleRadius.value = this.config.rippleRadius;
    this.material.uniforms.uDecay.value = this.config.fluidDecay + (1 - this.config.trailPersistence) * 0.4;
    this.material.uniforms.uScale.value = this.config.backgroundScale;
    this.material.uniforms.uGlow.value = this.config.glowStrength;
    renderer.setRenderTarget(this.target); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true); renderer.render(this.scene, this.camera);
    return this.target.texture;
  }
  dispose() { disposeScene(this.scene); this.material.dispose(); this.target.dispose(); }
}

type ClothConfig = {windStrength: number; damping: number; clothResolution: number; interactionRadius: number; interactionStrength: number; glowStrength: number; audioReactivity: number};
const clothDefaults: ClothConfig = {windStrength: 0.82, damping: 0.965, clothResolution: 32, interactionRadius: 0.62, interactionStrength: 1.1, glowStrength: 1.05, audioReactivity: 0.55};
const sanitizeCloth = (value: unknown): ClothConfig => { const source = record(value); return {
  windStrength: clamp(source.windStrength, clothDefaults.windStrength, 0, 2.2), damping: clamp(source.damping, clothDefaults.damping, 0.9, 0.995),
  clothResolution: Math.round(clamp(source.clothResolution, clothDefaults.clothResolution, 14, 48)), interactionRadius: clamp(source.interactionRadius, clothDefaults.interactionRadius, 0.25, 1.4),
  interactionStrength: clamp(source.interactionStrength, clothDefaults.interactionStrength, 0, 2.5), glowStrength: clamp(source.glowStrength, clothDefaults.glowStrength, 0, 2.5),
  audioReactivity: clamp(source.audioReactivity, clothDefaults.audioReactivity, 0, 2),
}; };

const clothVertex = `
  uniform float uTime; uniform float uWind; uniform float uInteraction; uniform float uRadius; uniform float uAudio; uniform vec2 uPointer;
  varying vec2 vUv; varying float vWave;
  void main() {
    vUv = uv; vec3 p = position; float pin = smoothstep(1.0, 0.04, uv.y);
    float wind = sin(p.x * 1.7 + uTime * 1.8) * 0.17 + sin(p.y * 2.7 - uTime * 1.25) * 0.08;
    vec2 pointerWorld = uPointer * vec2(2.4, 1.45); float influence = exp(-length(p.xy - pointerWorld) / max(0.08, uRadius));
    float ripple = sin(length(p.xy - pointerWorld) * 11.0 - uTime * 4.0) * influence * uInteraction;
    p.z += (wind * uWind + ripple * 0.22 + sin(p.x * 3.0 + uTime * 3.0) * uAudio * 0.12) * pin;
    p.y -= pin * pin * 0.14; vWave = wind + ripple + uAudio * 0.3;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const clothFragment = `
  precision highp float; varying vec2 vUv; varying float vWave; uniform float uGlow;
  void main() {
    vec2 gridUv = abs(fract(vUv * vec2(32.0, 21.0)) - 0.5); float wire = 1.0 - smoothstep(0.43, 0.49, max(gridUv.x, gridUv.y));
    float edge = smoothstep(0.08, 0.0, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
    vec3 base = mix(vec3(0.025, 0.08, 0.12), vec3(0.12, 0.9, 1.0), clamp(vWave * 0.8 + 0.45, 0.0, 1.0));
    vec3 color = base * (0.46 + wire * (0.45 + uGlow * 0.22)) + vec3(1.0, 0.2, 0.64) * edge * 0.45;
    gl_FragColor = vec4(color, 0.34 + wire * 0.5 + edge * 0.16);
  }
`;

class SignatureClothLayer implements VisualEffectLayer<ClothConfig> {
  private readonly target = createLayerTarget(); private readonly scene = new THREE.Scene(); private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 60);
  private geometry: THREE.PlaneGeometry; private readonly material: THREE.ShaderMaterial; private readonly sparks: THREE.Points; private config: ClothConfig;
  constructor(seed: number, config: ClothConfig) {
    this.config = config; this.geometry = new THREE.PlaneGeometry(4.8, 2.9, config.clothResolution - 1, Math.round(config.clothResolution * 0.64) - 1);
    this.material = new THREE.ShaderMaterial({vertexShader: clothVertex, fragmentShader: clothFragment, side: THREE.DoubleSide, transparent: true, depthWrite: false, uniforms: {
      uTime: {value: 0}, uWind: {value: 0.82}, uInteraction: {value: 1.1}, uRadius: {value: 0.62}, uAudio: {value: 0}, uPointer: {value: new THREE.Vector2()}, uGlow: {value: 1},
    }});
    this.scene.add(new THREE.Mesh(this.geometry, this.material));
    const random = createSeededRandom(seed); const positions = new Float32Array(180 * 3);
    for (let index = 0; index < 180; index += 1) positions.set([(random() > 0.5 ? 1 : -1) * (2.25 + random() * 0.6), THREE.MathUtils.lerp(-1.45, 1.45, random()), THREE.MathUtils.lerp(-0.3, 0.5, random())], index * 3);
    const sparkGeometry = new THREE.BufferGeometry(); sparkGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.sparks = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({blending: THREE.AdditiveBlending, color: "#7ff8ff", depthWrite: false, opacity: 0.68, size: 0.028, transparent: true}));
    this.scene.add(this.sparks); this.camera.position.set(0, 0.15, 6.3); this.camera.lookAt(0, -0.1, 0);
  }
  setConfig(config: ClothConfig) { if (config.clothResolution !== this.config.clothResolution) { const replacement = new THREE.PlaneGeometry(4.8, 2.9, config.clothResolution - 1, Math.round(config.clothResolution * 0.64) - 1); const mesh = this.scene.children.find((item) => item instanceof THREE.Mesh) as THREE.Mesh; this.geometry.dispose(); this.geometry = replacement; mesh.geometry = replacement; } this.config = config; }
  resize(viewport: EffectViewport) { resizeTarget(this.target, viewport); this.camera.aspect = viewport.width / Math.max(1, viewport.height); this.camera.updateProjectionMatrix(); }
  render(renderer: THREE.WebGLRenderer, context: EffectFrameContext) {
    const audio = (context.audio.energy * 0.45 + context.audio.bass * 0.4 + context.audio.onset * 0.15) * this.config.audioReactivity;
    this.material.uniforms.uTime.value = context.time; this.material.uniforms.uWind.value = this.config.windStrength; this.material.uniforms.uInteraction.value = this.config.interactionStrength * (0.6 + context.pointer.pressed * 0.8);
    this.material.uniforms.uRadius.value = this.config.interactionRadius; this.material.uniforms.uAudio.value = audio; this.material.uniforms.uPointer.value.set(context.pointer.x, context.pointer.y); this.material.uniforms.uGlow.value = this.config.glowStrength;
    this.sparks.rotation.z = Math.sin(context.time * 0.12) * 0.02; const sparkMaterial = this.sparks.material as THREE.PointsMaterial; sparkMaterial.opacity = 0.48 + this.config.glowStrength * 0.12 + audio * 0.18;
    this.camera.position.x = context.pointer.x * 0.18; this.camera.position.y = 0.15 + context.pointer.y * 0.08; this.camera.lookAt(0, -0.1, 0);
    renderer.setRenderTarget(this.target); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true); renderer.render(this.scene, this.camera); return this.target.texture;
  }
  dispose() { disposeScene(this.scene); this.material.dispose(); this.target.dispose(); }
}

type MorphConfig = {particleCount: number; particleSize: number; morphSpeed: number; turbulenceStrength: number; interactionStrength: number; glowStrength: number; audioReactivity: number};
const morphDefaults: MorphConfig = {particleCount: 18000, particleSize: 1.15, morphSpeed: 0.42, turbulenceStrength: 0.42, interactionStrength: 0.72, glowStrength: 0.9, audioReactivity: 0.6};
const sanitizeMorph = (value: unknown): MorphConfig => { const source = record(value); return {
  particleCount: Math.round(clamp(source.particleCount, morphDefaults.particleCount, 4000, 32000) / 1000) * 1000, particleSize: clamp(source.particleSize, morphDefaults.particleSize, 0.45, 2.4),
  morphSpeed: clamp(source.morphSpeed, morphDefaults.morphSpeed, 0.08, 1.6), turbulenceStrength: clamp(source.turbulenceStrength, morphDefaults.turbulenceStrength, 0, 1.8),
  interactionStrength: clamp(source.interactionStrength, morphDefaults.interactionStrength, 0, 2.2), glowStrength: clamp(source.glowStrength, morphDefaults.glowStrength, 0, 2.5), audioReactivity: clamp(source.audioReactivity, morphDefaults.audioReactivity, 0, 2),
}; };

const morphVertex = `
  attribute vec3 aSphere; attribute vec3 aTorus; attribute vec3 aSpiral; attribute vec3 aGrid; attribute float aSeed;
  uniform float uTime; uniform float uFromShape; uniform float uToShape; uniform float uProgress; uniform float uPixelRatio; uniform float uParticleSize; uniform float uTurbulence; uniform float uInteraction; uniform float uGlow; uniform float uAudio; uniform vec2 uPointer;
  varying vec3 vColor; varying float vAlpha;
  vec3 shapeAt(float id) { if (id < 0.5) return aSphere; if (id < 1.5) return aTorus; if (id < 2.5) return aSpiral; return aGrid; }
  void main() {
    float eased = smoothstep(0.0, 1.0, uProgress); vec3 p = mix(shapeAt(uFromShape), shapeAt(uToShape), eased);
    float turbulence = sin(uTime * 1.4 + aSeed * 18.0 + p.x * 1.7) * cos(uTime * 1.1 + p.y * 1.3);
    p += normalize(p + 0.001) * turbulence * (uTurbulence + uAudio * 0.35) * 0.12;
    vec2 pointer = uPointer * vec2(3.2, 2.1); float force = exp(-length(p.xy - pointer) * 1.25) * uInteraction;
    p.xy += normalize(p.xy - pointer + 0.001) * force * 0.34; p.z += force * 0.32;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition; gl_PointSize = uParticleSize * uPixelRatio * (56.0 / max(1.0, -mvPosition.z)) * (1.0 + uAudio * 0.3);
    vColor = mix(vec3(0.2, 0.95, 1.0), vec3(1.0, 0.28, 0.66), fract(aSeed * 7.7 + uToShape * 0.21)); vColor = mix(vColor, vec3(1.0, 0.82, 0.34), smoothstep(0.75, 1.0, force)); vColor *= 0.85 + uGlow * 0.45; vAlpha = 0.55 + force * 0.35;
  }
`;
const morphFragment = `precision highp float; varying vec3 vColor; varying float vAlpha; void main() { float alpha = smoothstep(0.5, 0.05, length(gl_PointCoord - 0.5)) * vAlpha; if (alpha < 0.01) discard; gl_FragColor = vec4(vColor * 0.72, alpha * 0.72); }`;

const createMorphGeometry = (count: number, seed: number) => {
  const random = createSeededRandom(seed); const sphere = new Float32Array(count * 3); const torus = new Float32Array(count * 3); const spiral = new Float32Array(count * 3); const grid = new Float32Array(count * 3); const seeds = new Float32Array(count); const side = Math.ceil(Math.sqrt(count));
  for (let index = 0; index < count; index += 1) {
    seeds[index] = random(); const u = random(); const v = random(); const theta = Math.acos(2 * u - 1); const phi = Math.PI * 2 * v; const radius = 2.2 + (random() - 0.5) * 0.18;
    sphere.set([Math.sin(theta) * Math.cos(phi) * radius, Math.cos(theta) * radius, Math.sin(theta) * Math.sin(phi) * radius], index * 3);
    const torusAngle = Math.PI * 2 * random(); const tubeAngle = Math.PI * 2 * random(); const tube = 0.62 + random() * 0.18;
    torus.set([(2.05 + tube * Math.cos(tubeAngle)) * Math.cos(torusAngle), tube * Math.sin(tubeAngle), (2.05 + tube * Math.cos(tubeAngle)) * Math.sin(torusAngle)], index * 3);
    const arm = Math.floor(random() * 4); const distance = Math.pow(random(), 0.58) * 3.2; const angle = distance * 1.7 + arm * Math.PI / 2 + (random() - 0.5) * 0.34;
    spiral.set([Math.cos(angle) * distance, (random() - 0.5) * 0.35, Math.sin(angle) * distance], index * 3);
    const gx = (index % side) / Math.max(1, side - 1) - 0.5; const gy = Math.floor(index / side) / Math.max(1, side - 1) - 0.5;
    grid.set([gx * 5.2, Math.sin(gx * 8 + gy * 5) * 0.34, gy * 3.6], index * 3);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.BufferAttribute(sphere, 3)); geometry.setAttribute("aSphere", new THREE.BufferAttribute(sphere, 3)); geometry.setAttribute("aTorus", new THREE.BufferAttribute(torus, 3)); geometry.setAttribute("aSpiral", new THREE.BufferAttribute(spiral, 3)); geometry.setAttribute("aGrid", new THREE.BufferAttribute(grid, 3)); geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1)); return geometry;
};

class SignatureMorphLayer implements VisualEffectLayer<MorphConfig> {
  private readonly target = createLayerTarget(); private readonly scene = new THREE.Scene(); private readonly camera = new THREE.PerspectiveCamera(54, 1, 0.1, 80); private readonly points = new THREE.Points();
  private readonly material = new THREE.ShaderMaterial({vertexShader: morphVertex, fragmentShader: morphFragment, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, uniforms: {
    uTime: {value: 0}, uFromShape: {value: 0}, uToShape: {value: 1}, uProgress: {value: 0}, uPixelRatio: {value: 1}, uParticleSize: {value: 1.15}, uTurbulence: {value: 0.42}, uInteraction: {value: 0.72}, uGlow: {value: 0.9}, uAudio: {value: 0}, uPointer: {value: new THREE.Vector2()},
  }});
  private geometry: THREE.BufferGeometry; private config: MorphConfig; private readonly seed: number;
  constructor(seed: number, config: MorphConfig) { this.seed = seed; this.config = config; this.geometry = createMorphGeometry(config.particleCount, seed); this.points.geometry = this.geometry; this.points.material = this.material; this.points.frustumCulled = false; this.scene.add(this.points); this.camera.position.set(0, 0.45, 7.6); }
  setConfig(config: MorphConfig) { if (config.particleCount !== this.config.particleCount) { this.geometry.dispose(); this.geometry = createMorphGeometry(config.particleCount, this.seed); this.points.geometry = this.geometry; } this.config = config; }
  resize(viewport: EffectViewport) { resizeTarget(this.target, viewport); this.camera.aspect = viewport.width / Math.max(1, viewport.height); this.camera.updateProjectionMatrix(); }
  render(renderer: THREE.WebGLRenderer, context: EffectFrameContext) {
    const phaseDuration = 5.8 / this.config.morphSpeed; const shapePhase = context.time / phaseDuration; const from = Math.floor(shapePhase) % 4; const progress = shapePhase - Math.floor(shapePhase); const audio = (context.audio.energy * 0.45 + context.audio.high * 0.25 + context.audio.onset * 0.3) * this.config.audioReactivity;
    this.material.uniforms.uTime.value = context.time; this.material.uniforms.uFromShape.value = from; this.material.uniforms.uToShape.value = (from + 1) % 4; this.material.uniforms.uProgress.value = progress; this.material.uniforms.uPixelRatio.value = Math.min(1.75, context.viewport.pixelRatio);
    this.material.uniforms.uParticleSize.value = this.config.particleSize; this.material.uniforms.uTurbulence.value = this.config.turbulenceStrength; this.material.uniforms.uInteraction.value = this.config.interactionStrength; this.material.uniforms.uGlow.value = this.config.glowStrength; this.material.uniforms.uAudio.value = audio; this.material.uniforms.uPointer.value.set(context.pointer.x, context.pointer.y);
    this.points.rotation.y = context.time * 0.065; this.points.rotation.x = context.pointer.y * 0.08; this.camera.lookAt(0, 0, 0);
    renderer.setRenderTarget(this.target); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true); renderer.render(this.scene, this.camera); return this.target.texture;
  }
  dispose() { disposeScene(this.scene); this.material.dispose(); this.target.dispose(); }
}

const controls = (items: Array<[string, string, number, number, number]>): EffectControl[] => items.map(([field, label, min, max, step]) => ({kind: "number", field, label, min, max, step}));

export const signatureGalaxyAtom: VisualEffectAtom<GalaxyConfig> = {
  id: "galaxy-particles", title: "Particle Galaxy", description: "Five shader-driven spiral arms with pointer and song response.", tags: ["particles", "galaxy", "signature"], defaultConfig: galaxyDefaults,
  controls: controls([["particleCount", "Particles", 8000, 60000, 500], ["particleSize", "Particle size", 0.45, 2, 0.01], ["rotationSpeed", "Rotation", 0.02, 0.75, 0.01], ["interactionStrength", "Interaction", 0, 2, 0.01], ["glowStrength", "Glow", 0.2, 3, 0.01], ["audioReactivity", "Audio", 0, 2, 0.01]]),
  capabilities: {audio: true, pointer: true, gpuHeavy: true}, sanitizeConfig: sanitizeGalaxy, createLayer: ({seed, config}) => new SignatureGalaxyLayer(seed, config),
};

export const signatureTunnelAtom: VisualEffectAtom<TunnelConfig> = {
  id: "neon-tunnel", title: "Neon Energy Tunnel", description: "Independent rings, radial lattice and deterministic speed streaks.", tags: ["tunnel", "neon", "signature"], defaultConfig: tunnelDefaults,
  controls: controls([["travelSpeed", "Travel speed", 0.6, 10, 0.1], ["tunnelRadius", "Radius", 1.2, 3.3, 0.01], ["segmentCount", "Segments", 36, 110, 1], ["glowStrength", "Glow", 0.2, 2.5, 0.01], ["distortionStrength", "Distortion", 0, 2, 0.01], ["particleDensity", "Streaks", 180, 1600, 20], ["audioReactivity", "Audio", 0, 2, 0.01]]),
  capabilities: {audio: true, pointer: true, gpuHeavy: true}, sanitizeConfig: sanitizeTunnel, createLayer: ({seed, config}) => new SignatureTunnelLayer(seed, config),
};

export const signatureFluidAtom: VisualEffectAtom<FluidConfig> = {
  id: "fluid-surface", title: "Fluid Cursor Field", description: "A full-frame ripple field with deterministic impulse memory.", tags: ["fluid", "shader", "signature"], defaultConfig: fluidDefaults,
  controls: controls([["distortionStrength", "Distortion", 0, 2.5, 0.01], ["trailPersistence", "Trail", 0, 1, 0.01], ["rippleRadius", "Ripple radius", 0.025, 0.24, 0.001], ["fluidDecay", "Decay", 0, 2.5, 0.01], ["backgroundScale", "Grid scale", 0.8, 4, 0.01], ["glowStrength", "Glow", 0, 2.5, 0.01], ["audioReactivity", "Audio", 0, 2, 0.01]]),
  capabilities: {audio: true, pointer: true}, sanitizeConfig: sanitizeFluid, createLayer: ({seed, config}) => new SignatureFluidLayer(seed, config),
};

export const signatureClothAtom: VisualEffectAtom<ClothConfig> = {
  id: "cloth-surface", title: "Physics Cloth Banner", description: "A pinned luminous fabric with absolute-time wind, pointer ripples and edge sparks.", tags: ["cloth", "physics", "signature"], defaultConfig: clothDefaults,
  controls: controls([["windStrength", "Wind", 0, 2.2, 0.01], ["damping", "Damping", 0.9, 0.995, 0.001], ["clothResolution", "Resolution", 14, 48, 1], ["interactionRadius", "Interaction radius", 0.25, 1.4, 0.01], ["interactionStrength", "Interaction", 0, 2.5, 0.01], ["glowStrength", "Glow", 0, 2.5, 0.01], ["audioReactivity", "Audio", 0, 2, 0.01]]),
  capabilities: {audio: true, pointer: true}, sanitizeConfig: sanitizeCloth, createLayer: ({seed, config}) => new SignatureClothLayer(seed, config),
};

export const signatureMorphAtom: VisualEffectAtom<MorphConfig> = {
  id: "morph-particles", title: "Particle Morphing Field", description: "Particles cycle through sphere, torus, spiral galaxy and wave grid targets.", tags: ["particles", "morph", "signature"], defaultConfig: morphDefaults,
  controls: controls([["particleCount", "Particles", 4000, 32000, 1000], ["particleSize", "Particle size", 0.45, 2.4, 0.01], ["morphSpeed", "Morph speed", 0.08, 1.6, 0.01], ["turbulenceStrength", "Turbulence", 0, 1.8, 0.01], ["interactionStrength", "Interaction", 0, 2.2, 0.01], ["glowStrength", "Glow", 0, 2.5, 0.01], ["audioReactivity", "Audio", 0, 2, 0.01]]),
  capabilities: {audio: true, pointer: true, gpuHeavy: true}, sanitizeConfig: sanitizeMorph, createLayer: ({seed, config}) => new SignatureMorphLayer(seed, config),
};
