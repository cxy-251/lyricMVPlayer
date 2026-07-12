/*
 * GPU fluid pipeline inspired by Pavel Dobryakov's WebGL-Fluid-Simulation.
 * Original project Copyright (c) 2017 Pavel Dobryakov, MIT License.
 * This runtime is a TypeScript rewrite for web3dlab.
 */
import {
  ADVECTION_SHADER,
  BASE_VERTEX_SHADER,
  BLOOM_BLUR_SHADER,
  BLOOM_FINAL_SHADER,
  BLOOM_PREFILTER_SHADER,
  CLEAR_SHADER,
  COPY_SHADER,
  CURL_SHADER,
  DISPLAY_SHADER,
  DIVERGENCE_SHADER,
  GRADIENT_SUBTRACT_SHADER,
  PRESSURE_SHADER,
  SPLAT_SHADER,
  SUNRAYS_MASK_SHADER,
  SUNRAYS_SHADER,
  VORTICITY_SHADER,
} from './shaders';
import type {FluidColor, FluidConfig, FluidEngineActions} from './types';

type GL = WebGLRenderingContext | WebGL2RenderingContext;

type RenderTarget = {
  framebuffer: WebGLFramebuffer;
  height: number;
  name: string;
  texelSizeX: number;
  texelSizeY: number;
  texture: WebGLTexture;
  width: number;
};

type DoubleTarget = {
  read: RenderTarget;
  swap: () => void;
  write: RenderTarget;
};

type PointerState = {
  color: FluidColor;
  down: boolean;
  id: number;
  lastX: number;
  lastY: number;
};

type Splat = {
  color: FluidColor;
  dx: number;
  dy: number;
  x: number;
  y: number;
};

type TargetBundle = {
  bloom: DoubleTarget[];
  bloomFinal: RenderTarget;
  curl: RenderTarget;
  divergence: RenderTarget;
  dye: DoubleTarget;
  pressure: DoubleTarget;
  simHeight: number;
  simWidth: number;
  sunrays: RenderTarget;
  sunraysMask: RenderTarget;
  velocity: DoubleTarget;
};

class FluidProgram {
  readonly program: WebGLProgram;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();

  constructor(
    private readonly gl: GL,
    name: string,
    vertexSource: string,
    fragmentSource: string,
  ) {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, `${name} vertex`, vertexSource);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `${name} fragment`, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error(`[${name}] Unable to create WebGL program`);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) ?? 'unknown link error';
      gl.deleteProgram(program);
      throw new Error(`[${name}] program link failed: ${log}`);
    }
    this.program = program;
  }

  bind() {
    this.gl.useProgram(this.program);
  }

  location(name: string) {
    if (!this.uniforms.has(name)) this.uniforms.set(name, this.gl.getUniformLocation(this.program, name));
    return this.uniforms.get(name) ?? null;
  }

  texture(name: string, texture: WebGLTexture, unit: number) {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.uniform1i(this.location(name), unit);
  }

  uniform1f(name: string, value: number) {
    this.gl.uniform1f(this.location(name), value);
  }

  uniform2f(name: string, x: number, y: number) {
    this.gl.uniform2f(this.location(name), x, y);
  }

  uniform3f(name: string, x: number, y: number, z: number) {
    this.gl.uniform3f(this.location(name), x, y, z);
  }

  dispose() {
    this.gl.deleteProgram(this.program);
  }
}

const isWebGL2Context = (gl: GL): gl is WebGL2RenderingContext =>
  typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

const adaptVertexShader = (source: string, webgl2: boolean) => {
  if (!webgl2) return source;
  return `#version 300 es\n${source.replace(/attribute/g, 'in').replace(/varying/g, 'out')}`;
};

const adaptFragmentShader = (source: string, webgl2: boolean) => {
  if (!webgl2) return source;
  return `#version 300 es
precision highp float;
precision highp sampler2D;
#define texture2D texture
out vec4 fluidFragmentColor;
#define gl_FragColor fluidFragmentColor
${source.replace(/precision highp float;/g, '').replace(/varying/g, 'in')}`;
};

