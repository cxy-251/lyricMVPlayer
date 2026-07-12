import {Dices, Pause, Play, RotateCcw} from 'lucide-react';
import {useControls} from 'leva';
import {useEffect, useMemo, useRef, useState} from 'react';

import {WebGLFluidEngine} from './fluidEngine';
import {
  DEFAULT_FLUID_CONTROLS,
  FLUID_PRESETS,
  QUALITY_SETTINGS,
  resolveFluidConfig,
} from './presets';
import type {FluidControlValues, FluidPresetName, FluidQuality} from './types';

const DEMO_STYLES = `
  .webgl-fluid-demo {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 100dvh;
    overflow: hidden;
    background: #05070c;
  }

  .webgl-fluid-canvas {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 100dvh;
    touch-action: none;
    cursor: crosshair;
  }

  .webgl-fluid-toolbar {
    position: fixed;
    z-index: 11;
    left: 50%;
    bottom: 22px;
    display: flex;
    align-items: center;
    gap: 6px;
    transform: translateX(-50%);
    padding: 6px;
    border: 1px solid rgba(184, 218, 230, 0.18);
    border-radius: 7px;
    background: rgba(7, 12, 18, 0.82);
    box-shadow: 0 14px 36px rgba(0, 0, 0, 0.34);
    backdrop-filter: blur(12px);
  }

  .webgl-fluid-action {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 34px;
    padding: 0 11px;
    border: 1px solid rgba(174, 210, 224, 0.15);
    border-radius: 5px;
    background: #121b24;
    color: #d8e8ee;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 720;
    cursor: pointer;
  }

  .webgl-fluid-action:hover {
    border-color: rgba(68, 229, 196, 0.5);
    color: #fff;
  }

  .webgl-fluid-action:focus-visible {
    outline: 2px solid #48e2c2;
    outline-offset: 2px;
  }

  .webgl-fluid-badge {
    position: fixed;
    z-index: 10;
    left: 18px;
    bottom: 20px;
    padding: 6px 8px;
    border: 1px solid rgba(159, 205, 220, 0.14);
    border-radius: 5px;
    background: rgba(5, 10, 15, 0.64);
    color: rgba(183, 213, 222, 0.68);
    font-size: 0.61rem;
    font-weight: 760;
    letter-spacing: 0;
  }

  .webgl-fluid-error {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 24px;
    background: #070a0f;
    color: #dbe8ed;
    text-align: center;
  }

  .webgl-fluid-error strong {
    display: block;
    margin-bottom: 8px;
    color: #ff8096;
  }

  @media (max-width: 760px) {
    .webgl-fluid-toolbar {
      bottom: 14px;
    }

    .webgl-fluid-action {
      width: 36px;
      min-width: 36px;
      padding: 0;
      justify-content: center;
    }

    .webgl-fluid-action span {
      display: none;
    }

    .webgl-fluid-badge {
      display: none;
    }
  }
`;

