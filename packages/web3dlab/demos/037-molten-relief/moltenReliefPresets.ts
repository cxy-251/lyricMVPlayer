export type ReliefQuality = 'Low' | 'Medium' | 'High';

export type MoltenPresetName = 'Molten Cells' | 'Crystal Bloom' | 'Eroded Inferno';

export type MoltenPresetValues = {
  animationSpeed: number;
  reliefStrength: number;
  normalStrength: number;
  cellularScale: number;
  cellularDistortion: number;
  layerScale: number;
  crystalStrength: number;
  symmetryStrength: number;
  erosionStrength: number;
  heatIntensity: number;
  blueRimStrength: number;
  bloomStrength: number;
  bloomRadius: number;
  lightAngle: number;
};

export type MoltenReliefControls = MoltenPresetValues & {
  pause: boolean;
  preset: MoltenPresetName;
  quality: ReliefQuality;
};

export const DEFAULT_MOLTEN_PRESET: MoltenPresetName = 'Molten Cells';

export const QUALITY_LEVELS: Record<ReliefQuality, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
};

export const MOLTEN_PRESETS: Record<MoltenPresetName, MoltenPresetValues> = {
  'Molten Cells': {
    animationSpeed: 0.18,
    reliefStrength: 1.34,
    normalStrength: 7.2,
    cellularScale: 4.5,
    cellularDistortion: 0.72,
    layerScale: 3.2,
    crystalStrength: 0.42,
    symmetryStrength: 0.42,
    erosionStrength: 0.34,
    heatIntensity: 1.16,
    blueRimStrength: 0.72,
    bloomStrength: 0.52,
    bloomRadius: 0.38,
    lightAngle: 2.25,
  },
  'Crystal Bloom': {
    animationSpeed: 0.12,
    reliefStrength: 1.52,
    normalStrength: 8.1,
    cellularScale: 5.7,
    cellularDistortion: 0.46,
    layerScale: 4.1,
    crystalStrength: 1.02,
    symmetryStrength: 0.62,
    erosionStrength: 0.18,
    heatIntensity: 1.04,
    blueRimStrength: 0.96,
    bloomStrength: 0.64,
    bloomRadius: 0.31,
    lightAngle: 2.58,
  },
  'Eroded Inferno': {
    animationSpeed: 0.22,
    reliefStrength: 1.68,
    normalStrength: 8.7,
    cellularScale: 3.7,
    cellularDistortion: 0.98,
    layerScale: 5.5,
    crystalStrength: 0.24,
    symmetryStrength: 0.24,
    erosionStrength: 0.76,
    heatIntensity: 1.34,
    blueRimStrength: 0.48,
    bloomStrength: 0.57,
    bloomRadius: 0.48,
    lightAngle: 1.82,
  },
};
