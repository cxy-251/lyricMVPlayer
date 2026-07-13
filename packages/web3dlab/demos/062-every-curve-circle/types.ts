export type Point = {x: number; y: number};

export type CircleGeometry = {
  center: Point;
  radius: number;
};

export type ArmGeometry = {
  start: Point;
  end: Point;
  radius: number;
  frequency: number;
};

export type CurveConstruction = {
  fixedCircle?: CircleGeometry;
  rollingCircle?: CircleGeometry;
  tracingPoint: Point;
  radiusLine?: {start: Point; end: Point};
  arms?: ArmGeometry[];
  motionDirection?: Point;
};

export type CurveSample = {
  point: Point;
  construction: CurveConstruction;
};

export type CurveParameters = {
  R: number;
  r: number;
  d: number;
  epicycles: number;
};

export type CurveCategory = 'basic' | 'hypocycloid' | 'epicycloid' | 'trochoid' | 'fourier';
export type CurveParameterMode = 'none' | 'rolling-inside' | 'rolling-outside' | 'fourier';

export type CurveDefinition = {
  id: string;
  name: string;
  category: CurveCategory;
  parameterMode: CurveParameterMode;
  duration: number;
  equation: string;
  accent: string;
  defaultParameters: CurveParameters;
  samplesPerTurn: number;
  period: (parameters: CurveParameters) => number;
  sample: (t: number, parameters: CurveParameters) => CurveSample;
};

export type SampledCurveScene = {
  points: Point[];
  extent: number;
  period: number;
};
