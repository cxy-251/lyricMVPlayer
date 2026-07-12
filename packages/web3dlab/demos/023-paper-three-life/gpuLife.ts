import * as THREE from 'three';

export type LifeResetMode = 'clear' | 'random';
export type LifeRule = 'conway' | 'highlife' | 'seeds';

export type GpuLifeRuntime = {
  camera: THREE.OrthographicCamera;
  currentTarget: 0 | 1;
  editMaterial: THREE.ShaderMaterial;
  generation: number;
  initMaterial: THREE.ShaderMaterial;
  quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  scene: THREE.Scene;
  stepMaterial: THREE.ShaderMaterial;
  targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
};

const fullscreenVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const initFragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uDensity;
  uniform float uMode;
  uniform float uSeed;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7)) + uSeed * 17.13) * 43758.5453123);
  }

  void main() {
    if (uMode < 0.5) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float cluster = 0.72 + 0.28 * sin(vUv.x * 27.0 + sin(vUv.y * 19.0 + uSeed));
    float alive = step(hash(gl_FragCoord.xy), uDensity * cluster);
    float species = hash(gl_FragCoord.yx + vec2(73.0, 19.0));
    gl_FragColor = vec4(alive, species, alive, alive * 0.04);
  }
`;

const editFragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform vec4 uBrush;
  uniform sampler2D uState;
  uniform float uSpecies;

  void main() {
    vec4 state = texture2D(uState, vUv);
    float distanceToBrush = distance(vUv, uBrush.xy);
    if (distanceToBrush <= uBrush.z) {
      if (uBrush.w > 0.5) {
        float edge = smoothstep(uBrush.z, uBrush.z * 0.62, distanceToBrush);
        state = vec4(edge, uSpecies, max(state.b, edge), edge * 0.03);
      } else {
        state = vec4(0.0, state.g, max(state.b, 0.22), 0.0);
      }
    }
    gl_FragColor = state;
  }
`;

const stepFragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uMutation;
  uniform float uRule;
  uniform float uSeed;
  uniform float uTrailDecay;
  uniform sampler2D uState;
  uniform vec2 uTexel;

  float aliveAt(vec2 offset) {
    return step(0.5, texture2D(uState, vUv + offset * uTexel).r);
  }

  vec4 stateAt(vec2 offset) {
    return texture2D(uState, vUv + offset * uTexel);
  }

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(41.13, 289.91)) + uSeed * 11.7) * 45758.5453);
  }

  void main() {
    vec4 center = texture2D(uState, vUv);
    float n00 = aliveAt(vec2(-1.0, -1.0));
    float n10 = aliveAt(vec2( 0.0, -1.0));
    float n20 = aliveAt(vec2( 1.0, -1.0));
    float n01 = aliveAt(vec2(-1.0,  0.0));
    float n21 = aliveAt(vec2( 1.0,  0.0));
    float n02 = aliveAt(vec2(-1.0,  1.0));
    float n12 = aliveAt(vec2( 0.0,  1.0));
    float n22 = aliveAt(vec2( 1.0,  1.0));
    float neighbors = n00 + n10 + n20 + n01 + n21 + n02 + n12 + n22;
    float alive = step(0.5, center.r);

    float born = 0.0;
    float survives = 0.0;
    if (uRule < 0.5) {
      born = 1.0 - step(0.1, abs(neighbors - 3.0));
      survives = max(
        1.0 - step(0.1, abs(neighbors - 2.0)),
        1.0 - step(0.1, abs(neighbors - 3.0))
      );
    } else if (uRule < 1.5) {
      born = max(
        1.0 - step(0.1, abs(neighbors - 3.0)),
        1.0 - step(0.1, abs(neighbors - 6.0))
      );
      survives = max(
        1.0 - step(0.1, abs(neighbors - 2.0)),
        1.0 - step(0.1, abs(neighbors - 3.0))
      );
    } else {
      born = 1.0 - step(0.1, abs(neighbors - 2.0));
      survives = 0.0;
    }

    float nextAlive = max((1.0 - alive) * born, alive * survives);
    float speciesSum =
      stateAt(vec2(-1.0, -1.0)).g * n00 +
      stateAt(vec2( 0.0, -1.0)).g * n10 +
      stateAt(vec2( 1.0, -1.0)).g * n20 +
      stateAt(vec2(-1.0,  0.0)).g * n01 +
      stateAt(vec2( 1.0,  0.0)).g * n21 +
      stateAt(vec2(-1.0,  1.0)).g * n02 +
      stateAt(vec2( 0.0,  1.0)).g * n12 +
      stateAt(vec2( 1.0,  1.0)).g * n22;
    float inheritedSpecies = speciesSum / max(1.0, neighbors);
    float parentSelector = floor(hash(gl_FragCoord.xy + vec2(uSeed * 3.0, 47.0)) * 8.0);
    if (parentSelector < 1.0 && n00 > 0.5) inheritedSpecies = stateAt(vec2(-1.0, -1.0)).g;
    else if (parentSelector < 2.0 && n10 > 0.5) inheritedSpecies = stateAt(vec2(0.0, -1.0)).g;
    else if (parentSelector < 3.0 && n20 > 0.5) inheritedSpecies = stateAt(vec2(1.0, -1.0)).g;
    else if (parentSelector < 4.0 && n01 > 0.5) inheritedSpecies = stateAt(vec2(-1.0, 0.0)).g;
    else if (parentSelector < 5.0 && n21 > 0.5) inheritedSpecies = stateAt(vec2(1.0, 0.0)).g;
    else if (parentSelector < 6.0 && n02 > 0.5) inheritedSpecies = stateAt(vec2(-1.0, 1.0)).g;
    else if (parentSelector < 7.0 && n12 > 0.5) inheritedSpecies = stateAt(vec2(0.0, 1.0)).g;
    else if (n22 > 0.5) inheritedSpecies = stateAt(vec2(1.0, 1.0)).g;
    float mutationRoll = hash(gl_FragCoord.xy + vec2(uSeed, center.a * 97.0));
    float mutationShift = (hash(gl_FragCoord.yx + vec2(31.0, uSeed)) - 0.5) * 0.42;
    inheritedSpecies = fract(inheritedSpecies + step(mutationRoll, uMutation) * mutationShift);
    float nextSpecies = mix(inheritedSpecies, center.g, alive * nextAlive);
    float trail = max(center.b * uTrailDecay, alive * 0.96);
    float age = nextAlive > 0.5 ? min(1.0, center.a + 0.035) : 0.0;

    gl_FragColor = vec4(nextAlive, nextSpecies, trail, age);
  }