export default function Demo060WebGLFluidSimulation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WebGLFluidEngine | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controls, setControls] = useControls('WebGL Fluid Simulation', () => ({
    preset: {
      label: 'Preset',
      options: Object.keys(FLUID_PRESETS),
      value: DEFAULT_FLUID_CONTROLS.preset,
    },
    quality: {
      label: 'Quality',
      options: ['High', 'Medium', 'Low'],
      value: DEFAULT_FLUID_CONTROLS.quality,
    },
    autoDemo: {label: 'Auto Demo', value: DEFAULT_FLUID_CONTROLS.autoDemo},
    simResolution: {
      label: 'Sim Resolution',
      options: {Low: 96, Medium: 144, High: 192, Ultra: 256},
      value: DEFAULT_FLUID_CONTROLS.simResolution,
    },
    dyeResolution: {
      label: 'Dye Resolution',
      options: {Low: 512, Medium: 768, High: 1024, Ultra: 1280},
      value: DEFAULT_FLUID_CONTROLS.dyeResolution,
    },
    densityDissipation: {
      label: 'Density Dissipation',
      max: 0.998,
      min: 0.96,
      step: 0.001,
      value: DEFAULT_FLUID_CONTROLS.densityDissipation,
    },
    velocityDissipation: {
      label: 'Velocity Dissipation',
      max: 0.999,
      min: 0.97,
      step: 0.001,
      value: DEFAULT_FLUID_CONTROLS.velocityDissipation,
    },
    pressureIterations: {
      label: 'Pressure Iterations',
      max: 30,
      min: 8,
      step: 1,
      value: DEFAULT_FLUID_CONTROLS.pressureIterations,
    },
    pressureRetention: {
      label: 'Pressure Retention',
      max: 0.96,
      min: 0.65,
      step: 0.01,
      value: DEFAULT_FLUID_CONTROLS.pressureRetention,
    },
    curlStrength: {
      label: 'Curl Strength',
      max: 55,
      min: 0,
      step: 1,
      value: DEFAULT_FLUID_CONTROLS.curlStrength,
    },
    splatRadius: {
      label: 'Splat Radius',
      max: 0.34,
      min: 0.08,
      step: 0.01,
      value: DEFAULT_FLUID_CONTROLS.splatRadius,
    },
    splatForce: {
      label: 'Splat Force',
      max: 10000,
      min: 1800,
      step: 100,
      value: DEFAULT_FLUID_CONTROLS.splatForce,
    },
    bloom: {label: 'Bloom', value: DEFAULT_FLUID_CONTROLS.bloom},
    bloomIntensity: {
      label: 'Bloom Intensity',
      max: 1.6,
      min: 0,
      step: 0.02,
      value: DEFAULT_FLUID_CONTROLS.bloomIntensity,
    },
    bloomThreshold: {
      label: 'Bloom Threshold',
      max: 1,
      min: 0.1,
      step: 0.01,
      value: DEFAULT_FLUID_CONTROLS.bloomThreshold,
    },
    bloomSoftKnee: {
      label: 'Bloom Soft Knee',
      max: 1,
      min: 0,
      step: 0.01,
      value: DEFAULT_FLUID_CONTROLS.bloomSoftKnee,
    },
    sunrays: {label: 'Sunrays', value: DEFAULT_FLUID_CONTROLS.sunrays},
    sunraysWeight: {
      label: 'Sunrays Weight',
      max: 1.2,
      min: 0,
      step: 0.01,
      value: DEFAULT_FLUID_CONTROLS.sunraysWeight,
    },
    sunraysExposure: {
      label: 'Sunrays Exposure',
      max: 0.6,
      min: 0,
      step: 0.01,
      value: DEFAULT_FLUID_CONTROLS.sunraysExposure,
    },
    backgroundColor: {label: 'Background', value: DEFAULT_FLUID_CONTROLS.backgroundColor},
    transparent: {label: 'Transparent', value: DEFAULT_FLUID_CONTROLS.transparent},
  }), []);

  const previousPreset = useRef(controls.preset as FluidPresetName);
  const previousQuality = useRef(controls.quality as FluidQuality);
  const fluidControls = controls as FluidControlValues;
  const config = useMemo(() => resolveFluidConfig(fluidControls, paused), [fluidControls, paused]);

  useEffect(() => {
    if (previousPreset.current === controls.preset) return;
    previousPreset.current = controls.preset as FluidPresetName;
    const preset = FLUID_PRESETS[previousPreset.current];
    const {palette: _palette, ...presetControls} = preset;
    setControls(presetControls);
  }, [controls.preset, setControls]);

  useEffect(() => {
    if (previousQuality.current === controls.quality) return;
    previousQuality.current = controls.quality as FluidQuality;
    setControls({...QUALITY_SETTINGS[previousQuality.current]});
  }, [controls.quality, setControls]);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 720) {
      setControls({quality: 'Low'});
    }
  }, [setControls]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const engine = new WebGLFluidEngine(canvas, config, setError);
      engineRef.current = engine;
      setError(null);
      return () => {
        engine.dispose();
        if (engineRef.current === engine) engineRef.current = null;
      };
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to initialize WebGL fluid simulation');
    }
  }, []);

  useEffect(() => {
    try {
      engineRef.current?.setConfig(config);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update fluid simulation');
    }
  }, [config]);

  return (
    <div className="webgl-fluid-demo" style={{background: controls.backgroundColor}}>
      <style>{DEMO_STYLES}</style>
      <canvas
        aria-label="Interactive GPU fluid simulation canvas"
        className="webgl-fluid-canvas"
        ref={canvasRef}
      />

      {error ? (
        <div className="webgl-fluid-error" role="alert">
          <div><strong>WebGL fluid unavailable</strong>{error}</div>
        </div>
      ) : null}

      <span className="webgl-fluid-badge">GPU NAVIER-STOKES · {controls.quality.toUpperCase()}</span>
      <div className="webgl-fluid-toolbar" aria-label="Fluid simulation actions">
        <button
          aria-label="Reset fluid simulation"
          className="webgl-fluid-action"
          onClick={() => engineRef.current?.reset()}
          title="Reset fluid simulation"
          type="button"
        >
          <RotateCcw aria-hidden size={15} /><span>Reset</span>
        </button>
        <button
          aria-label="Add random splats"
          className="webgl-fluid-action"
          onClick={() => engineRef.current?.randomSplat(5)}
          title="Add random splats"
          type="button"
        >
          <Dices aria-hidden size={15} /><span>Random splat</span>
        </button>
        <button
          aria-label={paused ? 'Resume fluid simulation' : 'Pause fluid simulation'}
          className="webgl-fluid-action"
          onClick={() => setPaused((value) => !value)}
          title={paused ? 'Resume fluid simulation' : 'Pause fluid simulation'}
          type="button"
        >
          {paused ? <Play aria-hidden fill="currentColor" size={14} /> : <Pause aria-hidden size={15} />}
          <span>{paused ? 'Resume' : 'Pause'}</span>
        </button>
      </div>
    </div>
  );
}
