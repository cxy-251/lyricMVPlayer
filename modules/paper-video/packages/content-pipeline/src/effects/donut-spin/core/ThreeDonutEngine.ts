import * as THREE from "three";
import {EffectComposer} from "three/examples/jsm/postprocessing/EffectComposer.js";
import {RenderPass} from "three/examples/jsm/postprocessing/RenderPass.js";
import {UnrealBloomPass} from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import {resolveDonutEffectConfig} from "../../../module-api";
import {applyOrbitRig} from "../../shared/updateCameraRigs";
import {createDonutMeshes} from "./createDonutMeshes";
import {disposeThreeDonut} from "./disposeThreeDonut";
import type {
  DonutOrbitSeed,
  ThreeDonutEngineOptions,
  ThreeDonutMeshBundle,
  ThreeDonutModules,
  ThreeDonutRenderParams,
} from "../donut-spin.types";

const hashNoise = (value: number) => {
  const resolved = Math.sin(value * 12.9898) * 43758.5453;
  return resolved - Math.floor(resolved);
};

const buildOrbitSeeds = (count: number, seed: number): DonutOrbitSeed[] =>
  Array.from({length: count}, (_, index) => ({
    angle: hashNoise(seed * 101 + index * 3.7) * Math.PI * 2,
    lane: hashNoise(seed * 211 + index * 5.1),
    offset: hashNoise(seed * 307 + index * 7.9) * 2 - 1,
    pulse: hashNoise(seed * 401 + index * 11.3) * Math.PI * 2,
    speed: 0.7 + hashNoise(seed * 503 + index * 13.1) * 0.8,
  }));

