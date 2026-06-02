import * as THREE from "three";

import type {EffectClock, EffectInputState, EffectViewport, ParticleGalaxyConfig, VisualEffectScene} from "../../types";
import {createGalaxyGeometry} from "./createGalaxyGeometry";
import {particleGalaxyFragmentShader, particleGalaxyVertexShader} from "./shaders";
import {sanitizeParticleGalaxyConfig} from "./config";

const dampFactor = (lambda: number, delta: number) => 1 - Math.exp(-lambda * delta);

const damp = (current: number, target: number, lambda: number, delta: number) =>
  THREE.MathUtils.lerp(current, target, dampFactor(lambda, delta));

const decay = (current: number, lambda: number, delta: number) =>
  current * Math.exp(-lambda * delta);

export class ParticleGalaxyScene implements VisualEffectScene<ParticleGalaxyConfig> {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(54, 1, 0.1, 60);
  private readonly points = new THREE.Points();
  private readonly easedPointer = new THREE.Vector2();
  private readonly pointerTarget = new THREE.Vector2();
  private geometry: THREE.BufferGeometry | null = null;
  private config: ParticleGalaxyConfig;
  private drag = 0;
  private wheel = 0;
  private seed: number;

  private readonly material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: {value: 0},
      uSpeed: {value: 0.16},
      uParticleSize: {value: 1},
      uPixelRatio: {value: 1},
      uInteractionStrength: {value: 0.82},
      uDrag: {value: 0},
      uWheel: {value: 0},
      uGlow: {value: 1.15},
      uPointer: {value: new THREE.Vector2()},
    },
    vertexShader: particleGalaxyVertexShader,
    fragmentShader: particleGalaxyFragmentShader,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });

  constructor({config, seed = 1307}: {config: ParticleGalaxyConfig; seed?: number}) {
    this.config = sanitizeParticleGalaxyConfig(config);
    this.seed = seed;
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor("#03040b", 1);
    this.scene.background = new THREE.Color("#03040b");
    this.scene.fog = new THREE.Fog("#03040b", 8, 22);
    this.camera.position.set(0, 1.1, 8.4);

    this.points.frustumCulled = false;
    this.points.material = this.material;
    this.scene.add(this.points);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 32, 32),
      new THREE.MeshBasicMaterial({color: "#fff0a8", transparent: true, opacity: 0.75}),
    );
    this.scene.add(core);
    this.rebuildGeometry();
  }

  mount(target: HTMLElement) {
    target.appendChild(this.renderer.domElement);
  }

  setConfig(config: ParticleGalaxyConfig) {
    const nextConfig = sanitizeParticleGalaxyConfig(config);
    const shouldRebuild = nextConfig.particleCount !== this.config.particleCount;
    this.config = nextConfig;
    if (shouldRebuild) {
      this.rebuildGeometry();
    }
  }

  update({
    clock,
    input,
    viewport,
  }: {
    clock: EffectClock;
    viewport: EffectViewport;
    input: EffectInputState;
  }) {
    const delta = Math.min(0.05, Math.max(0.001, clock.delta));
    this.pointerTarget.set(input.pointerX, input.pointerY);
    this.easedPointer.lerp(this.pointerTarget, dampFactor(9.5, delta));
    this.drag = damp(this.drag, input.dragTarget, 8, delta);
    this.wheel = decay(input.wheel, 2.6, delta);

    this.material.uniforms.uTime.value = clock.time;
    this.material.uniforms.uSpeed.value = this.config.rotationSpeed;
    this.material.uniforms.uParticleSize.value = this.config.particleSize;
    this.material.uniforms.uPixelRatio.value = Math.min(viewport.pixelRatio, 1.75);
    this.material.uniforms.uInteractionStrength.value = this.config.interactionStrength;
    this.material.uniforms.uGlow.value = this.config.bloomStrength;
    this.material.uniforms.uPointer.value.copy(this.easedPointer);
    this.material.uniforms.uWheel.value = this.wheel;
    this.material.uniforms.uDrag.value = this.drag;

    this.points.rotation.z += delta * (0.025 + this.config.rotationSpeed * 0.18);
    this.points.rotation.x = damp(this.points.rotation.x, this.easedPointer.y * 0.08, 4.5, delta);
    this.points.rotation.y = damp(this.points.rotation.y, -this.easedPointer.x * 0.08, 4.5, delta);

    const cameraTargetZ = 8.4 - this.wheel * 0.75;
    this.camera.position.z = damp(this.camera.position.z, cameraTargetZ, 5, delta);
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  resize({width, height, pixelRatio}: EffectViewport) {
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    this.camera.aspect = safeWidth / safeHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(pixelRatio, 1.75));
    this.renderer.setSize(safeWidth, safeHeight, false);
  }

  dispose() {
    this.geometry?.dispose();
    this.material.dispose();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private rebuildGeometry() {
    this.geometry?.dispose();
    this.geometry = createGalaxyGeometry(this.config.particleCount, this.seed);
    this.points.geometry = this.geometry;
    this.seed += 1;
  }
}
