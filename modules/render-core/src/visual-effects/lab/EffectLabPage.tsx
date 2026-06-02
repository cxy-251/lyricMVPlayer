import React, {useEffect, useMemo, useRef, useState} from "react";
import {
  createModuleOverride,
  EFFECT_ATOMS,
  EffectRuntimeAdapter,
  type EffectAtomId,
  type EffectControlDefinition,
} from "@paper-to-video/content-pipeline";
import type {RenderManifest, VisualModuleConfig} from "@paper-to-video/shared-types";

import {EffectCanvas} from "../runtime";
import {getVisualEffectDefinition, visualEffectRegistry} from "../registry";
import type {VisualEffectConfigMap, VisualEffectId} from "../types";
import {PARTICLE_GALAXY_LIMITS, sanitizeParticleGalaxyConfig} from "../core/particle-galaxy";
import {sanitizeFluidCursorFieldConfig} from "../core/fluid-cursor-field";
import {sanitizeNeonEnergyTunnelConfig} from "../core/neon-energy-tunnel";
import {sanitizeParticleMorphingFieldConfig} from "../core/particle-morphing-field";
import {sanitizePhysicsClothBannerConfig} from "../core/physics-cloth-banner";

const creativeEffectIds = Object.keys(visualEffectRegistry) as VisualEffectId[];
const paperEffectIds: EffectAtomId[] = [
  "cellular-life",
  "snake-grid",
  "particle-orbit",
  "donut-spin",
  "lights-beams",
  "rubiks-auto-solve",
];

type StudioEffect =
  | {
      source: "creative";
      id: VisualEffectId;
      title: string;
      description: string;
      tags: string[];
    }
  | {
      source: "paper";
      id: EffectAtomId;
      title: string;
      description: string;
      tags: string[];
      controls: EffectControlDefinition[];
    };

type NumberControlProps = {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
};

type CreativeControlDefinition = {
  field: string;
  label: string;
  max: number;
  min: number;
  step: number;
};

const creativeControlDefinitions: Record<VisualEffectId, CreativeControlDefinition[]> = {
  "particle-galaxy": [
    {field: "particleCount", label: "Particles", min: PARTICLE_GALAXY_LIMITS.minParticles, max: PARTICLE_GALAXY_LIMITS.maxParticles, step: PARTICLE_GALAXY_LIMITS.particleStep},
    {field: "particleSize", label: "Particle size", min: 0.45, max: 2, step: 0.01},
    {field: "rotationSpeed", label: "Rotation", min: 0.02, max: 0.75, step: 0.01},
    {field: "interactionStrength", label: "Interaction", min: 0, max: 2, step: 0.01},
    {field: "bloomStrength", label: "Glow", min: 0, max: 3, step: 0.05},
  ],
  "neon-energy-tunnel": [
    {field: "travelSpeed", label: "Travel speed", min: 0.6, max: 10, step: 0.1},
    {field: "tunnelRadius", label: "Tunnel radius", min: 1.2, max: 3.3, step: 0.01},
    {field: "segmentCount", label: "Segments", min: 36, max: 110, step: 1},
    {field: "glowStrength", label: "Glow", min: 0.2, max: 2.5, step: 0.01},
    {field: "distortionStrength", label: "Distortion", min: 0, max: 2, step: 0.01},
    {field: "particleDensity", label: "Streaks", min: 180, max: 1600, step: 20},
  ],
  "fluid-cursor-field": [
    {field: "distortionStrength", label: "Distortion", min: 0, max: 2.5, step: 0.01},
    {field: "trailPersistence", label: "Trail", min: 0, max: 1, step: 0.01},
    {field: "rippleRadius", label: "Ripple radius", min: 0.025, max: 0.24, step: 0.001},
    {field: "fluidDecay", label: "Decay", min: 0, max: 2.5, step: 0.01},
    {field: "backgroundScale", label: "Scale", min: 0.8, max: 4, step: 0.01},
    {field: "bloomStrength", label: "Glow", min: 0, max: 2.5, step: 0.01},
  ],
  "physics-cloth-banner": [
    {field: "windStrength", label: "Wind", min: 0, max: 2.2, step: 0.01},
    {field: "damping", label: "Damping", min: 0.9, max: 0.995, step: 0.001},
    {field: "clothResolution", label: "Resolution", min: 14, max: 32, step: 1},
    {field: "interactionRadius", label: "Radius", min: 0.25, max: 1.4, step: 0.01},
    {field: "interactionStrength", label: "Interaction", min: 0, max: 2.5, step: 0.01},
    {field: "glowStrength", label: "Glow", min: 0, max: 2.5, step: 0.01},
  ],
  "particle-morphing-field": [
    {field: "particleCount", label: "Particles", min: 4000, max: 32000, step: 1000},
    {field: "particleSize", label: "Particle size", min: 0.45, max: 2.4, step: 0.01},
    {field: "morphSpeed", label: "Morph speed", min: 0.08, max: 1.6, step: 0.01},
    {field: "turbulenceStrength", label: "Turbulence", min: 0, max: 1.8, step: 0.01},
    {field: "interactionStrength", label: "Interaction", min: 0, max: 2.2, step: 0.01},
    {field: "bloomStrength", label: "Glow", min: 0, max: 2.5, step: 0.01},
  ],
};

