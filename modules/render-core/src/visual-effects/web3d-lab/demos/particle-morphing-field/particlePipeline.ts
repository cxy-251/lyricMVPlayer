export type ParticlePipelineBackend = 'webgl-attribute-morph';

export type ParticlePipelineCapabilities = {
  backend: ParticlePipelineBackend;
  experimentalWebGpuEnabled: false;
  notes: string;
  webGpuAvailable: boolean;
};

type NavigatorWithGpu = Navigator & {
  gpu?: unknown;
};

export function detectParticlePipelineCapabilities(): ParticlePipelineCapabilities {
  const webGpuAvailable = typeof navigator !== 'undefined' && Boolean((navigator as NavigatorWithGpu).gpu);

  return {
    backend: 'webgl-attribute-morph',
    experimentalWebGpuEnabled: false,
    notes: webGpuAvailable
      ? 'WebGPU is available, but this app currently shares a WebGL SceneCanvas and WebGL postprocessing stack. Add the WebGPU/TSL compute path behind ParticleSimulationPipeline once the canvas renderer can be switched safely.'
      : 'WebGPU is not available in this runtime, so the WebGL attribute morph pipeline is selected.',
    webGpuAvailable,
  };
}