const compileShader = (gl: GL, type: number, name: string, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error(`[${name}] Unable to create shader`);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown compile error';
    gl.deleteShader(shader);
    throw new Error(`[${name}] shader compile failed: ${log}`);
  }
  return shader;
};

const hexToRgb = (hex: string): FluidColor => {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized, 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
};

const resolutionFor = (base: number, width: number, height: number) => {
  const aspect = width / Math.max(1, height);
  return aspect >= 1
    ? {height: base, width: Math.round(base * aspect)}
    : {height: Math.round(base / aspect), width: base};
};

export class WebGLFluidEngine implements FluidEngineActions {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: GL;
  private readonly webgl2: boolean;
  private readonly halfFloatType: number;
  private readonly textureInternalFormat: number;
  private readonly textureFormat: number;
  private readonly textureFilter: number;
  private readonly programs: Record<string, FluidProgram>;
  private readonly pointers = new Map<number, PointerState>();
  private readonly splatQueue: Splat[] = [];
  private readonly resources = new Set<RenderTarget>();
  private readonly quadBuffer: WebGLBuffer;
  private config: FluidConfig;
  private targets: TargetBundle | null = null;
  private animationFrame = 0;
  private disposed = false;
  private lastFrameTime = performance.now();
  private lastAutoSplat = 0;
  private lastInteraction = performance.now();
  private paletteCursor = 0;
  private seedCount = 7;
  private readonly resizeObserver: ResizeObserver;
  private readonly onError: (message: string) => void;

  constructor(canvas: HTMLCanvasElement, config: FluidConfig, onError: (message: string) => void) {
    this.canvas = canvas;
    this.config = config;
    this.onError = onError;
    const options: WebGLContextAttributes = {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    };
    const webgl2 = canvas.getContext('webgl2', options);
    const fallback = webgl2 ? null : canvas.getContext('webgl', options);
    const gl = webgl2 ?? fallback;
    if (!gl) throw new Error('WebGL is unavailable in this browser');
    this.gl = gl;
    this.webgl2 = isWebGL2Context(gl);

    if (isWebGL2Context(gl)) {
      if (!gl.getExtension('EXT_color_buffer_float')) {
        throw new Error('EXT_color_buffer_float is required for the fluid simulation');
      }
      const linear = gl.getExtension('OES_texture_float_linear');
      this.halfFloatType = gl.HALF_FLOAT;
      this.textureInternalFormat = gl.RGBA16F;
      this.textureFormat = gl.RGBA;
      this.textureFilter = linear ? gl.LINEAR : gl.NEAREST;
    } else {
      const halfFloat = gl.getExtension('OES_texture_half_float');
      if (!halfFloat || !gl.getExtension('EXT_color_buffer_half_float')) {
        throw new Error('Half-float framebuffer extensions are required for the fluid simulation');
      }
      const linear = gl.getExtension('OES_texture_half_float_linear');
      this.halfFloatType = (halfFloat as {HALF_FLOAT_OES: number}).HALF_FLOAT_OES;
      this.textureInternalFormat = gl.RGBA;
      this.textureFormat = gl.RGBA;
      this.textureFilter = linear ? gl.LINEAR : gl.NEAREST;
    }

    const quadBuffer = gl.createBuffer();
    if (!quadBuffer) throw new Error('Unable to create fullscreen quad buffer');
    this.quadBuffer = quadBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const createProgram = (name: string, fragment: string) => new FluidProgram(
      gl,
      name,
      adaptVertexShader(BASE_VERTEX_SHADER, this.webgl2),
      adaptFragmentShader(fragment, this.webgl2),
    );
    this.programs = {
      advection: createProgram('advection', ADVECTION_SHADER),
      bloomBlur: createProgram('bloom blur', BLOOM_BLUR_SHADER),
      bloomFinal: createProgram('bloom final', BLOOM_FINAL_SHADER),
      bloomPrefilter: createProgram('bloom prefilter', BLOOM_PREFILTER_SHADER),
      clear: createProgram('pressure clear', CLEAR_SHADER),
      copy: createProgram('copy', COPY_SHADER),
      curl: createProgram('curl', CURL_SHADER),
      display: createProgram('display', DISPLAY_SHADER),
      divergence: createProgram('divergence', DIVERGENCE_SHADER),
      gradientSubtract: createProgram('gradient subtract', GRADIENT_SUBTRACT_SHADER),
      pressure: createProgram('pressure', PRESSURE_SHADER),
      splat: createProgram('splat', SPLAT_SHADER),
      sunrays: createProgram('sunrays', SUNRAYS_SHADER),
      sunraysMask: createProgram('sunrays mask', SUNRAYS_MASK_SHADER),
      vorticity: createProgram('vorticity', VORTICITY_SHADER),
    };

    this.bindPointerEvents();
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(canvas);
    this.resizeCanvas();
    this.animationFrame = requestAnimationFrame(this.update);
  }

