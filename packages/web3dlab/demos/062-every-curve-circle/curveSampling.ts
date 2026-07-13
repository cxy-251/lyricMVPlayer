import type {
  CurveDefinition,
  CurveParameters,
  CurveConstruction,
  SampledCurveScene,
} from './types';

const TAU = Math.PI * 2;

const constructionExtent = (construction: CurveConstruction) => {
  let extent = Math.max(
    Math.abs(construction.tracingPoint.x),
    Math.abs(construction.tracingPoint.y),
  );
  for (const circle of [construction.fixedCircle, construction.rollingCircle]) {
    if (!circle) continue;
    extent = Math.max(
      extent,
      Math.abs(circle.center.x) + circle.radius,
      Math.abs(circle.center.y) + circle.radius,
    );
  }
  for (const arm of construction.arms ?? []) {
    extent = Math.max(
      extent,
      Math.abs(arm.start.x) + arm.radius,
      Math.abs(arm.start.y) + arm.radius,
      Math.abs(arm.end.x),
      Math.abs(arm.end.y),
    );
  }
  return extent;
};

export function sampleCurveScene(
  definition: CurveDefinition,
  parameters: CurveParameters,
  quality = 1,
): SampledCurveScene {
  const period = definition.period(parameters);
  const periodTurns = Math.max(1, period / TAU);
  const sampleCount = Math.min(
    7200,
    Math.max(180, Math.ceil(definition.samplesPerTurn * periodTurns * quality)),
  );
  const points = [];
  let extent = 0.5;

  for (let index = 0; index <= sampleCount; index += 1) {
    const sample = definition.sample(period * index / sampleCount, parameters);
    points.push(sample.point);
    extent = Math.max(extent, constructionExtent(sample.construction));
  }

  return {points, extent, period};
}