const createCreativeConfigMap = () =>
  Object.fromEntries(
    creativeEffectIds.map((effectId) => [effectId, getVisualEffectDefinition(effectId).defaultConfig]),
  ) as VisualEffectConfigMap;

const sanitizeCreativeConfig = (
  effectId: VisualEffectId,
  config: VisualEffectConfigMap[VisualEffectId],
) => {
  switch (effectId) {
    case "particle-galaxy":
      return sanitizeParticleGalaxyConfig(config as VisualEffectConfigMap["particle-galaxy"]);
    case "neon-energy-tunnel":
      return sanitizeNeonEnergyTunnelConfig(config as VisualEffectConfigMap["neon-energy-tunnel"]);
    case "fluid-cursor-field":
      return sanitizeFluidCursorFieldConfig(config as VisualEffectConfigMap["fluid-cursor-field"]);
    case "physics-cloth-banner":
      return sanitizePhysicsClothBannerConfig(config as VisualEffectConfigMap["physics-cloth-banner"]);
    case "particle-morphing-field":
      return sanitizeParticleMorphingFieldConfig(config as VisualEffectConfigMap["particle-morphing-field"]);
  }
};

const studioEffects: StudioEffect[] = [
  ...creativeEffectIds.map((effectId) => {
    const definition = getVisualEffectDefinition(effectId);
    return {
      source: "creative" as const,
      id: definition.id,
      title: definition.title,
      description: definition.description,
      tags: definition.tags,
    };
  }),
  ...paperEffectIds.map((effectId) => {
    const definition = EFFECT_ATOMS[effectId];
    return {
      source: "paper" as const,
      id: definition.id,
      title: definition.title,
      description: definition.description,
      tags: ["paper", "webgl", "render-core"],
      controls: definition.controls ?? [],
    };
  }),
];

const getEffectKey = (effect: StudioEffect) => `${effect.source}:${effect.id}`;

const resolveInitialEffectKey = () => {
  const rawSlug = window.location.pathname.split("/").filter(Boolean).at(-1);
  const slug =
    rawSlug === "life-game"
      ? "cellular-life"
      : rawSlug === "rubiks-solver"
        ? "rubiks-auto-solve"
        : rawSlug;
  const matched = studioEffects.find((effect) => effect.id === slug);
  return getEffectKey(matched ?? studioEffects[0]);
};

