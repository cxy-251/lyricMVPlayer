import React from "react";
import {RemotionDonutLayer, WebDonutLayer} from "./effects/donut-spin";
import {RemotionThreeLifeLayer, WebThreeLifeLayer} from "./effects/three-life";
import {RemotionLightsLayer, WebLightsLayer} from "./effects/lights-beams";
import {RemotionRubiksLayer, WebRubiksLayer} from "./effects/rubiks-cube";
import {ThreeSnakeEffect} from "./three-snake-effect";
import {ThreeParticleEffect} from "./three-particle-effect";
import {
  DONUT_EFFECT_CONTROLS,
  LIGHTS_EFFECT_CONTROLS,
  LIFE_EFFECT_CONTROLS,
  PARTICLE_EFFECT_CONTROLS,
  RUBIKS_EFFECT_CONTROLS,
  SNAKE_EFFECT_CONTROLS,
  baseLayerStyle,
  createModuleOverride,
  getAuroraBackground,
  getGridDriftBackground,
  getLaunchButtonBackground,
  getLaunchButtonState,
  getNoiseBloomBackground,
  launchButtonBaseStyle,
} from "./effect-atoms.service";
import type {EffectAtomDefinition, EffectAtomId, EffectAtomRuntimeProps} from "./effect-atoms.types";

const renderLifeLayer = ({
  absoluteFrame,
  activationFrame,
  height,
  isRunning,
  mode,
  modules,
  resetToken,
  seed,
  simulationFrame,
  width,
}: EffectAtomRuntimeProps) => {
  if (mode === "interactive") {
    return (
      <WebThreeLifeLayer
        activationFrame={activationFrame}
        height={height}
        isRunning={Boolean(isRunning)}
        modules={modules}
        resetToken={resetToken}
        seed={seed}
        width={width}
      />
    );
  }

  return (
    <RemotionThreeLifeLayer
      absoluteFrame={absoluteFrame}
      activationFrame={activationFrame}
      height={height}
      modules={modules}
      seed={seed}
      simulationFrame={simulationFrame}
      width={width}
    />
  );
};

const renderRubiksLayer = ({
  absoluteFrame,
  activationFrame,
  height,
  isRunning,
  mode,
  modules,
  resetToken,
  seed,
  simulationFrame,
  width,
}: EffectAtomRuntimeProps) => {
  if (mode === "interactive") {
    return (
      <WebRubiksLayer
        activationFrame={activationFrame}
        height={height}
        isRunning={Boolean(isRunning)}
        modules={modules}
        resetToken={resetToken}
        seed={seed}
        width={width}
      />
    );
  }

  return (
    <RemotionRubiksLayer
      absoluteFrame={absoluteFrame}
      activationFrame={activationFrame}
      height={height}
      modules={modules}
      seed={seed}
      simulationFrame={simulationFrame}
      width={width}
    />
  );
};

const renderLightsLayer = ({
  absoluteFrame,
  activationFrame,
  height,
  isRunning,
  mode,
  modules,
  resetToken,
  seed,
  simulationFrame,
  width,
}: EffectAtomRuntimeProps) => {
  if (mode === "interactive") {
    return (
      <WebLightsLayer
        activationFrame={activationFrame}
        height={height}
        isRunning={Boolean(isRunning)}
        modules={modules}
        resetToken={resetToken}
        seed={seed}
        width={width}
      />
    );
  }

  return (
    <RemotionLightsLayer
      absoluteFrame={absoluteFrame}
      activationFrame={activationFrame}
      height={height}
      modules={modules}
      seed={seed}
      simulationFrame={simulationFrame}
      width={width}
    />
  );
};

const CellularLifeAtom: React.FC<EffectAtomRuntimeProps> = ({
  absoluteFrame,
  activationFrame,
  height,
  isRunning,
  mode,
  modules,
  resetToken,
  seed,
  simulationFrame,
  width,
}) => {
  return renderLifeLayer({
    absoluteFrame,
    activationFrame,
    height,
    isRunning,
    mode,
    modules,
    resetToken,
    seed,
    simulationFrame,
    width,
  });
};

const renderDonutLayer = ({
  absoluteFrame,
  activationFrame,
  height,
  isRunning,
  mode,
  modules,
  resetToken,
  seed,
  simulationFrame,
  width,
}: EffectAtomRuntimeProps) => {
  if (mode === "interactive") {
    return (
      <WebDonutLayer
        activationFrame={activationFrame}
        height={height}
        isRunning={Boolean(isRunning)}
        modules={modules}
        resetToken={resetToken}
        seed={seed}
        width={width}
      />
    );
  }

  return (
    <RemotionDonutLayer
      absoluteFrame={absoluteFrame}
      activationFrame={activationFrame}
      height={height}
      modules={modules}
      seed={seed}
      simulationFrame={simulationFrame}
      width={width}
    />
  );
};