  setConfig(config: FluidConfig) {
    const resolutionChanged = config.simResolution !== this.config.simResolution
      || config.dyeResolution !== this.config.dyeResolution;
    this.config = config;
    if (resolutionChanged) this.rebuildTargets();
  }

  setPaused(paused: boolean) {
    this.config = {...this.config, paused};
  }

  reset() {
    this.releaseTargets();
    this.targets = this.createTargets();
    this.splatQueue.length = 0;
    this.seedCount = 0;
    this.lastInteraction = performance.now();
  }

  randomSplat(count = 1) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const magnitude = this.config.splatForce * (0.34 + Math.random() * 0.34);
      this.splatQueue.push({
        color: this.nextColor(0.86 + Math.random() * 0.42),
        dx: Math.cos(angle) * magnitude,
        dy: Math.sin(angle) * magnitude,
        x: 0.1 + Math.random() * 0.8,
        y: 0.12 + Math.random() * 0.76,
      });
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.unbindPointerEvents();
    this.releaseTargets();
    Object.values(this.programs).forEach((program) => program.dispose());
    this.gl.deleteBuffer(this.quadBuffer);
  }

  private readonly update = (now: number) => {
    if (this.disposed) return;
    try {
      this.resizeCanvas();
      const delta = Math.min(0.033, Math.max(0.001, (now - this.lastFrameTime) / 1000));
      this.lastFrameTime = now;
      if (!this.targets) this.targets = this.createTargets();

      if (!this.config.paused) {
        if (this.seedCount > 0) {
          this.randomSplat(1);
          this.seedCount -= 1;
        }
        if (this.config.autoDemo && now - this.lastInteraction > 1400 && now - this.lastAutoSplat > 720) {
          this.randomSplat(1);
          this.lastAutoSplat = now;
        }
        this.processSplats();
        this.step(delta);
      }
      this.render();
      this.animationFrame = requestAnimationFrame(this.update);
    } catch (reason) {
      this.onError(reason instanceof Error ? reason.message : 'Fluid render loop failed');
    }
  };

  private step(delta: number) {
    const targets = this.targets;
    if (!targets) return;
    const {gl, programs} = this;
    gl.disable(gl.BLEND);

    this.draw(programs.curl, targets.curl, (program) => {
      program.texture('uVelocity', targets.velocity.read.texture, 0);
    }, targets.velocity.read);

    this.draw(programs.vorticity, targets.velocity.write, (program) => {
      program.texture('uVelocity', targets.velocity.read.texture, 0);
      program.texture('uCurl', targets.curl.texture, 1);
      program.uniform1f('curl', this.config.curlStrength);
      program.uniform1f('dt', delta);
    }, targets.velocity.read);
    targets.velocity.swap();

    this.draw(programs.divergence, targets.divergence, (program) => {
      program.texture('uVelocity', targets.velocity.read.texture, 0);
    }, targets.velocity.read);

    this.draw(programs.clear, targets.pressure.write, (program) => {
      program.texture('uTexture', targets.pressure.read.texture, 0);
      program.uniform1f('value', this.config.pressureRetention);
    }, targets.pressure.read);
    targets.pressure.swap();

    for (let iteration = 0; iteration < this.config.pressureIterations; iteration += 1) {
      this.draw(programs.pressure, targets.pressure.write, (program) => {
        program.texture('uPressure', targets.pressure.read.texture, 0);
        program.texture('uDivergence', targets.divergence.texture, 1);
      }, targets.pressure.read);
      targets.pressure.swap();
    }

    this.draw(programs.gradientSubtract, targets.velocity.write, (program) => {
      program.texture('uPressure', targets.pressure.read.texture, 0);
      program.texture('uVelocity', targets.velocity.read.texture, 1);
    }, targets.velocity.read);
    targets.velocity.swap();

    this.draw(programs.advection, targets.velocity.write, (program) => {
      program.texture('uVelocity', targets.velocity.read.texture, 0);
      program.texture('uSource', targets.velocity.read.texture, 1);
      program.uniform2f('velocityTexelSize', targets.velocity.read.texelSizeX, targets.velocity.read.texelSizeY);
      program.uniform1f('dt', delta);
      program.uniform1f('dissipation', Math.pow(this.config.velocityDissipation, delta * 60));
    }, targets.velocity.read);
    targets.velocity.swap();

    this.draw(programs.advection, targets.dye.write, (program) => {
      program.texture('uVelocity', targets.velocity.read.texture, 0);
      program.texture('uSource', targets.dye.read.texture, 1);
      program.uniform2f('velocityTexelSize', targets.velocity.read.texelSizeX, targets.velocity.read.texelSizeY);
      program.uniform1f('dt', delta);
      program.uniform1f('dissipation', Math.pow(this.config.densityDissipation, delta * 60));
    }, targets.dye.read);
    targets.dye.swap();
  }

  private render() {
    const targets = this.targets;
    if (!targets) return;
    this.applyBloom(targets);
    this.applySunrays(targets);
    const background = hexToRgb(this.config.backgroundColor);
    this.draw(this.programs.display, null, (program) => {
      program.texture('uDye', targets.dye.read.texture, 0);
      program.texture('uBloom', targets.bloomFinal.texture, 1);
      program.texture('uSunrays', targets.sunrays.texture, 2);
      program.uniform3f('background', background[0], background[1], background[2]);
      program.uniform1f('bloomEnabled', this.config.bloom ? 1 : 0);
      program.uniform1f('sunraysEnabled', this.config.sunrays ? 1 : 0);
      program.uniform1f('transparentBackground', this.config.transparent ? 1 : 0);
    }, targets.dye.read);
  }

  private applyBloom(targets: TargetBundle) {
    if (!this.config.bloom) {
      this.clearTarget(targets.bloomFinal);
      return;
    }
    const levels = targets.bloom;
    this.draw(this.programs.bloomPrefilter, levels[0].read, (program) => {
      program.texture('uTexture', targets.dye.read.texture, 0);
      program.uniform1f('threshold', this.config.bloomThreshold);
      program.uniform1f('softKnee', this.config.bloomSoftKnee);
    }, targets.dye.read);

    levels.forEach((level, index) => {
      if (index > 0) {
        this.draw(this.programs.copy, level.read, (program) => {
          program.texture('uTexture', levels[index - 1].read.texture, 0);
        }, levels[index - 1].read);
      }
      this.draw(this.programs.bloomBlur, level.write, (program) => {
        program.texture('uTexture', level.read.texture, 0);
        program.uniform2f('direction', level.read.texelSizeX, 0);
      }, level.read);
      level.swap();
      this.draw(this.programs.bloomBlur, level.write, (program) => {
        program.texture('uTexture', level.read.texture, 0);
        program.uniform2f('direction', 0, level.read.texelSizeY);
      }, level.read);
      level.swap();
    });

    this.draw(this.programs.bloomFinal, targets.bloomFinal, (program) => {
      program.texture('uBloom0', levels[0].read.texture, 0);
      program.texture('uBloom1', levels[1].read.texture, 1);
      program.texture('uBloom2', levels[2].read.texture, 2);
      program.uniform1f('intensity', this.config.bloomIntensity);
    }, levels[0].read);
  }

  private applySunrays(targets: TargetBundle) {
    if (!this.config.sunrays) {
      this.clearTarget(targets.sunrays);
      return;
    }
    this.draw(this.programs.sunraysMask, targets.sunraysMask, (program) => {
      program.texture('uTexture', targets.dye.read.texture, 0);
    }, targets.dye.read);
    this.draw(this.programs.sunrays, targets.sunrays, (program) => {
      program.texture('uTexture', targets.sunraysMask.texture, 0);
      program.uniform1f('weight', this.config.sunraysWeight);
      program.uniform1f('exposure', this.config.sunraysExposure);
    }, targets.sunraysMask);
  }

  private processSplats() {
    const targets = this.targets;
    if (!targets) return;
    while (this.splatQueue.length > 0) {
      const splat = this.splatQueue.shift();
      if (!splat) break;
      this.splat(targets.velocity, splat.x, splat.y, [splat.dx, splat.dy, 0]);
      this.splat(targets.dye, splat.x, splat.y, splat.color);
    }
  }

  private splat(target: DoubleTarget, x: number, y: number, color: FluidColor) {
    this.draw(this.programs.splat, target.write, (program) => {
      program.texture('uTarget', target.read.texture, 0);
      program.uniform1f('aspectRatio', this.canvas.width / Math.max(1, this.canvas.height));
      program.uniform2f('point', x, y);
      program.uniform3f('color', color[0], color[1], color[2]);
      program.uniform1f('radius', this.config.splatRadius * 0.01);
    }, target.read);
    target.swap();
  }

  private draw(
    program: FluidProgram,
    target: RenderTarget | null,
    setUniforms: (program: FluidProgram) => void,
    texelSource?: RenderTarget,
  ) {
    const {gl} = this;
    program.bind();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const position = gl.getAttribLocation(program.program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const texel = texelSource ?? target;
    program.uniform2f('texelSize', texel?.texelSizeX ?? 0, texel?.texelSizeY ?? 0);
    setUniforms(program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
    gl.viewport(0, 0, target?.width ?? this.canvas.width, target?.height ?? this.canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private clearTarget(target: RenderTarget) {
    const {gl} = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, target.width, target.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  private resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(2, Math.round(rect.width * dpr));
    const height = Math.max(2, Math.round(rect.height * dpr));
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.rebuildTargets();
  }

  private rebuildTargets() {
    if (this.canvas.width < 2 || this.canvas.height < 2) return;
    this.releaseTargets();
    this.targets = this.createTargets();
    this.seedCount = 5;
  }

  private createTargets(): TargetBundle {
    const sim = resolutionFor(this.config.simResolution, this.canvas.width, this.canvas.height);
    const dye = resolutionFor(this.config.dyeResolution, this.canvas.width, this.canvas.height);
    const bloomBase = Math.max(64, Math.round(Math.min(dye.width, dye.height) * 0.48));
    const bloomResolution = resolutionFor(bloomBase, this.canvas.width, this.canvas.height);
    const sunraysResolution = resolutionFor(
      Math.max(96, Math.round(Math.min(dye.width, dye.height) * 0.42)),
      this.canvas.width,
      this.canvas.height,
    );
    const bloom = [0, 1, 2].map((index) => this.createDoubleTarget(
      `bloom-${index}`,
      Math.max(2, bloomResolution.width >> index),
      Math.max(2, bloomResolution.height >> index),
      this.textureFilter,
    ));

    return {
      bloom,
      bloomFinal: this.createTarget('bloom-final', bloomResolution.width, bloomResolution.height, this.textureFilter),
      curl: this.createTarget('curl', sim.width, sim.height, this.gl.NEAREST),
      divergence: this.createTarget('divergence', sim.width, sim.height, this.gl.NEAREST),
      dye: this.createDoubleTarget('dye', dye.width, dye.height, this.textureFilter),
      pressure: this.createDoubleTarget('pressure', sim.width, sim.height, this.gl.NEAREST),
      simHeight: sim.height,
      simWidth: sim.width,
      sunrays: this.createTarget('sunrays', sunraysResolution.width, sunraysResolution.height, this.textureFilter),
      sunraysMask: this.createTarget('sunrays-mask', sunraysResolution.width, sunraysResolution.height, this.textureFilter),
      velocity: this.createDoubleTarget('velocity', sim.width, sim.height, this.textureFilter),
    };
  }

  private createDoubleTarget(name: string, width: number, height: number, filter: number): DoubleTarget {
    const target = {
      read: this.createTarget(`${name}-read`, width, height, filter),
      write: this.createTarget(`${name}-write`, width, height, filter),
      swap: () => {
        const previous = target.read;
        target.read = target.write;
        target.write = previous;
      },
    };
    return target;
  }

  private createTarget(name: string, width: number, height: number, filter: number): RenderTarget {
    const {gl} = this;
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!texture || !framebuffer) throw new Error(`[${name}] Unable to allocate framebuffer resources`);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      this.textureInternalFormat,
      width,
      height,
      0,
      this.textureFormat,
      this.halfFloatType,
      null,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(framebuffer);
      throw new Error(`[${name}] framebuffer incomplete: 0x${status.toString(16)}`);
    }
    const target = {
      framebuffer,
      height,
      name,
      texelSizeX: 1 / width,
      texelSizeY: 1 / height,
      texture,
      width,
    };
    this.resources.add(target);
    this.clearTarget(target);
    return target;
  }

  private releaseTargets() {
    this.resources.forEach((target) => {
      this.gl.deleteTexture(target.texture);
      this.gl.deleteFramebuffer(target.framebuffer);
    });
    this.resources.clear();
    this.targets = null;
  }

  private nextColor(intensity = 1): FluidColor {
    const palette = this.config.palette;
    const color = palette[this.paletteCursor % palette.length];
    this.paletteCursor += 1;
    return [color[0] * intensity, color[1] * intensity, color[2] * intensity];
  }

  private pointerPosition(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width))),
      y: 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height))),
    };
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    const point = this.pointerPosition(event);
    this.canvas.setPointerCapture(event.pointerId);
    const pointer = {
      color: this.nextColor(1.1),
      down: true,
      id: event.pointerId,
      lastX: point.x,
      lastY: point.y,
    };
    this.pointers.set(event.pointerId, pointer);
    this.lastInteraction = performance.now();
    this.splatQueue.push({color: pointer.color, dx: 0, dy: 0, x: point.x, y: point.y});
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer?.down) return;
    const point = this.pointerPosition(event);
    const dx = point.x - pointer.lastX;
    const dy = point.y - pointer.lastY;
    pointer.lastX = point.x;
    pointer.lastY = point.y;
    this.lastInteraction = performance.now();
    this.splatQueue.push({
      color: pointer.color,
      dx: dx * this.config.splatForce,
      dy: dy * this.config.splatForce,
      x: point.x,
      y: point.y,
    });
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    const pointer = this.pointers.get(event.pointerId);
    if (pointer) pointer.down = false;
    this.pointers.delete(event.pointerId);
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  };

  private bindPointerEvents() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
  }

  private unbindPointerEvents() {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
  }
}