const NumberControl: React.FC<NumberControlProps> = ({
  label,
  max,
  min,
  onChange,
  step,
  value,
}) => (
  <label className="effect-lab-control">
    <span>{label}</span>
    <input
      max={max}
      min={min}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
      step={step}
      type="range"
      value={value}
    />
    <output>{Number.isInteger(step) ? Math.round(value) : value.toFixed(2)}</output>
  </label>
);

const CreativeEffectControls: React.FC<{
  config: VisualEffectConfigMap[VisualEffectId];
  effectId: VisualEffectId;
  onChange: (config: VisualEffectConfigMap[VisualEffectId]) => void;
}> = ({config, effectId, onChange}) => {
  const values = config as Record<string, number>;
  const update = (field: string, value: number) => {
    onChange(sanitizeCreativeConfig(effectId, {...values, [field]: value} as VisualEffectConfigMap[VisualEffectId]));
  };

  return (
    <div className="effect-lab-controls">
      {creativeControlDefinitions[effectId].map((control) => (
        <NumberControl
          key={control.field}
          label={control.label}
          max={control.max}
          min={control.min}
          onChange={(nextValue) => update(control.field, nextValue)}
          step={control.step}
          value={values[control.field]}
        />
      ))}
    </div>
  );
};

const readPaperControlValue = (
  modules: VisualModuleConfig | undefined,
  control: EffectControlDefinition,
) => {
  const section = modules?.[control.section] as Record<string, unknown> | undefined;
  const value = section?.[control.field];
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }

  if (control.kind === "select") {
    return control.options[0]?.value ?? "";
  }

  return (control.min + control.max) / 2;
};

