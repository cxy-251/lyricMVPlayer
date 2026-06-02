import * as THREE from "three";
import {EffectComposer} from "three/examples/jsm/postprocessing/EffectComposer.js";
import {RenderPass} from "three/examples/jsm/postprocessing/RenderPass.js";
import {UnrealBloomPass} from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import {resolveLightsEffectConfig} from "../../../module-api";
import {applyForwardDollyRig} from "../../shared/updateCameraRigs";
import {createLightsMeshes} from "./createLightsMeshes";
import {disposeThreeLights} from "./disposeThreeLights";
import {updateLightsInstances} from "./updateLightsInstances";
import type {
  LightsBeamSeed,
  ThreeLightsEngineOptions,
  ThreeLightsMeshBundle,
  ThreeLightsModules,
  ThreeLightsRenderParams,
} from "../lights-beams.types";

const hashNoise = (value: number) => {
  const resolved = Math.sin(value * 12.9898) * 43758.5453;
  return resolved - Math.floor(resolved);
};

const buildBeamSeeds = (count: number, seed: number): LightsBeamSeed[] =>
  Array.from({length: count}, (_, index) => ({
    baseAngle: hashNoise(seed * 101 + index * 5.17) * Math.PI * 2,
    depth: hashNoise(seed * 211 + index * 11.37),
    drift: hashNoise(seed * 307 + index * 3.91) * 2 - 1,
    lane: hashNoise(seed * 401 + index * 7.53),
    orbit: hashNoise(seed * 503 + index * 13.29),
    phase: hashNoise(seed * 601 + index * 9.11) * Math.PI * 2,
    pulse: 10 + hashNoise(seed * 701 + index * 15.83) * 24,
    speed: 0.018 + hashNoise(seed * 809 + index * 17.47) * 0.04,
  }));

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const smoothPulse = (value: number, start: number, peak: number, end: number) => {
  if (value <= start || value >= end) {
    return 0;
  }

  if (value < peak) {
    return clamp01((value - start) / Math.max(0.0001, peak - start));
  }

  return clamp01((end - value) / Math.max(0.0001, end - peak));
};

