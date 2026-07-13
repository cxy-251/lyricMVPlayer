export type ComplexPoint = {
  x: number;
  y: number;
};

export type FourierCoefficient = {
  frequency: number;
  amplitude: number;
  phase: number;
  re: number;
  im: number;
};

export type FourierSortMode = 'amplitude' | 'frequency';

export type EpicycleSegment = {
  center: ComplexPoint;
  end: ComplexPoint;
  coefficient: FourierCoefficient;
};

export type FourierSceneOptions = {
  showCircles: boolean;
  showVectors: boolean;
  showTarget: boolean;
  inspectedIndex: number | null;
};