export class ThreeDonutEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly root = new THREE.Group();
  private readonly ambientLight = new THREE.AmbientLight(0xf0f4ff, 0.68);
  private readonly keyLight = new THREE.DirectionalLight(0xffffff, 1.08);
  private readonly fillLight = new THREE.DirectionalLight(0xff8fd2, 0.34);
  private readonly rimLight = new THREE.DirectionalLight(0x7de7ff, 0.72);
  private readonly cameraTarget = new THREE.Vector3();
  private readonly helper = new THREE.Object3D();
  private bundle: ThreeDonutMeshBundle;
  private height = 0;
  private width = 0;
  private resolvedModulesRef: ThreeDonutModules | undefined;
  private resolvedConfigCache: ReturnType<typeof resolveDonutEffectConfig> | null = null;
  private seedCache: {seed: number; count: number; seeds: DonutOrbitSeed[]} | null = null;

  public constructor(canvas: HTMLCanvasElement, options: ThreeDonutEngineOptions) {
    const contextAttributes: WebGLContextAttributes = {
      alpha: true,
      antialias: false,
      depth: true,
      failIfMajorPerformanceCaveat: false,
      powerPreference: "high-performance",
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      stencil: false,
    };

    const context = (
      canvas.getContext("webgl2", contextAttributes) ??
      canvas.getContext("webgl", contextAttributes) ??
      canvas.getContext("experimental-webgl", contextAttributes)
    ) as WebGL2RenderingContext | WebGLRenderingContext | null;

    if (!context) {
      throw new Error("Unable to acquire a WebGL context for ThreeDonutEngine");
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(new THREE.Color(0x000000), 0);
    this.renderer.setPixelRatio(1);

    this.scene = new THREE.Scene();
    this.scene.add(this.root);
    this.scene.fog = new THREE.Fog(0x050913, 8, 22);
    this.root.position.set(0, -1.02, 0);

    this.camera = new THREE.PerspectiveCamera(34, options.width / options.height, 0.1, 100);
    this.camera.position.set(0, 0.92, 7.7);
    this.camera.lookAt(0, -0.44, 0);

    this.keyLight.position.set(5.4, 4.6, 6.2);
    this.fillLight.position.set(-5.2, 1.8, 4.8);
    this.rimLight.position.set(-3.5, 3.6, -5.6);
    this.scene.add(this.ambientLight, this.keyLight, this.fillLight, this.rimLight);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(options.width, options.height), 0.22, 0.38, 0.28);
    this.composer.addPass(this.bloomPass);

    const defaultConfig = resolveDonutEffectConfig(undefined);
    this.bundle = createDonutMeshes({
      pearlCount: defaultConfig.pearlCount,
      primaryColor: defaultConfig.primaryColor,
      radius: defaultConfig.ringRadius,
      root: this.root,
      secondaryColor: defaultConfig.secondaryColor,
      tubeRadius: defaultConfig.tubeRadius,
    });
    this.scene.add(this.bundle.shadowDisc.mesh, this.bundle.haloDisc.mesh);
    this.resize(options.width, options.height);
  }

  public resize(width: number, height: number) {
    if (width === this.width && height === this.height) {
      return;
    }

    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  public renderFrame(params: ThreeDonutRenderParams) {
    const config = this.resolveConfig(params.modules);
    this.ensureBundle(config);
    const seeds = this.resolveSeeds(config.pearlCount, params.seed);
    const frame = Math.max(0, params.simulationFrame ?? params.absoluteFrame);
    const time = frame * 0.016 * config.spinSpeed + params.seed * 0.0017;

    this.bundle.bodyMaterial.color.set(config.primaryColor);
    this.bundle.bodyMaterial.emissive.set(config.secondaryColor).multiplyScalar(config.glowIntensity * 0.048);
    this.bundle.glowMaterial.color.set(config.secondaryColor);
    this.bundle.glowMaterial.opacity = 0.012 + config.glowIntensity * 0.018;
    this.bundle.wireMaterial.color.set(config.accentColor);
    this.bundle.wireMaterial.opacity = 0.14 + config.glowIntensity * 0.08;
    this.bundle.haloDisc.material.color.set(config.secondaryColor);
    this.bundle.shadowDisc.material.opacity = 0.1;
    this.bundle.haloDisc.material.opacity = 0;

    this.root.rotation.x = Math.sin(time * 0.42) * config.wobbleAmount * 0.38;
    this.root.rotation.y = time * 0.58 * config.spinSpeed;
    this.root.rotation.z = Math.cos(time * 0.33) * config.wobbleAmount * 0.24;

    applyOrbitRig({
      camera: this.camera,
      target: this.cameraTarget,
      time,
      orbitSpeed: 0.16 * config.orbitSpeed,
      radius: 7.45,
      radiusJitter: 0.12,
      centerY: 0.92,
      heightJitter: 0.05,
      lateralJitter: 0.14,
      targetY: -0.44,
      targetYJitter: 0.03,
      targetZ: 0,
      targetZJitter: 0.08,
    });

    const orbitRadius = config.ringRadius + config.tubeRadius * 1.42;
    seeds.forEach((seed, index) => {
      const pearlTime = time * config.orbitSpeed * seed.speed + seed.pulse;
      const angle = seed.angle + pearlTime;
      const wobble = Math.sin(pearlTime * 0.9 + seed.offset) * config.wobbleAmount * 0.22;
      const radial = orbitRadius + Math.sin(pearlTime * 0.47 + seed.lane * Math.PI * 2) * config.tubeRadius * 0.26;
      const scale = 0.72 + seed.lane * 0.6 + Math.sin(pearlTime * 1.4) * 0.08;
      this.helper.position.set(
        Math.cos(angle) * radial,
        wobble,
        Math.sin(angle) * radial,
      );
      this.helper.scale.setScalar(scale);
      this.helper.updateMatrix();
      this.bundle.pearlMesh.setMatrixAt(index, this.helper.matrix);

      const color = new THREE.Color(config.secondaryColor).lerp(new THREE.Color(config.accentColor), seed.lane * 0.72);
      this.bundle.pearlMesh.setColorAt(index, color);
    });
    this.bundle.pearlMesh.instanceMatrix.needsUpdate = true;
    if (this.bundle.pearlMesh.instanceColor) {
      this.bundle.pearlMesh.instanceColor.needsUpdate = true;
    }

    this.bloomPass.strength = 0.12 + config.glowIntensity * 0.2;
    this.bloomPass.radius = 0.24 + config.glowIntensity * 0.1;
    this.bloomPass.threshold = Math.max(0.22, 0.34 - config.glowIntensity * 0.05);

    this.composer.render();
  }

  public dispose() {
    disposeThreeDonut({
      bundle: this.bundle,
      renderer: this.renderer,
      root: this.root,
      scene: this.scene,
    });
  }

  private resolveConfig(modules?: ThreeDonutModules) {
    if (modules === this.resolvedModulesRef && this.resolvedConfigCache) {
      return this.resolvedConfigCache;
    }

    this.resolvedModulesRef = modules;
    this.resolvedConfigCache = resolveDonutEffectConfig(modules);
    return this.resolvedConfigCache;
  }

  private resolveSeeds(count: number, seed: number) {
    if (this.seedCache && this.seedCache.count === count && this.seedCache.seed === seed) {
      return this.seedCache.seeds;
    }

    this.seedCache = {
      seed,
      count,
      seeds: buildOrbitSeeds(count, seed),
    };
    return this.seedCache.seeds;
  }

  private ensureBundle(config: ReturnType<typeof resolveDonutEffectConfig>) {
    const nextSignature = [
      config.ringRadius.toFixed(3),
      config.tubeRadius.toFixed(3),
      config.pearlCount,
      config.primaryColor,
      config.secondaryColor,
    ].join(":");

    if (this.bundle.signature === nextSignature) {
      return;
    }

    this.root.remove(this.bundle.bodyMesh, this.bundle.glowMesh, this.bundle.wireMesh, this.bundle.pearlMesh);
    this.scene.remove(this.bundle.shadowDisc.mesh, this.bundle.haloDisc.mesh);
    this.bundle.bodyGeometry.dispose();
    this.bundle.bodyMaterial.dispose();
    this.bundle.glowGeometry.dispose();
    this.bundle.glowMaterial.dispose();
    this.bundle.wireGeometry.dispose();
    this.bundle.wireMaterial.dispose();
    this.bundle.pearlGeometry.dispose();
    this.bundle.pearlMaterial.dispose();
    this.bundle.shadowDisc.geometry.dispose();
    this.bundle.shadowDisc.material.dispose();
    this.bundle.haloDisc.geometry.dispose();
    this.bundle.haloDisc.material.dispose();

    this.bundle = createDonutMeshes({
      pearlCount: config.pearlCount,
      primaryColor: config.primaryColor,
      radius: config.ringRadius,
      root: this.root,
      secondaryColor: config.secondaryColor,
      tubeRadius: config.tubeRadius,
    });
    this.scene.add(this.bundle.shadowDisc.mesh, this.bundle.haloDisc.mesh);
    this.seedCache = null;
  }
}