const SnakeGridAtom: React.FC<EffectAtomRuntimeProps> = ({
  absoluteFrame,
  activationFrame,
  height,
  modules,
  seed,
  simulationFrame,
  width,
}) => {
  return (
    <ThreeSnakeEffect
      absoluteFrame={absoluteFrame}
      activationFrame={activationFrame}
      height={height}
      modules={modules}
      seed={seed}
      simulationFrame={simulationFrame}
      width={width}
    />
  );
};

const ParticleOrbitAtom: React.FC<EffectAtomRuntimeProps> = ({
  absoluteFrame,
  activationFrame,
  height,
  modules,
  seed,
  simulationFrame,
  width,
}) => {
  return (
    <ThreeParticleEffect
      absoluteFrame={absoluteFrame}
      activationFrame={activationFrame}
      height={height}
      modules={modules}
      seed={seed}
      simulationFrame={simulationFrame}
      width={width}
    />
  );
};

const DonutSpinAtom: React.FC<EffectAtomRuntimeProps> = ({
  absoluteFrame,
  activationFrame,
  height,
  isRunning,
  mode,
  modules,
  resetToken,
  seed,
  simulationFrame,
  width,
}) => {
  return renderDonutLayer({
    absoluteFrame,
    activationFrame,
    height,
    isRunning,
    mode,
    modules,
    resetToken,
    seed,
    simulationFrame,
    width,
  });
};

const LightsBeamsAtom: React.FC<EffectAtomRuntimeProps> = ({
  absoluteFrame,
  activationFrame,
  height,
  isRunning,
  mode,
  modules,
  resetToken,
  seed,
  simulationFrame,
  width,
}) => {
  return renderLightsLayer({
    absoluteFrame,
    activationFrame,
    height,
    isRunning,
    mode,
    modules,
    resetToken,
    seed,
    simulationFrame,
    width,
  });
};

const RubiksAutoSolveAtom: React.FC<EffectAtomRuntimeProps> = ({
  absoluteFrame,
  activationFrame,
  height,
  isRunning,
  mode,
  modules,
  resetToken,
  seed,
  simulationFrame,
  width,
}) => {
  return renderRubiksLayer({
    absoluteFrame,
    activationFrame,
    height,
    isRunning,
    mode,
    modules,
    resetToken,
    seed,
    simulationFrame,
    width,
  });
};

const CellularLaunchAtom: React.FC<EffectAtomRuntimeProps> = ({
  absoluteFrame,
  activationFrame,
  continuousEffectId,
  effectStartFrame,
  height,
  interactionFrame,
  isRunning,
  mode,
  modules,
  onPrimaryAction,
  resetToken,
  seed,
  simulationFrame,
  width,
}) => {
  const pulseFrame = simulationFrame ?? absoluteFrame;
  const {buttonOrigin, pulse} = getLaunchButtonState(pulseFrame);
  const clicked = interactionFrame !== undefined ? absoluteFrame >= interactionFrame : Boolean(isRunning);
  const ready = effectStartFrame !== undefined ? absoluteFrame >= effectStartFrame : Boolean(isRunning);
  const buttonScale = ready ? 0.94 : clicked ? pulse * 0.9 : pulse;
  const buttonLabel = ready ? "Simulation Running" : clicked ? "Booting Life Grid" : "Start Life Simulation";
  const renderContinuousLayer = () => {
    if (continuousEffectId === "snake-grid") {
      return (
        <ThreeSnakeEffect
          absoluteFrame={absoluteFrame}
          activationFrame={activationFrame}
          height={height}
          modules={modules}
          seed={seed}
          simulationFrame={simulationFrame}
          width={width}
        />
      );
    }

    if (continuousEffectId === "particle-orbit") {
      return (
        <ThreeParticleEffect
          absoluteFrame={absoluteFrame}
          activationFrame={activationFrame}
          height={height}
          modules={modules}
          seed={seed}
          simulationFrame={simulationFrame}
          width={width}
        />
      );
    }

    if (continuousEffectId === "donut-spin") {
      return renderDonutLayer({
        absoluteFrame,
        activationFrame,
        height,
        isRunning,
        mode,
        modules,
        resetToken,
        seed,
        simulationFrame,
        width,
      });
    }

    if (continuousEffectId === "lights-beams") {
      return renderLightsLayer({
        absoluteFrame,
        activationFrame,
        height,
        isRunning,
        mode,
        modules,
        resetToken,
        seed,
        simulationFrame,
        width,
      });
    }

    if (continuousEffectId === "rubiks-auto-solve") {
      return renderRubiksLayer({
        absoluteFrame,
        activationFrame,
        height,
        isRunning,
        mode,
        modules,
        resetToken,
        seed,
        simulationFrame,
        width,
      });
    }

    return renderLifeLayer({
      absoluteFrame,
      activationFrame,
      height,
      isRunning,
      mode,
      modules,
      resetToken,
      seed,
      simulationFrame,
      width,
    });
  };

  return (
    <>
      {ready ? (
        renderContinuousLayer()
      ) : (
        <div
          style={{
            ...baseLayerStyle,
            background: `radial-gradient(circle at ${buttonOrigin.x * 100}% ${buttonOrigin.y * 100}%, rgba(87,216,196,0.14) 0%, transparent 16%)`,
          }}
        />
      )}

      <button
        onClick={onPrimaryAction}
        style={{
          ...launchButtonBaseStyle,
          background: getLaunchButtonBackground(ready || clicked),
          transform: `translate(${(buttonOrigin.x - 0.5) * 110}px, ${(buttonOrigin.y - 0.5) * 110}px) scale(${buttonScale})`,
        }}
        type="button"
      >
        {buttonLabel}
      </button>
    </>
  );
};

