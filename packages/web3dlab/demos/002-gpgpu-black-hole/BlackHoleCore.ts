import * as THREE from 'three';
import { EffectScene, EffectFrame } from '../../core/EffectContract';
import { PRNG } from '../../core/math/PRNG';
import computePositionFrag from './shaders/computePosition.frag?raw';
import computeVelocityFrag from './shaders/computeVelocity.frag?raw';
import renderVert from './shaders/render.vert?raw';
import renderFrag from './shaders/render.frag?raw';

export type BlackHoleConfig = {
  gravity: number;
  friction: number;
  turbulence: number;
  feedRate: number;
  particleSize: number;
  horizonGlow: number;
  colorCore: string;
  colorOuter: string;
};

const TEX_SIZE = 1024;
const PARTICLE_COUNT = TEX_SIZE * TEX_SIZE;

const fullscreenVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export class BlackHoleCore implements EffectScene<BlackHoleConfig> {
  private config: BlackHoleConfig = {
    gravity: 18.0,
    friction: 0.985,
    turbulence: 0.7,
    feedRate: 0.0014,
    particleSize: 2.1,
    horizonGlow: 0.95,
    colorCore: '#ffbc66',
    colorOuter: '#3d7dff'
  };

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  
  // GPGPU Resources
  private gpgpuScene: THREE.Scene;
  private gpgpuCamera: THREE.OrthographicCamera;
  private gpgpuMesh: THREE.Mesh;
  private rtPosition: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private rtVelocity: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private matPosition: THREE.ShaderMaterial;
  private matVelocity: THREE.ShaderMaterial;
  private step = 0;

  // Main Render Resources
  private particlesMesh: THREE.Points;
  private particlesGeo: THREE.BufferGeometry;
  private particlesMat: THREE.ShaderMaterial;
  private coreMesh: THREE.Mesh;

  private pointerWorld = new THREE.Vector3(0, 0, 0);

  constructor() {
    this.scene = new THREE.Scene();
    // Default camera, will be overridden or managed by the caller usually, but we keep an internal one for self-rendering
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(0, 8, 20);
    this.camera.lookAt(0, 0, 0);

    this.gpgpuScene = new THREE.Scene();
    this.gpgpuCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.gpgpuMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.gpgpuScene.add(this.gpgpuMesh);

    const rtOptions: THREE.RenderTargetOptions = {
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: false,
      stencilBuffer: false,
    };

    this.rtPosition = [
      new THREE.WebGLRenderTarget(TEX_SIZE, TEX_SIZE, rtOptions),
      new THREE.WebGLRenderTarget(TEX_SIZE, TEX_SIZE, rtOptions)
    ];
    this.rtVelocity = [
      new THREE.WebGLRenderTarget(TEX_SIZE, TEX_SIZE, rtOptions),
      new THREE.WebGLRenderTarget(TEX_SIZE, TEX_SIZE, rtOptions)
    ];

    this.matVelocity = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: computeVelocityFrag,
      uniforms: {
        uResolution: { value: new THREE.Vector2(TEX_SIZE, TEX_SIZE) },
        uPosition: { value: null },
        uVelocity: { value: null },
        uDelta: { value: 0.016 },
        uTime: { value: 0 },
        uPointer: { value: new THREE.Vector3() },
        uGravity: { value: this.config.gravity },
        uFriction: { value: this.config.friction },
        uTurbulence: { value: this.config.turbulence },
        uFeedRate: { value: this.config.feedRate },
      }
    });

    this.matPosition = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: computePositionFrag,
      uniforms: {
        uResolution: { value: new THREE.Vector2(TEX_SIZE, TEX_SIZE) },
        uPosition: { value: null },
        uVelocity: { value: null },
        uDelta: { value: 0.016 },
        uTime: { value: 0 },
        uFeedRate: { value: this.config.feedRate },
      }
    });

    // ----------------------------------------
    // Initialize Main Render Mesh (1M Soft Particles)
    // ----------------------------------------
    const pointsGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const uvs = new Float32Array(PARTICLE_COUNT * 2);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // initial dummy positions
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      uvs[i * 2] = (i % TEX_SIZE) / TEX_SIZE;
      uvs[i * 2 + 1] = Math.floor(i / TEX_SIZE) / TEX_SIZE;
    }
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointsGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.particlesGeo = pointsGeo;

    this.particlesMat = new THREE.ShaderMaterial({
      uniforms: {
        uPosition: { value: null },
        uVelocity: { value: null },
        uColorCore: { value: new THREE.Color(this.config.colorCore) },
        uColorOuter: { value: new THREE.Color(this.config.colorOuter) },
        uParticleSize: { value: this.config.particleSize },
        uHorizonGlow: { value: this.config.horizonGlow },
      },
      vertexShader: renderVert,
      fragmentShader: renderFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }) as any; // Cast as any because we overwrite particlesMat type

    this.particlesMesh = new THREE.Points(pointsGeo, this.particlesMat) as any;
    this.particlesMesh.frustumCulled = false;
    this.particlesMesh.renderOrder = 2;
    this.scene.add(this.particlesMesh);

    // ==========================================
    // Vantablack Core (Event Horizon Mask)
    // ==========================================
    // Must write to depth buffer so particles behind it are occluded!
    const coreGeo = new THREE.SphereGeometry(1.0, 64, 64);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000, depthWrite: true });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.coreMesh.renderOrder = 1; // Renders first to write depth!
    this.scene.add(this.coreMesh);
  }

  private initGPGPUState(seed: number) {
    if (!this.renderer) return;

    const prng = new PRNG(seed);
    const pos = new Float32Array(PARTICLE_COUNT * 4);
    const vel = new Float32Array(PARTICLE_COUNT * 4);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const innerLane = prng.next() < 0.42;
      const radiusSample = prng.next();
      const radius = innerLane
        ? 1.65 + Math.pow(radiusSample, 1.7) * 4.35
        : 7.5 + Math.sqrt(radiusSample) * 10.5;
      const angle = prng.next() * Math.PI * 2;
      const diskHeight = innerLane ? 0.22 + radius * 0.05 : 0.32 + radius * 0.04;
      
      pos[i * 4] = Math.cos(angle) * radius;
      pos[i * 4 + 1] = (prng.next() - 0.5) * diskHeight;
      pos[i * 4 + 2] = Math.sin(angle) * radius;
      pos[i * 4 + 3] = prng.next(); 

      const speed = Math.sqrt(this.config.gravity / radius) * (innerLane ? 1.55 : 1.35);
      vel[i * 4] = -Math.sin(angle) * speed;
      vel[i * 4 + 1] = 0;
      vel[i * 4 + 2] = Math.cos(angle) * speed;
      vel[i * 4 + 3] = 0;
    }

    const posTex = new THREE.DataTexture(pos, TEX_SIZE, TEX_SIZE, THREE.RGBAFormat, THREE.FloatType);
    posTex.needsUpdate = true;
    const velTex = new THREE.DataTexture(vel, TEX_SIZE, TEX_SIZE, THREE.RGBAFormat, THREE.FloatType);
    velTex.needsUpdate = true;

    const initMat = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertexShader,
      fragmentShader: `
        uniform sampler2D uInitTexture;
        varying vec2 vUv;
        void main() { gl_FragColor = texture2D(uInitTexture, vUv); }
      `,
      uniforms: { uInitTexture: { value: null } }
    });

    // Write Initial Pos
    initMat.uniforms.uInitTexture.value = posTex;
    this.gpgpuMesh.material = initMat;
    this.renderer.setRenderTarget(this.rtPosition[0]);
    this.renderer.render(this.gpgpuScene, this.gpgpuCamera);
    this.renderer.setRenderTarget(this.rtPosition[1]);
    this.renderer.render(this.gpgpuScene, this.gpgpuCamera);

    // Write Initial Vel
    initMat.uniforms.uInitTexture.value = velTex;
    this.gpgpuMesh.material = initMat;
    this.renderer.setRenderTarget(this.rtVelocity[0]);
    this.renderer.render(this.gpgpuScene, this.gpgpuCamera);
    this.renderer.setRenderTarget(this.rtVelocity[1]);
    this.renderer.render(this.gpgpuScene, this.gpgpuCamera);

    this.renderer.setRenderTarget(null);

    posTex.dispose();
    velTex.dispose();
    initMat.dispose();
  }

  public mount(target: HTMLElement | null): void {
    if (!target) return;
  }

  public setRenderer(renderer: THREE.WebGLRenderer, seed: number) {
    if (!this.renderer) {
      this.renderer = renderer;
      this.initGPGPUState(seed);
    }
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }
  public getCamera(): THREE.Camera {
    return this.camera;
  }

  public setConfig(config: BlackHoleConfig): void {
    this.config = config;
    if (this.particlesMat.uniforms) {
      this.particlesMat.uniforms.uColorCore.value.set(this.config.colorCore);
      this.particlesMat.uniforms.uColorOuter.value.set(this.config.colorOuter);
      this.particlesMat.uniforms.uParticleSize.value = this.config.particleSize;
      this.particlesMat.uniforms.uHorizonGlow.value = this.config.horizonGlow;
    }
  }

  public resize(width: number, height: number, pixelRatio: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  public renderFrame(frame: EffectFrame): void {
    if (!this.renderer) return;

    const clampedDelta = Math.min(frame.delta, 0.032); // Max ~30fps delta logic step to prevent explosion
    const current = this.step % 2;
    const next = (this.step + 1) % 2;

    // Calculate Pointer World Position
    const vector = new THREE.Vector3(frame.input.pointer.x, frame.input.pointer.y, 0.5);
    vector.unproject(this.camera);
    const dir = vector.sub(this.camera.position).normalize();
    const distance = -this.camera.position.z / dir.z; 
    this.pointerWorld.copy(this.camera.position).clone().add(dir.multiplyScalar(distance));

    // 1. Compute Velocity
    this.matVelocity.uniforms.uDelta.value = clampedDelta;
    this.matVelocity.uniforms.uTime.value = frame.time;
    this.matVelocity.uniforms.uPointer.value.copy(this.pointerWorld);
    this.matVelocity.uniforms.uGravity.value = this.config.gravity;
    this.matVelocity.uniforms.uFriction.value = this.config.friction;
    this.matVelocity.uniforms.uFeedRate.value = this.config.feedRate;
    if(this.matVelocity.uniforms.uTurbulence) {
       this.matVelocity.uniforms.uTurbulence.value = this.config.turbulence;
    }
    this.matVelocity.uniforms.uPosition.value = this.rtPosition[current].texture;
    this.matVelocity.uniforms.uVelocity.value = this.rtVelocity[current].texture;

    this.gpgpuMesh.material = this.matVelocity;
    this.renderer.setRenderTarget(this.rtVelocity[next]);
    this.renderer.render(this.gpgpuScene, this.gpgpuCamera);

    // 2. Compute Position
    this.matPosition.uniforms.uDelta.value = clampedDelta;
    this.matPosition.uniforms.uTime.value = frame.time;
    this.matPosition.uniforms.uFeedRate.value = this.config.feedRate;
    this.matPosition.uniforms.uPosition.value = this.rtPosition[current].texture;
    this.matPosition.uniforms.uVelocity.value = this.rtVelocity[next].texture;

    this.gpgpuMesh.material = this.matPosition;
    this.renderer.setRenderTarget(this.rtPosition[next]);
    this.renderer.render(this.gpgpuScene, this.gpgpuCamera);

    this.renderer.setRenderTarget(null);

    // 3. Update Render Material
    if (this.particlesMat.uniforms) {
      this.particlesMat.uniforms.uPosition.value = this.rtPosition[next].texture;
      this.particlesMat.uniforms.uVelocity.value = this.rtVelocity[next].texture;
    }

    this.step++;
  }

  public dispose(): void {
    // 彻底销毁 GPU 资源，防泄漏
    this.rtPosition[0].dispose();
    this.rtPosition[1].dispose();
    this.rtVelocity[0].dispose();
    this.rtVelocity[1].dispose();
    this.matPosition.dispose();
    this.matVelocity.dispose();
    
    this.particlesGeo.dispose();
    this.particlesMat.dispose();
    this.coreMesh.geometry.dispose();
    (this.coreMesh.material as THREE.Material).dispose();
    this.gpgpuMesh.geometry.dispose();

    this.scene.clear();
    this.gpgpuScene.clear();
    this.renderer = null;
  }
}
