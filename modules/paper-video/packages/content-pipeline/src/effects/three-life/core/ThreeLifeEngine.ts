import * as THREE from "three";
import {resolveCellularEffectConfig} from "../../../module-api";
import {buildCellularLifeCells} from "../../../visual-system";
import {createLifeMeshes} from "./createLifeMeshes";
import {disposeLifeMeshes, disposeThreeLife} from "./disposeThreeLife";
import {updateLifeInstances} from "./updateLifeInstances";
import type {
  ThreeLifeEngineOptions,
  ThreeLifeMeshBundle,
  ThreeLifeModules,
  ThreeLifeRenderParams,
} from "../three-life.types";

export class ThreeLifeEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly helper = new THREE.Object3D();
  private width: number;
  private height: number;
  private meshBundle: ThreeLifeMeshBundle | null = null;
  private resolvedModulesRef: ThreeLifeModules | undefined;
  private resolvedConfigCache: ReturnType<typeof resolveCellularEffectConfig> | null = null;

  public constructor(canvas: HTMLCanvasElement, options: ThreeLifeEngineOptions) {
    this.canvas = canvas;
    this.width = 0;
    this.height = 0;

    const contextAttributes: WebGLContextAttributes = {
      alpha: true,
      antialias: false,
      depth: false,
      failIfMajorPerformanceCaveat: false,
      powerPreference: "default",
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
      throw new Error("Unable to acquire a WebGL context for ThreeLifeEngine");
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      alpha: true,
      antialias: false,
      powerPreference: "default",
    });
    this.renderer.setClearColor(new THREE.Color(0x000000), 0);
    this.renderer.setPixelRatio(1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, options.width, options.height, 0, -100, 100);
    this.camera.position.z = 10;

    this.resize(options.width, options.height);
  }

  public resize(width: number, height: number) {
    if (width === this.width && height === this.height) {
      return;
    }

    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.right = width;
    this.camera.top = height;
    this.camera.bottom = 0;
    this.camera.updateProjectionMatrix();
  }

  public renderFrame(params: ThreeLifeRenderParams) {
    const config = this.resolveConfig(params.modules);
    this.ensureMeshes(config);

    const effectiveFrame = params.simulationFrame ?? params.absoluteFrame;
    const cells = buildCellularLifeCells({
      cols: Math.max(1, Math.round(config.cellColumns)),
      rows: Math.max(1, Math.round(config.cellRows)),
      globalFrame: effectiveFrame,
      activationFrame: params.activationFrame,
      seed: params.seed,
      stepEveryFrames: config.stepEveryFrames,
    });

    if (!this.meshBundle) {
      return;
    }

    updateLifeInstances({
      cells,
      config,
      helper: this.helper,
      height: this.height,
      meshes: this.meshBundle,
      width: this.width,
    });

    this.renderer.render(this.scene, this.camera);
  }

  public dispose() {
    disposeThreeLife({
      meshBundle: this.meshBundle,
      renderer: this.renderer,
      scene: this.scene,
    });
    this.meshBundle = null;
  }

  private resolveConfig(modules?: ThreeLifeModules) {
    if (modules === this.resolvedModulesRef && this.resolvedConfigCache) {
      return this.resolvedConfigCache;
    }

    this.resolvedModulesRef = modules;
    this.resolvedConfigCache = resolveCellularEffectConfig(modules);
    return this.resolvedConfigCache;
  }

  private ensureMeshes(config: ReturnType<typeof resolveCellularEffectConfig>) {
    const cols = Math.max(1, Math.round(config.cellColumns));
    const rows = Math.max(1, Math.round(config.cellRows));
    const signature = `${cols}x${rows}`;

    if (this.meshBundle?.signature === signature) {
      return;
    }

    if (this.meshBundle) {
      disposeLifeMeshes({
        meshBundle: this.meshBundle,
        scene: this.scene,
      });
    }

    this.meshBundle = createLifeMeshes({
      config,
      scene: this.scene,
    });
  }
}