export class ThreeLightsEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly ambientLight: THREE.AmbientLight;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly rimLight: THREE.DirectionalLight;
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly root = new THREE.Group();
  private readonly helper = new THREE.Object3D();
  private readonly lookAtTarget = new THREE.Vector3();
  private bundle: ThreeLightsMeshBundle;
  private height = 0;
  private width = 0;
  private resolvedModulesRef: ThreeLightsModules | undefined;
  private resolvedConfigCache: ReturnType<typeof resolveLightsEffectConfig> | null = null;
  private seedCache: {beamCount: number; seed: number; seeds: LightsBeamSeed[]} | null = null;

  public constructor(canvas: HTMLCanvasElement, options: ThreeLightsEngineOptions) {
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
      throw new Error("Unable to acquire a WebGL context for ThreeLightsEngine");
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
    this.renderer.autoClear = true;

    this.scene = new THREE.Scene();
    this.scene.add(this.root);
    this.scene.fog = new THREE.FogExp2(0x071320, 0.03);
    this.ambientLight = new THREE.AmbientLight("#7fbaff", 0.95);
    this.keyLight = new THREE.DirectionalLight("#dff6ff", 1.7);
    this.keyLight.position.set(-4.5, 7.5, 5.2);
    this.rimLight = new THREE.DirectionalLight("#ff9fe6", 0.9);
    this.rimLight.position.set(4.8, 2.1, 3.6);
    this.scene.add(this.ambientLight, this.keyLight, this.rimLight);
    this.camera = new THREE.PerspectiveCamera(34, options.width / options.height, 0.1, 100);
    this.camera.position.set(0, 1.38, 7.6);
    this.camera.lookAt(0, -0.58, -15.2);

    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(options.width, options.height),
      0.5,
      0.78,
      0.22,
    );
    this.composer.addPass(this.bloomPass);

    const defaultConfig = resolveLightsEffectConfig(undefined);
    this.bundle = createLightsMeshes({
      accentColor: defaultConfig.accentColor,
      beamCount: defaultConfig.beamCount,
      coreColor: defaultConfig.primaryColor,
      glowColor: defaultConfig.secondaryColor,
      root: this.root,
    });

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

  public renderFrame(params: ThreeLightsRenderParams) {
    const config = this.resolveConfig(params.modules);
    const seeds = this.resolveSeeds(config.beamCount, params.seed);
    this.ensureBundle(config);
    const isPulse = config.variant === "pulse";

    // Keep orb materials neutral so per-instance colors stay vivid instead of
    // getting multiplied down into muddy / near-black tones.
    if (isPulse) {
      this.bundle.core.material.color.set(config.primaryColor);
      this.bundle.glow.material.color.set(config.secondaryColor);
      this.bundle.accent.material.color.set(config.accentColor);
    } else {
      this.bundle.core.material.color.set("#ffffff");
      this.bundle.glow.material.color.set("#ffffff");
      this.bundle.accent.material.color.set("#ffffff");
    }
    const atmosphereFill = new THREE.Color("#102233");
    const atmosphereLines = new THREE.Color("#3e7aa4");
    const atmosphereAccent = new THREE.Color("#6aa7d9");
    this.bundle.groundAura.material.color.copy(atmosphereFill);
    this.bundle.groundGlow.material.color.copy(atmosphereLines);
    this.bundle.groundRim.material.color.copy(atmosphereAccent);
    this.bundle.surfaceDots.material.color.copy(atmosphereLines);
    this.bundle.surfaceAccent.material.color.copy(atmosphereAccent);
    this.bundle.floorTiles.forEach((tile) => {
      tile.fillMaterial.color.copy(atmosphereFill);
      tile.wireMaterial.color.copy(atmosphereLines);
    });
    this.bundle.horizonMaterial.color.copy(atmosphereFill);

    const frame = Math.max(0, params.simulationFrame ?? params.absoluteFrame);
    const time = frame * config.motionSpeed * 6.9;
    const choreographyPhase = (time * 0.055) % 1;
    const pulseSection = smoothPulse(choreographyPhase, 0.08, 0.24, 0.42);
    const surgeSection = smoothPulse(choreographyPhase, 0.38, 0.58, 0.8);
    const settleSection = smoothPulse(choreographyPhase, 0.72, 0.88, 1);
    const choreography = {
      auraGain:
        0.9 +
        (0.24 + config.beatIntensity * 0.34) * pulseSection +
        (0.12 + config.beatIntensity * 0.2) * surgeSection,
      fieldGain:
        0.82 +
        (0.18 + config.beatIntensity * 0.18) * pulseSection +
        (0.08 + config.beatIntensity * 0.08) * surgeSection,
      nearBias:
        pulseSection * (0.08 + config.beatIntensity * 0.16) +
        surgeSection * (0.16 + config.beatIntensity * 0.24),
      orbGain:
        0.84 +
        (0.14 + config.beatIntensity * 0.14) * pulseSection +
        (0.12 + config.beatIntensity * 0.16) * surgeSection,
      rimGain:
        0.9 +
        settleSection * (0.06 + config.beatIntensity * 0.1) +
        surgeSection * (0.06 + config.beatIntensity * 0.08),
    };
    const forwardPhase = (time * 0.11) % 1;
    const cameraBoost = 1 + surgeSection * 0.22 + pulseSection * 0.08;
    // Pulse is now a stable hero-pair presentation instead of a rush-toward-camera pass.
    // Keep the camera moving, but bound it to a continuous dolly band so the pair never
    // explodes at the near plane or visibly "resets" after crossing the viewer.
    const cameraDolly = isPulse
      ? 0.28 + (Math.sin(time * 0.16) + 1) * 0.12
      : forwardPhase * 12.6 * cameraBoost;
    applyForwardDollyRig({
      camera: this.camera,
      target: this.lookAtTarget,
      time,
      baseX: 0,
      baseY: 1.34,
      baseZ: 8.3,
      dollyOffset: cameraDolly,
      dollyMultiplier: 1.48,
      xDrift: 0.22,
      yDrift: 0.05,
      zDrift: 0.06,
      targetY: -0.68,
      targetZ: -18.6,
      targetXDrift: 0.28,
      targetYDrift: 0.08,
      targetZDrift: 0.8,
    });
    const fog = this.scene.fog;
    if (fog instanceof THREE.FogExp2) {
      fog.density = 0.028 + surgeSection * 0.007 - pulseSection * 0.001;
    }
    this.bloomPass.strength = 0.26 + config.beatIntensity * 0.42 + pulseSection * 0.16 + surgeSection * 0.28;
    this.bloomPass.radius = 0.5 + config.beatIntensity * 0.12 + pulseSection * 0.06;
    this.bloomPass.threshold = Math.max(0.08, 0.24 - config.beatIntensity * 0.06 - surgeSection * 0.04);
    this.bundle.glow.material.opacity = 0.0005 * choreography.orbGain;
    this.bundle.core.material.opacity = 0.94;
    this.bundle.accent.material.opacity = 0.24 * choreography.rimGain;
    this.bundle.groundAura.material.opacity = 0.014 * choreography.auraGain;
    this.bundle.groundGlow.material.opacity = 0.052 * choreography.orbGain;
    this.bundle.groundRim.material.opacity = 0.12 * choreography.rimGain;
    this.bundle.surfaceDots.material.opacity = 0.08 * choreography.fieldGain;
    this.bundle.surfaceAccent.material.opacity = 0.12 * choreography.fieldGain;
    this.bundle.stars.material.opacity = 0.04 + choreography.fieldGain * 0.03 + surgeSection * 0.02;
    this.bundle.stars.material.size =
      0.1 +
      config.density * 0.026 +
      pulseSection * 0.016 +
      surgeSection * 0.03;
    this.bundle.horizonMaterial.opacity = 0.07 + pulseSection * 0.03 + surgeSection * 0.02;
    this.bundle.floorTiles.forEach((tile) => {
      tile.fillMaterial.opacity = 0.03 + pulseSection * 0.02;
      tile.wireMaterial.opacity = 0.14 + surgeSection * 0.08 + settleSection * 0.04;
      tile.guideRails.forEach((plane) => {
        plane.material.opacity = 0.12 + surgeSection * 0.08;
      });
      tile.guideDashes.forEach((plane) => {
        plane.material.opacity = 0.1 + pulseSection * 0.08 + surgeSection * 0.04;
      });
    });
    this.bundle.horizonMesh.position.set(
      Math.sin(time * 0.08) * 0.24,
      4.8 + Math.cos(time * 0.11) * 0.12,
      -28 - cameraDolly * 0.92,
    );

    updateLightsInstances({
      choreography,
      config,
      floorTiles: this.bundle.floorTiles,
      frame,
      helper: this.helper,
      meshes: {
        accent: this.bundle.accent,
        core: this.bundle.core,
        glow: this.bundle.glow,
        groundAura: this.bundle.groundAura,
        groundGlow: this.bundle.groundGlow,
        groundRim: this.bundle.groundRim,
        surfaceAccent: this.bundle.surfaceAccent,
        surfaceDots: this.bundle.surfaceDots,
      },
      pulseHeroes: this.bundle.pulseHeroes,
      stars: this.bundle.stars,
      seeds,
    });

    this.composer.render();
  }

  public dispose() {
    disposeThreeLights({
      bundle: this.bundle,
      renderer: this.renderer,
      root: this.root,
      scene: this.scene,
    });
  }

  private ensureBundle(config: ReturnType<typeof resolveLightsEffectConfig>) {
    const signature = `orbs:${config.beamCount}`;
    if (this.bundle.signature === signature) {
      return;
    }

    this.root.clear();
    this.bundle.orbGeometry.dispose();
    this.bundle.dotGeometry.dispose();
    this.bundle.groundDiscGeometry.dispose();
    this.bundle.groundRingGeometry.dispose();
    this.bundle.floorTiles.forEach((tile) => {
      tile.geometry.dispose();
      tile.fillMaterial.dispose();
      tile.wireMaterial.dispose();
      tile.guideRails.forEach((plane) => {
        plane.geometry.dispose();
        plane.material.dispose();
      });
      tile.guideDashes.forEach((plane) => {
        plane.geometry.dispose();
        plane.material.dispose();
      });
    });
    this.bundle.horizonGeometry.dispose();
    this.bundle.horizonMaterial.dispose();
    this.bundle.glow.mesh.dispose();
    this.bundle.core.mesh.dispose();
    this.bundle.accent.mesh.dispose();
    this.bundle.groundAura.mesh.dispose();
    this.bundle.groundGlow.mesh.dispose();
    this.bundle.groundRim.mesh.dispose();
    this.bundle.surfaceDots.mesh.dispose();
    this.bundle.surfaceAccent.mesh.dispose();
    this.bundle.stars.geometry.dispose();
    this.bundle.stars.material.dispose();
    this.bundle.glow.material.dispose();
    this.bundle.core.material.dispose();
    this.bundle.accent.material.dispose();
    this.bundle.groundAura.material.dispose();
    this.bundle.groundGlow.material.dispose();
    this.bundle.groundRim.material.dispose();
    this.bundle.surfaceDots.material.dispose();
    this.bundle.surfaceAccent.material.dispose();
    this.bundle.stars.points.removeFromParent();

    this.bundle = createLightsMeshes({
      accentColor: config.accentColor,
      beamCount: config.beamCount,
      coreColor: config.primaryColor,
      glowColor: config.secondaryColor,
      root: this.root,
    });
  }

  private resolveConfig(modules?: ThreeLightsModules) {
    if (modules === this.resolvedModulesRef && this.resolvedConfigCache) {
      return this.resolvedConfigCache;
    }

    this.resolvedModulesRef = modules;
    this.resolvedConfigCache = resolveLightsEffectConfig(modules);
    return this.resolvedConfigCache;
  }

  private resolveSeeds(beamCount: number, seed: number) {
    if (this.seedCache?.beamCount === beamCount && this.seedCache.seed === seed) {
      return this.seedCache.seeds;
    }

    const seeds = buildBeamSeeds(beamCount, seed);
    this.seedCache = {
      beamCount,
      seed,
      seeds,
    };
    return seeds;
  }
}