`;

export const lifeVertexShader = /* glsl */ `
  attribute vec2 instanceOffset;
  attribute vec2 instanceUv;

  varying float vAge;
  varying float vAlive;
  varying vec3 vNormal;
  varying float vSpecies;
  varying float vTrail;

  uniform float uCellSize;
  uniform float uHeight;
  uniform sampler2D uState;

  void main() {
    vec4 state = texture2D(uState, instanceUv);
    float alive = step(0.5, state.r);
    float visibleTrail = smoothstep(0.025, 0.72, state.b) * (1.0 - alive);
    float height = alive * uHeight + visibleTrail * uHeight * 0.16;
    vec3 transformed = position;
    transformed.xy *= uCellSize * mix(0.72, 0.9, alive);
    transformed.z = (position.z + 0.5) * max(0.018, height);
    transformed.xy += instanceOffset;

    vAge = state.a;
    vAlive = alive;
    vNormal = normalize(normalMatrix * normal);
    vSpecies = state.g;
    vTrail = visibleTrail;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

export const lifeFragmentShader = /* glsl */ `
  precision highp float;

  varying float vAge;
  varying float vAlive;
  varying vec3 vNormal;
  varying float vSpecies;
  varying float vTrail;
  uniform float uPalette;

  vec3 spectrum(float value) {
    return 0.56 + 0.44 * cos(6.28318 * (value + vec3(0.0, 0.66, 0.34)));
  }

  vec3 palette(float value) {
    if (uPalette < 0.5) {
      return spectrum(value);
    }
    if (uPalette < 1.5) {
      return mix(vec3(0.05, 0.85, 0.72), vec3(0.22, 0.34, 1.0), smoothstep(0.05, 0.95, value));
    }
    vec3 low = mix(vec3(0.18, 0.92, 0.38), vec3(0.95, 0.78, 0.18), smoothstep(0.0, 0.55, value));
    return mix(low, vec3(0.92, 0.22, 0.62), smoothstep(0.58, 1.0, value));
  }

  void main() {
    if (vAlive < 0.5 && vTrail < 0.025) discard;
    vec3 base = palette(vSpecies);
    vec3 lightDirection = normalize(vec3(-0.42, 0.58, 0.7));
    float diffuse = 0.34 + max(0.0, dot(vNormal, lightDirection)) * 0.76;
    float rim = pow(1.0 - max(0.0, vNormal.z), 2.4);
    float birthFlash = vAlive * (1.0 - smoothstep(0.0, 0.18, vAge));
    vec3 liveColor = base * diffuse + base * rim * 0.32 + birthFlash * base * 0.42;
    vec3 trailColor = mix(vec3(0.015, 0.035, 0.07), base * 0.32, vTrail);
    vec3 color = mix(trailColor, liveColor, vAlive);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const createTarget = (size: number) => {
  const target = new THREE.WebGLRenderTarget(size, size, {
    depthBuffer: false,
    format: THREE.RGBAFormat,
    generateMipmaps: false,
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestFilter,
    stencilBuffer: false,
    type: THREE.UnsignedByteType,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  return target;
};

export const createGpuLifeRuntime = (size: number): GpuLifeRuntime => {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const initMaterial = new THREE.ShaderMaterial({
    fragmentShader: initFragmentShader,
    uniforms: {
      uDensity: {value: 0.24},
      uMode: {value: 1},
      uSeed: {value: 1},
    },
    vertexShader: fullscreenVertexShader,
  });
  const editMaterial = new THREE.ShaderMaterial({
    fragmentShader: editFragmentShader,
    uniforms: {
      uBrush: {value: new THREE.Vector4(0.5, 0.5, 0.02, 1)},
      uSpecies: {value: 0.5},
      uState: {value: null},
    },
    vertexShader: fullscreenVertexShader,
  });
  const stepMaterial = new THREE.ShaderMaterial({
    fragmentShader: stepFragmentShader,
    uniforms: {
      uMutation: {value: 0.035},
      uRule: {value: 0},
      uSeed: {value: 1},
      uState: {value: null},
      uTexel: {value: new THREE.Vector2(1 / size, 1 / size)},
      uTrailDecay: {value: 0.92},
    },
    vertexShader: fullscreenVertexShader,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), initMaterial);
  scene.add(quad);
  return {
    camera,
    currentTarget: 0,
    editMaterial,
    generation: 0,
    initMaterial,
    quad,
    scene,
    stepMaterial,
    targets: [createTarget(size), createTarget(size)],
  };
};

const renderPass = (
  renderer: THREE.WebGLRenderer,
  runtime: GpuLifeRuntime,
  material: THREE.ShaderMaterial,
  targetIndex: 0 | 1,
) => {
  const previousTarget = renderer.getRenderTarget();
  runtime.quad.material = material;
  renderer.setRenderTarget(runtime.targets[targetIndex]);
  renderer.render(runtime.scene, runtime.camera);
  renderer.setRenderTarget(previousTarget);
};

export const resetGpuLife = ({
  density,
  mode,
  renderer,
  runtime,
  seed,
}: {
  density: number;
  mode: LifeResetMode;
  renderer: THREE.WebGLRenderer;
  runtime: GpuLifeRuntime;
  seed: number;
}) => {
  runtime.initMaterial.uniforms.uDensity.value = density;
  runtime.initMaterial.uniforms.uMode.value = mode === 'random' ? 1 : 0;
  runtime.initMaterial.uniforms.uSeed.value = seed;
  renderPass(renderer, runtime, runtime.initMaterial, 0);
  renderPass(renderer, runtime, runtime.initMaterial, 1);
  runtime.currentTarget = 0;
  runtime.generation = 0;
};

export const editGpuLife = ({
  brush,
  renderer,
  runtime,
  species,
}: {
  brush: THREE.Vector4;
  renderer: THREE.WebGLRenderer;
  runtime: GpuLifeRuntime;
  species: number;
}) => {
  const nextTarget = runtime.currentTarget === 0 ? 1 : 0;
  runtime.editMaterial.uniforms.uState.value = runtime.targets[runtime.currentTarget].texture;
  runtime.editMaterial.uniforms.uBrush.value.copy(brush);
  runtime.editMaterial.uniforms.uSpecies.value = species;
  renderPass(renderer, runtime, runtime.editMaterial, nextTarget);
  runtime.currentTarget = nextTarget;
};

const ruleValue = (rule: LifeRule) => rule === 'conway' ? 0 : rule === 'highlife' ? 1 : 2;

export const stepGpuLife = ({
  mutation,
  renderer,
  rule,
  runtime,
  seed,
  trailDecay,
}: {
  mutation: number;
  renderer: THREE.WebGLRenderer;
  rule: LifeRule;
  runtime: GpuLifeRuntime;
  seed: number;
  trailDecay: number;
}) => {
  const nextTarget = runtime.currentTarget === 0 ? 1 : 0;
  runtime.stepMaterial.uniforms.uMutation.value = mutation;
  runtime.stepMaterial.uniforms.uRule.value = ruleValue(rule);
  runtime.stepMaterial.uniforms.uSeed.value = seed + runtime.generation * 0.001;
  runtime.stepMaterial.uniforms.uState.value = runtime.targets[runtime.currentTarget].texture;
  runtime.stepMaterial.uniforms.uTrailDecay.value = trailDecay;
  renderPass(renderer, runtime, runtime.stepMaterial, nextTarget);
  runtime.currentTarget = nextTarget;
  runtime.generation += 1;
};

export const createLifeGeometry = ({boardSize, gridSize}: {boardSize: number; gridSize: number}) => {
  const source = new THREE.BoxGeometry(1, 1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setIndex(source.index?.clone() ?? null);
  Object.entries(source.attributes).forEach(([name, attribute]) => {
    geometry.setAttribute(name, attribute.clone());
  });

  const cellCount = gridSize * gridSize;
  const offsets = new Float32Array(cellCount * 2);
  const uvs = new Float32Array(cellCount * 2);
  let cursor = 0;
  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      offsets[cursor * 2] = ((x + 0.5) / gridSize - 0.5) * boardSize;
      offsets[cursor * 2 + 1] = ((y + 0.5) / gridSize - 0.5) * boardSize;
      uvs[cursor * 2] = (x + 0.5) / gridSize;
      uvs[cursor * 2 + 1] = (y + 0.5) / gridSize;
      cursor += 1;
    }
  }
  geometry.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(offsets, 2));
  geometry.setAttribute('instanceUv', new THREE.InstancedBufferAttribute(uvs, 2));
  geometry.instanceCount = cellCount;
  source.dispose();
  return geometry;
};

export const disposeGpuLifeRuntime = (runtime: GpuLifeRuntime) => {
  runtime.targets.forEach((target) => target.dispose());
  runtime.initMaterial.dispose();
  runtime.editMaterial.dispose();
  runtime.stepMaterial.dispose();
  runtime.quad.geometry.dispose();
};
