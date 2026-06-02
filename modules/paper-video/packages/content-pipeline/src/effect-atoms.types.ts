import type React from "react";
import type {
  BackgroundEffectId,
  RenderManifest,
  VisualModuleConfig,
} from "@paper-to-video/shared-types";

export type EffectAtomId = Exclude<BackgroundEffectId, "none">;

export type EffectAtomRuntimeProps = {
  absoluteFrame: number;
  activationFrame: number;
  continuousEffectId?: EffectAtomId;
  interactionFrame?: number;
  effectStartFrame?: number;
  height: number;
  isRunning?: boolean;
  mode: "interactive" | "render";
  modules?: RenderManifest["modules"];
  onPrimaryAction?: () => void;
  resetToken?: number;
  seed: number;
  simulationFrame?: number;
  width: number;
};

export type EffectControlSection = keyof Pick<
  VisualModuleConfig,
  "backgroundMotion" | "cellularEffect" | "particleEffect" | "donutEffect" | "lightsEffect" | "rubiksEffect"
>;

export type EffectControlOption = {
  label: string;
  value: string;
};

type EffectControlBase = {
  id: string;
  label: string;
  description: string;
  section: EffectControlSection;
  field: string;
};

export type EffectRangeControlDefinition = EffectControlBase & {
  kind: "range";
  min: number;
  max: number;
  step: number;
};

export type EffectSelectControlDefinition = EffectControlBase & {
  kind: "select";
  options: EffectControlOption[];
};

export type EffectControlDefinition =
  | EffectRangeControlDefinition
  | EffectSelectControlDefinition;

export type EffectAtomDefinition = {
  description: string;
  id: EffectAtomId;
  title: string;
  Component: React.FC<EffectAtomRuntimeProps>;
  controls?: EffectControlDefinition[];
};
