import * as THREE from "three";

import type {
  EffectBlendMode,
  EffectFrameContext,
  EffectViewport,
  RecipeLayer,
  VisualEffectAtom,
  VisualEffectLayer,
  VisualEffectRecipe,
} from "../types";
import {hashSeed} from "./random";

type LayerInstance = {
  definition: RecipeLayer;
  layer: VisualEffectLayer<Record<string, unknown>>;
  failed: boolean;
};

const blendModeValue: Record<EffectBlendMode, number> = {normal: 0, add: 1, screen: 2, multiply: 3};

const vertexShader = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`;

const compositeFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uBase;
  uniform sampler2D uLayer;
  uniform float uOpacity;
  uniform float uBlendMode;
  uniform vec4 uTransform;

  void main() {
    vec2 centered = vUv - 0.5 - uTransform.xy;
    float angle = -uTransform.w;
    centered = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * centered;
    vec2 layerUv = centered / max(0.001, uTransform.z) + 0.5;
    vec4 base = texture2D(uBase, vUv);
    vec4 layer = vec4(0.0);
    if (all(greaterThanEqual(layerUv, vec2(0.0))) && all(lessThanEqual(layerUv, vec2(1.0)))) {
      layer = texture2D(uLayer, layerUv);
    }
    float alpha = clamp(layer.a * uOpacity, 0.0, 1.0);
    vec3 premultiplied = layer.rgb * uOpacity;
    vec3 rgb;
    if (uBlendMode < 0.5) {
      rgb = base.rgb * (1.0 - alpha) + premultiplied;
    } else if (uBlendMode < 1.5) {
      rgb = min(vec3(1.0), base.rgb + premultiplied);
    } else if (uBlendMode < 2.5) {
      rgb = 1.0 - (1.0 - base.rgb) * (1.0 - premultiplied);
    } else {
      vec3 straight = layer.rgb / max(layer.a, 0.001);
      rgb = mix(base.rgb, base.rgb * straight, alpha);
    }
    gl_FragColor = vec4(rgb, alpha + base.a * (1.0 - alpha));
  }
`;

const copyFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  void main() { gl_FragColor = texture2D(uTexture, vUv); }
`;

export class LayerCompositor {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly atomMap: Map<string, VisualEffectAtom>;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly blendMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: compositeFragmentShader,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uBase: {value: null},
      uLayer: {value: null},
      uOpacity: {value: 1},
      uBlendMode: {value: 0},
      uTransform: {value: new THREE.Vector4(0, 0, 1, 0)},
    },
  });
  private readonly copyMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: copyFragmentShader,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    uniforms: {uTexture: {value: null}},
  });
  private readonly quad = new THREE.Mesh(this.geometry, this.blendMaterial);
  private readonly targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private instances: LayerInstance[] = [];
  private viewport: EffectViewport = {width: 1, height: 1, pixelRatio: 1};
  private readonly seed: number;

  constructor(options: {
    renderer: THREE.WebGLRenderer;
    atoms: VisualEffectAtom[];
    recipe: VisualEffectRecipe;
    seed: number;
  }) {
    this.renderer = options.renderer;
    this.atomMap = new Map(options.atoms.map((atom) => [atom.id, atom]));
    this.seed = options.seed;
    this.targets = [this.createTarget(), this.createTarget()];
    this.scene.add(this.quad);
    this.setRecipe(options.recipe);
  }

  setRecipe(recipe: VisualEffectRecipe) {
    this.instances.forEach((instance) => instance.layer.dispose());
    this.instances = recipe.layers.flatMap((definition) => {
      const atom = this.atomMap.get(definition.atomId);
      if (!atom) {
        console.warn(`[visual-effects] Missing atom: ${definition.atomId}`);
        return [];
      }
      const config = atom.sanitizeConfig({...atom.defaultConfig, ...definition.config});
      const layer = atom.createLayer({
        seed: hashSeed(this.seed, `${recipe.id}:${definition.id}`),
        config,
      }) as VisualEffectLayer<Record<string, unknown>>;
      layer.resize(this.viewport);
      return [{definition, layer, failed: false}];
    });
  }

  resize(viewport: EffectViewport) {
    this.viewport = viewport;
    const width = Math.max(1, Math.round(viewport.width * Math.min(2, viewport.pixelRatio)));
    const height = Math.max(1, Math.round(viewport.height * Math.min(2, viewport.pixelRatio)));
    this.targets.forEach((target) => target.setSize(width, height));
    this.instances.forEach((instance) => instance.layer.resize(viewport));
  }

  render(context: EffectFrameContext) {
    const renderer = this.renderer;
    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    renderer.autoClear = true;

    renderer.setRenderTarget(this.targets[0]);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);

    let readIndex = 0;
    for (const instance of this.instances) {
      if (!instance.definition.visible || instance.failed) continue;
      try {
        const layerContext = instance.definition.inputEnabled
          ? context
          : {...context, pointer: {x: 0, y: 0, pressed: 0, wheel: 0}};
        const texture = instance.layer.render(renderer, layerContext);
        const writeIndex = readIndex === 0 ? 1 : 0;
        this.quad.material = this.blendMaterial;
        this.blendMaterial.uniforms.uBase.value = this.targets[readIndex].texture;
        this.blendMaterial.uniforms.uLayer.value = texture;
        this.blendMaterial.uniforms.uOpacity.value = THREE.MathUtils.clamp(instance.definition.opacity, 0, 1);
        this.blendMaterial.uniforms.uBlendMode.value = blendModeValue[instance.definition.blendMode];
        const transform = instance.definition.transform;
        const interactiveScale = instance.definition.inputEnabled ? 1 + context.pointer.wheel * 0.3 : 1;
        this.blendMaterial.uniforms.uTransform.value.set(transform.x, transform.y, transform.scale * interactiveScale, transform.rotation);
        renderer.setRenderTarget(this.targets[writeIndex]);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, true);
        renderer.render(this.scene, this.camera);
        readIndex = writeIndex;
      } catch (error) {
        instance.failed = true;
        console.error(`[visual-effects] Layer failed: ${instance.definition.id}`, error);
      }
    }

    this.quad.material = this.copyMaterial;
    this.copyMaterial.uniforms.uTexture.value = this.targets[readIndex].texture;
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(this.scene, this.camera);
    renderer.autoClear = previousAutoClear;
  }

  dispose() {
    this.instances.forEach((instance) => instance.layer.dispose());
    this.targets.forEach((target) => target.dispose());
    this.geometry.dispose();
    this.blendMaterial.dispose();
    this.copyMaterial.dispose();
  }

  private createTarget() {
    return new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: false,
      stencilBuffer: false,
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
    });
  }
}