const PaperEffectControls: React.FC<{
  controls: EffectControlDefinition[];
  modules: VisualModuleConfig | undefined;
  onChange: (control: EffectControlDefinition, value: number | string) => void;
}> = ({controls, modules, onChange}) => {
  if (controls.length === 0) {
    return <p className="effect-lab-empty">No exposed controls yet.</p>;
  }

  return (
    <div className="effect-lab-controls">
      {controls.map((control) => {
        const value = readPaperControlValue(modules, control);
        if (control.kind === "select") {
          return (
            <label className="effect-lab-control" key={control.id}>
              <span>{control.label}</span>
              <select
                onChange={(event) => onChange(control, event.currentTarget.value)}
                value={String(value)}
              >
                {control.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        return (
          <NumberControl
            key={control.id}
            label={control.label}
            max={control.max}
            min={control.min}
            onChange={(nextValue) => onChange(control, nextValue)}
            step={control.step}
            value={Number(value)}
          />
        );
      })}
    </div>
  );
};

const PaperEffectStage: React.FC<{
  effectId: EffectAtomId;
  modules?: RenderManifest["modules"];
}> = ({effectId, modules}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  const [size, setSize] = useState({width: 1280, height: 720});

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    const resize = () => {
      const rect = host.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let animationFrame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setFrame(Math.floor(((now - start) / 1000) * 30));
      animationFrame = window.requestAnimationFrame(tick);
    };
    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [effectId]);

  return (
    <div className="effect-lab-paper-stage" ref={hostRef}>
      <EffectRuntimeAdapter
        absoluteFrame={frame}
        activationFrame={0}
        continuousEffectId={effectId}
        effectId={effectId}
        effectStartFrame={0}
        height={size.height}
        interactionFrame={0}
        isRunning
        mode="interactive"
        modules={modules}
        seed={1307}
        simulationFrame={frame}
        width={size.width}
      />
    </div>
  );
};

export const EffectLabPage: React.FC = () => {
  const [selectedEffectKey, setSelectedEffectKey] = useState(resolveInitialEffectKey);
  const [effectListOpen, setEffectListOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [paperModulesByEffect, setPaperModulesByEffect] = useState<Record<string, VisualModuleConfig>>({});
  const [creativeConfigs, setCreativeConfigs] = useState<VisualEffectConfigMap>(createCreativeConfigMap);
  const selectedEffect = studioEffects.find((effect) => getEffectKey(effect) === selectedEffectKey) ?? studioEffects[0];
  const selectedConfig =
    selectedEffect.source === "creative" ? creativeConfigs[selectedEffect.id] : creativeConfigs["particle-galaxy"];
  const paperModules = selectedEffect.source === "paper" ? paperModulesByEffect[selectedEffect.id] : undefined;

  const selectEffect = (effect: StudioEffect) => {
    setSelectedEffectKey(getEffectKey(effect));
    setEffectListOpen(false);
    window.history.pushState({}, "", `/studio/effects/${effect.id}`);
  };

  const updatePaperControl = (control: EffectControlDefinition, value: number | string) => {
    if (selectedEffect.source !== "paper") {
      return;
    }

    setPaperModulesByEffect((current) => ({
      ...current,
      [selectedEffect.id]: createModuleOverride({
        baseModules: current[selectedEffect.id],
        control,
        value,
      }),
    }));
  };

  const updateCreativeConfig = (config: VisualEffectConfigMap[VisualEffectId]) => {
    if (selectedEffect.source !== "creative") {
      return;
    }
    setCreativeConfigs((current) => ({
      ...current,
      [selectedEffect.id]: config,
    }));
  };

  return (
    <main className="effect-lab">
      <section className="effect-lab-stage" aria-label={`${selectedEffect.title} preview`}>
        {selectedEffect.source === "creative" ? (
          <EffectCanvas
            className="effect-lab-canvas"
            config={selectedConfig}
            effectId={selectedEffect.id}
            seed={1307}
          />
        ) : (
          <PaperEffectStage effectId={selectedEffect.id} modules={paperModules} />
        )}
      </section>

      <div className="effect-lab-toolbar" aria-label="Effect navigation">
        <a className="effect-lab-back" href="/studio">
          Studio
        </a>
        <button className="effect-lab-picker" onClick={() => setEffectListOpen(true)} type="button">
          <span>Effects</span>
          <strong>{selectedEffect.title}</strong>
        </button>
      </div>

      {effectListOpen ? (
        <div className="effect-lab-drawer-layer">
          <button
            aria-label="Close effect list"
            className="effect-lab-drawer-scrim"
            onClick={() => setEffectListOpen(false)}
            type="button"
          />
          <aside className="effect-lab-rail">
            <div className="effect-lab-drawer-head">
              <div>
                <p className="effect-lab-kicker">Visual Lab</p>
                <h1>{selectedEffect.title}</h1>
              </div>
              <button
                aria-label="Close effect list"
                className="effect-lab-close"
                onClick={() => setEffectListOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <nav className="effect-lab-tabs" aria-label="Visual effects">
              {studioEffects.map((effect) => (
                <button
                  aria-pressed={getEffectKey(effect) === selectedEffectKey}
                  key={getEffectKey(effect)}
                  onClick={() => selectEffect(effect)}
                  type="button"
                >
                  <span>{effect.source === "creative" ? "Web3D" : "Render"}</span>
                  <strong>{effect.title}</strong>
                </button>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}

      <button
        className={`effect-lab-controls-toggle ${controlsOpen ? "is-open" : ""}`}
        onClick={() => setControlsOpen((open) => !open)}
        type="button"
      >
        Controls
      </button>

      {controlsOpen ? (
        <aside className="effect-lab-panel">
          <div className="effect-lab-panel__header">
            <div>
              <span>Controls</span>
              <strong>{selectedEffect.title}</strong>
            </div>
            <button
              aria-label="Close controls"
              className="effect-lab-panel__close"
              onClick={() => setControlsOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>
          {selectedEffect.source === "creative" ? (
            <CreativeEffectControls
              config={selectedConfig}
              effectId={selectedEffect.id}
              onChange={updateCreativeConfig}
            />
          ) : (
            <PaperEffectControls
              controls={selectedEffect.controls}
              modules={paperModules}
              onChange={updatePaperControl}
            />
          )}
        </aside>
      ) : null}
    </main>
  );
};
