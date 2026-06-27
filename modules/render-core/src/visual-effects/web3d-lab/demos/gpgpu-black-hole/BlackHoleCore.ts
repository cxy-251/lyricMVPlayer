import * as THREE from 'three';
import { EffectScene, EffectFrame } from '../../core/EffectContract';
import { PRNG } from '../../core/math/PRNG';
import computePositionFrag from './shaders/computePosition.frag?raw';
import computeVelocityFrag from './shaders/computeVelocity.frag?raw';

export type BlackHoleConfig = {
  gravity: number;
  friction: number;
  colorCore: string;
  colorOuter: string;
};

const TEX_SIZE = 512;
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
    gravity: 85.0,
    friction: 0.99,
    colorCore: '#ff8822',
    colorOuter: '#2255ff'
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
  private particlesMesh: THREE.Mesh;
  private particlesGeo: THREE.InstancedBufferGeometry;
  private particlesMat: THREE.MeshBasicMaterial;
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
      }
    });

    // ----------------------------------------
    // Initialize Main Render Mesh
    // ----------------------------------------
    const geo = new THREE.TetrahedronGeometry(0.006, 0);
    const uvs = new Float32Array(PARTICLE_COUNT * 2);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      uvs[i * 2] = (i % TEX_SIZE) / TEX_SIZE;
      uvs[i * 2 + 1] = Math.floor(i / TEX_SIZE) / TEX_SIZE;
    }
    this.particlesGeo = new THREE.InstancedBufferGeometry();
    this.particlesGeo.copy(geo as unknown as THREE.InstancedBufferGeometry);
    this.particlesGeo.instanceCount = PARTICLE_COUNT;
    this.particlesGeo.setAttribute('aUv', new THREE.InstancedBufferAttribute(uvs, 2));

    this.particlesMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particlesMat.onBeforeCompile = (shader) => {
      shader.uniforms.uPosition = { value: null };
      shader.uniforms.uVelocity = { value: null };
      shader.uniforms.uColorCore = { value: new THREE.Color(this.config.colorCore) };
      shader.uniforms.uColorOuter = { value: new THREE.Color(this.config.colorOuter) };
      this.particlesMat.userData.shader = shader;

      shader.vertexShader = `
        uniform sampler2D uPosition;
        uniform sampler2D uVelocity;
        uniform vec3 uColorCore;
        uniform vec3 uColorOuter;
        attribute vec2 aUv;
        varying vec3 vInstColor;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        vec4 posData = texture2D(uPosition, aUv);
        vec4 velData = texture2D(uVelocity, aUv);
        
        float dist = length(posData.xz);
        vec3 color = mix(uColorCore, uColorOuter, smoothstep(1.5, 12.0, dist));
        
        vec3 vel = velData.xyz;
        float speed = length(vel);
        vec3 viewDir = normalize(cameraPosition - posData.xyz);
        float doppler = speed > 0.0001 ? dot(vel / speed, viewDir) : 0.0;
        
        color = mix(color, vec3(1.0, 0.1, 0.0), clamp(-doppler * 0.4, 0.0, 1.0)); 
        color = mix(color, vec3(0.5, 0.8, 1.0), clamp(doppler * 0.4, 0.0, 1.0)); 
        
        float eventHorizonGlow = smoothstep(4.0, 1.5, dist);
        color += vec3(1.0, 0.8, 0.4) * eventHorizonGlow * 3.0; 
        
        vInstColor = color;
        
        vec3 forward = speed > 0.001 ? normalize(vel) : vec3(0.0, 0.0, 1.0);
        vec3 up = vec3(0.0, 1.0, 0.0);
        if (abs(forward.y) > 0.999) { up = vec3(1.0, 0.0, 0.0); }
        vec3 right = normalize(cross(up, forward));
        up = cross(forward, right);
        mat3 rot = mat3(right, up, forward);
        
        vec3 scaledPos = position;
        scaledPos.z *= max(1.0, speed * 0.05); 
        
        float distToCamera = length(cameraPosition - posData.xyz);
        float cameraFadeScale = smoothstep(10.0, 18.0, distToCamera);
        scaledPos *= cameraFadeScale;
        
        vec3 transformed = rot * scaledPos + posData.xyz;
        `
      );

      shader.fragmentShader = `
        varying vec3 vInstColor;
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `vec4 diffuseColor = vec4( vInstColor, opacity );`
      );
    };

    this.particlesMesh = new THREE.Mesh(this.particlesGeo, this.particlesMat);
    this.particlesMesh.frustumCulled = false;
    this.particlesMesh.renderOrder = 2;
    this.scene.add(this.particlesMesh);

    // Vantablack Core
    const coreGeo = new THREE.SphereGeometry(1.5, 64, 64);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.coreMesh.renderOrder = 1;
    this.scene.add(this.coreMesh);
  }

  private initGPGPUState(seed: number) {
    if (!this.renderer) return;

    const prng = new PRNG(seed);
    const pos = new Float32Array(PARTICLE_COUNT * 4);
    const vel = new Float32Array(PARTICLE_COUNT * 4);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const radius = Math.pow(prng.next(), 3.0) * 30.0 + 1.0; 
      const angle = prng.next() * Math.PI * 2;
      
      pos[i * 4] = Math.cos(angle) * radius;
      pos[i * 4 + 1] = (prng.next() - 0.5) * 0.5 * (radius * 0.1); 
      pos[i * 4 + 2] = Math.sin(angle) * radius;
      pos[i * 4 + 3] = prng.next(); 

      const speed = 4.0 / Math.sqrt(radius);
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
    // In this architecture, the external adapter/engine usually provides the renderer.
    // If the core needs to render itself fully standalone, it would create the renderer.
    // Since web3dlab relies on React Three Fiber for the canvas context, 
    // we'll extract the renderer from R3F in the adapter and pass it via an extended mount or setter.
  }

  // We add a specific setter for R3F integration
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
    if (this.particlesMat.userData.shader) {
      this.particlesMat.userData.shader.uniforms.uColorCore.value.set(this.config.colorCore);
      this.particlesMat.userData.shader.uniforms.uColorOuter.value.set(this.config.colorOuter);
    }
  }

  public resize(width: number, height: number, pixelRatio: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  public renderFrame(frame: EffectFrame): void {
    if (!this.renderer) return;

    const clampedDelta = Math.min(frame.delta, 0.05);
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
    this.matVelocity.uniforms.uPosition.value = this.rtPosition[current].texture;
    this.matVelocity.uniforms.uVelocity.value = this.rtVelocity[current].texture;

    this.gpgpuMesh.material = this.matVelocity;
    this.renderer.setRenderTarget(this.rtVelocity[next]);
    this.renderer.render(this.gpgpuScene, this.gpgpuCamera);

    // 2. Compute Position
    this.matPosition.uniforms.uDelta.value = clampedDelta;
    this.matPosition.uniforms.uPosition.value = this.rtPosition[current].texture;
    this.matPosition.uniforms.uVelocity.value = this.rtVelocity[next].texture;

    this.gpgpuMesh.material = this.matPosition;
    this.renderer.setRenderTarget(this.rtPosition[next]);
    this.renderer.render(this.gpgpuScene, this.gpgpuCamera);

    this.renderer.setRenderTarget(null);

    // 3. Update Render Material
    if (this.particlesMat.userData.shader) {
      this.particlesMat.userData.shader.uniforms.uPosition.value = this.rtPosition[next].texture;
      this.particlesMat.userData.shader.uniforms.uVelocity.value = this.rtVelocity[next].texture;
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