const RubiksLaunchAtom: React.FC<EffectAtomRuntimeProps> = ({
  absoluteFrame,
  activationFrame,
  effectStartFrame,
  height,
  interactionFrame,
  isRunning,
  mode,
  modules,
  onPrimaryAction,
  resetToken,
  seed,
  simulationFrame,
  width,
}) => {
  const pulseFrame = simulationFrame ?? absoluteFrame;
  const {buttonOrigin, pulse} = getLaunchButtonState(pulseFrame);
  const clicked = interactionFrame !== undefined ? absoluteFrame >= interactionFrame : Boolean(isRunning);
  const ready = effectStartFrame !== undefined ? absoluteFrame >= effectStartFrame : Boolean(isRunning);
  const buttonScale = ready ? 0.94 : clicked ? pulse * 0.92 : pulse;
  const buttonLabel = ready ? "Solving Cube" : clicked ? "Aligning Layers" : "Auto Solve Cube";

  return (
    <>
      {ready ? (
        renderRubiksLayer({
          absoluteFrame,
          activationFrame,
          height,
          isRunning,
          mode,
          modules,
          resetToken,
          seed,
          simulationFrame,
          width,
        })
      ) : (
        <div
          style={{
            ...baseLayerStyle,
            background: `radial-gradient(circle at ${buttonOrigin.x * 100}% ${buttonOrigin.y * 100}%, rgba(103,216,255,0.18) 0%, transparent 18%)`,
          }}
        />
      )}

      <button
        onClick={onPrimaryAction}
        style={{
          ...launchButtonBaseStyle,
          background: getLaunchButtonBackground(ready || clicked),
          transform: `translate(${(buttonOrigin.x - 0.5) * 110}px, ${(buttonOrigin.y - 0.5) * 110}px) scale(${buttonScale})`,
        }}
        type="button"
      >
        {buttonLabel}
      </button>
    </>
  );
};

const LightsLaunchAtom: React.FC<EffectAtomRuntimeProps> = ({
  absoluteFrame,
  activationFrame,
  effectStartFrame,
  height,
  interactionFrame,
  isRunning,
  mode,
  modules,
  onPrimaryAction,
  resetToken,
  seed,
  simulationFrame,
  width,
}) => {
  const pulseFrame = simulationFrame ?? absoluteFrame;
  const {buttonOrigin, pulse} = getLaunchButtonState(pulseFrame);
  const clicked = interactionFrame !== undefined ? absoluteFrame >= interactionFrame : Boolean(isRunning);
  const ready = effectStartFrame !== undefined ? absoluteFrame >= effectStartFrame : Boolean(isRunning);
  const buttonScale = ready ? 0.94 : clicked ? pulse * 0.9 : pulse;
  const buttonLabel = ready ? "Lights Running" : clicked ? "Charging Beams" : "Ignite Lights";

  return (
    <>
      {ready ? (
        renderLightsLayer({
          absoluteFrame,
          activationFrame,
          height,
          isRunning,
          mode,
          modules,
          resetToken,
          seed,
          simulationFrame,
          width,
        })
      ) : (
        <div
          style={{
            ...baseLayerStyle,
            background: `radial-gradient(circle at ${buttonOrigin.x * 100}% ${buttonOrigin.y * 100}%, rgba(158,251,240,0.2) 0%, transparent 18%)`,
          }}
        />
      )}

      <button
        onClick={onPrimaryAction}
        style={{
          ...launchButtonBaseStyle,
          background: getLaunchButtonBackground(ready || clicked),
          transform: `translate(${(buttonOrigin.x - 0.5) * 110}px, ${(buttonOrigin.y - 0.5) * 110}px) scale(${buttonScale})`,
        }}
        type="button"
      >
        {buttonLabel}
      </button>
    </>
  );
};

