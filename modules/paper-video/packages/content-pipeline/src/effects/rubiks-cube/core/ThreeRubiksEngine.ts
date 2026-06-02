import * as THREE from "three";
import {resolveRubiksEffectConfig} from "../../../module-api";
import {createStageDisc} from "../../shared/createStageDisc";
import {applyOrbitRig} from "../../shared/updateCameraRigs";
import {buildRubiksSequenceCache, applyRubiksMoveProgress} from "./applyRubiksMove";
import {createRubiksCubelets} from "./createRubiksCubelets";
import {disposeThreeRubiks} from "./disposeThreeRubiks";
import {updateRubiksCubelets} from "./updateRubiksCubelets";
import type {
  RubiksSequenceCache,
  ThreeRubiksCubeletBundle,
  ThreeRubiksEngineOptions,
  ThreeRubiksModules,
  ThreeRubiksRenderParams,
} from "../rubiks-cube.types";

const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

export class ThreeRubiksEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly root = new THREE.Group();
  private readonly ambientLight = new THREE.AmbientLight(0xeaf1ff, 1.42);
  private readonly hemiLight = new THREE.HemisphereLight(0xf6fbff, 0x0b0f15, 1.1);
  private readonly keyLight = new THREE.DirectionalLight(0xffffff, 1.42);
  private readonly fillLight = new THREE.DirectionalLight(0xffd4ab, 0.42);
  private readonly rimLight = new THREE.DirectionalLight(0x8fd2ff, 0.96);
  private readonly cameraTarget = new THREE.Vector3();
  private readonly cubeCore = new THREE.Mesh(
    new THREE.BoxGeometry(1.85, 1.85, 1.85),
    new THREE.MeshStandardMaterial({
      color: 0x090b0e,
      metalness: 0.08,
      roughness: 0.92,
    }),
  );
  private readonly contactShadow = createStageDisc({
    color: 0x04070b,
    opacity: 0.22,
    radius: 2.68,
    y: -3.12,
  });
  private readonly haloPlane = createStageDisc({
    additive: true,
    color: 0x153455,
    opacity: 0.07,
    radius: 4.6,
    scaleY: 0.94,
    y: -3.16,
    z: 0.08,
    segments: 64,
  });
  private readonly bundle: ThreeRubiksCubeletBundle;
  private width = 0;
  private height = 0;
  private resolvedModulesRef: ThreeRubiksModules | undefined;
  private resolvedConfigCache: ReturnType<typeof resolveRubiksEffectConfig> | null = null;
  private sequenceCache: RubiksSequenceCache | null = null;

  public constructor(canvas: HTMLCanvasElement, options: ThreeRubiksEngineOptions) {
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
      throw new Error("Unable to acquire a WebGL context for ThreeRubiksEngine");
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
    this.scene.fog = new THREE.Fog(0x081019, 12, 28);
    this.camera = new THREE.PerspectiveCamera(34, options.width / options.height, 0.1, 100);
    this.camera.position.set(5.8, 4.2, 7.3);
    this.camera.lookAt(0, 0, 0);

    this.keyLight.position.set(7, 9, 10);
    this.fillLight.position.set(-6, 2.5, 7);
    this.rimLight.position.set(-8, 5, -8);
    this.cubeCore.scale.setScalar(1.36);
    this.root.add(this.cubeCore);
    this.scene.add(
      this.contactShadow.mesh,
      this.haloPlane.mesh,
      this.ambientLight,
      this.hemiLight,
      this.keyLight,
      this.fillLight,
      this.rimLight,
    );

    this.bundle = createRubiksCubelets({root: this.root});
    this.resize(options.width, options.height);
  }

  public resize(width: number, height: number) {
    if (width === this.width && height === this.height) {
      return;
    }

    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  public renderFrame(params: ThreeRubiksRenderParams) {
    const config = this.resolveConfig(params.modules);
    const sequence = this.resolveSequence(params.seed);
    const effectiveFrame = Math.max(0, params.simulationFrame ?? params.absoluteFrame);
    const states = this.resolveStatesForFrame({
      config,
      frame: effectiveFrame,
      sequence,
    });

    updateRubiksCubelets({
      cubieGap: config.cubieGap,
      cubelets: this.bundle.cubelets,
      states,
    });

    const time = effectiveFrame * 0.018 + params.seed * 0.0061;
    const settleProgress = Math.min(1, effectiveFrame / 96);
    const cameraRadius = 7.3 - settleProgress * 0.48;

    this.root.scale.setScalar(config.cubeScale);
    this.root.position.set(0, Math.sin(time * 0.72) * config.floatAmplitude, 0);
    this.root.rotation.set(
      -0.48 + Math.sin(time * 0.48) * config.cameraDrift * 0.32,
      0.62 + Math.cos(time * 0.31) * config.cameraDrift * 0.2,
      Math.sin(time * 0.58) * config.cameraDrift * 0.16,
    );
    applyOrbitRig({
      camera: this.camera,
      target: this.cameraTarget,
      time,
      orbitSpeed: 0.36,
      radius: cameraRadius,
      radiusJitter: 0.12,
      centerY: 4.15,
      heightJitter: config.cameraDrift * 1.9,
      targetY: 0.1,
      targetYJitter: 0.12,
    });
    this.contactShadow.mesh.scale.setScalar(1 + Math.sin(time * 0.64) * 0.03);
    this.haloPlane.mesh.scale.setScalar(1 + Math.cos(time * 0.38) * 0.04);

    this.renderer.render(this.scene, this.camera);
  }

  public dispose() {
    disposeThreeRubiks({
      bundle: this.bundle,
      renderer: this.renderer,
      root: this.root,
      scene: this.scene,
    });
    this.cubeCore.geometry.dispose();
    if (Array.isArray(this.cubeCore.material)) {
      this.cubeCore.material.forEach((material) => material.dispose());
    } else {
      this.cubeCore.material.dispose();
    }
    this.contactShadow.geometry.dispose();
    this.contactShadow.material.dispose();
    this.haloPlane.geometry.dispose();
    this.haloPlane.material.dispose();
  }

  private resolveConfig(modules?: ThreeRubiksModules) {
    if (modules === this.resolvedModulesRef && this.resolvedConfigCache) {
      return this.resolvedConfigCache;
    }

    this.resolvedModulesRef = modules;
    this.resolvedConfigCache = resolveRubiksEffectConfig(modules);
    return this.resolvedConfigCache;
  }

  private resolveSequence(seed: number) {
    if (this.sequenceCache?.seed === seed) {
      return this.sequenceCache;
    }

    this.sequenceCache = buildRubiksSequenceCache(seed);
    return this.sequenceCache;
  }

  private resolveStatesForFrame({
    config,
    frame,
    sequence,
  }: {
    config: ReturnType<typeof resolveRubiksEffectConfig>;
    frame: number;
    sequence: RubiksSequenceCache;
  }) {
    const cycle = Math.max(1, config.turnFrames + config.holdFrames);
    const stepIndex = Math.floor(frame / cycle);
    const stepFrame = frame % cycle;
    const lastState = sequence.statesByStep[sequence.statesByStep.length - 1];

    if (stepIndex >= sequence.solve.length) {
      return lastState;
    }

    if (stepFrame < config.turnFrames) {
      const progress = easeInOutCubic(stepFrame / Math.max(1, config.turnFrames));
      return applyRubiksMoveProgress(
        sequence.statesByStep[stepIndex],
        sequence.solve[stepIndex],
        progress,
      );
    }

    return sequence.statesByStep[Math.min(stepIndex + 1, sequence.statesByStep.length - 1)];
  }
}