const AuroraAtom: React.FC = () => {
  return <div style={{...baseLayerStyle, ...getAuroraBackground()}} />;
};

const GridDriftAtom: React.FC<Pick<EffectAtomRuntimeProps, "absoluteFrame">> = ({absoluteFrame}) => {
  return <div style={{...baseLayerStyle, opacity: 0.38, ...getGridDriftBackground(absoluteFrame)}} />;
};

const NoiseBloomAtom: React.FC<Pick<EffectAtomRuntimeProps, "absoluteFrame">> = ({absoluteFrame}) => {
  return <div style={{...baseLayerStyle, opacity: 0.92, ...getNoiseBloomBackground(absoluteFrame)}} />;
};

export const EFFECT_ATOMS: Record<EffectAtomId, EffectAtomDefinition> = {
  aurora: {
    id: "aurora",
    title: "Aurora Overlay",
    description: "轻量氛围型中间层特效，适合叠在背景和文本之间。",
    Component: AuroraAtom,
  },
  "grid-drift": {
    id: "grid-drift",
    title: "Grid Drift",
    description: "规则网格漂移特效，适合信息感更强的科技模板。",
    Component: GridDriftAtom,
  },
  "noise-bloom": {
    id: "noise-bloom",
    title: "Noise Bloom",
    description: "噪声感光斑扩散层，可作为柔和过渡特效。",
    Component: NoiseBloomAtom,
  },
  "cellular-launch": {
    id: "cellular-launch",
    title: "Cellular Launch",
    description: "可点击启动的生命游戏入口特效，适合作为独立 effect atom 页面。",
    Component: CellularLaunchAtom,
    controls: LIFE_EFFECT_CONTROLS,
  },
  "cellular-life": {
    id: "cellular-life",
    title: "Cellular Life",
    description: "持续运行的生命游戏中间层特效，当前由 Three.js + WebGL 驱动。",
    Component: CellularLifeAtom,
    controls: LIFE_EFFECT_CONTROLS,
  },
  "snake-grid": {
    id: "snake-grid",
    title: "Snake Grid",
    description: "基于 Three.js + WebGL 的贪吃蛇网格原型，可作为下一类小游戏动效样板。",
    Component: SnakeGridAtom,
    controls: SNAKE_EFFECT_CONTROLS,
  },
  "particle-orbit": {
    id: "particle-orbit",
    title: "Particle Orbit",
    description: "受常见 Three.js 粒子星云案例启发的轨道粒子层，已经调整为更强调画面中央主视觉的构图。",
    Component: ParticleOrbitAtom,
    controls: PARTICLE_EFFECT_CONTROLS,
  },
  "donut-spin": {
    id: "donut-spin",
    title: "Donut Spin",
    description: "实体旋转甜甜圈 WebGL 中间层，强调中心主体、 glossy 材质和围绕甜甜圈的发光珠点。",
    Component: DonutSpinAtom,
    controls: DONUT_EFFECT_CONTROLS,
  },
  "lights-launch": {
    id: "lights-launch",
    title: "Lights Launch",
    description: "用于模板启动页的灯束点亮入口，按钮触发后切入持续的中心束线演化。",
    Component: LightsLaunchAtom,
    controls: LIGHTS_EFFECT_CONTROLS,
  },
  "lights-beams": {
    id: "lights-beams",
    title: "Lights Beams",
    description: "受 Hello Enjoy《Lights》氛围启发的发光束线 WebGL 中间层，强调中心区域的主体演化。",
    Component: LightsBeamsAtom,
    controls: LIGHTS_EFFECT_CONTROLS,
  },
  "rubiks-launch": {
    id: "rubiks-launch",
    title: "Rubiks Launch",
    description: "用于模板第二页的启动场景，按钮触发后切入自动解魔方的主体演化。",
    Component: RubiksLaunchAtom,
    controls: RUBIKS_EFFECT_CONTROLS,
  },
  "rubiks-auto-solve": {
    id: "rubiks-auto-solve",
    title: "Rubiks Auto Solve",
    description: "受 Stewart Smith Rubik's Cube Explorer 启发的自动解魔方 WebGL 中间层。",
    Component: RubiksAutoSolveAtom,
    controls: RUBIKS_EFFECT_CONTROLS,
  },
};

export const getEffectAtomDefinition = (effectId: EffectAtomId) => EFFECT_ATOMS[effectId];
export {createModuleOverride};
