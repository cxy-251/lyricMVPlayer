import {useMemo} from 'react';

import {sampleCurveScene} from './curveSampling';
import type {CurveDefinition} from './types';

const makePathData = (definition: CurveDefinition) => {
  const scene = sampleCurveScene(definition, definition.defaultParameters, 0.08);
  const points = scene.points;
  const minimumX = Math.min(...points.map((point) => point.x));
  const maximumX = Math.max(...points.map((point) => point.x));
  const minimumY = Math.min(...points.map((point) => point.y));
  const maximumY = Math.max(...points.map((point) => point.y));
  const width = Math.max(0.001, maximumX - minimumX);
  const height = Math.max(0.001, maximumY - minimumY);
  const scale = Math.min(44 / width, 27 / height);
  const offsetX = 26 - (minimumX + maximumX) * scale / 2;
  const offsetY = 16 - (minimumY + maximumY) * scale / 2;

  return points.map((point, index) => {
    const x = offsetX + point.x * scale;
    const y = offsetY + point.y * scale;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
};

function LegendCurve({definition}: {definition: CurveDefinition}) {
  const pathData = useMemo(() => makePathData(definition), [definition]);
  return (
    <svg aria-hidden="true" viewBox="0 0 52 32">
      <path d={pathData} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CurveLegend({
  activeId,
  definitions,
  onSelect,
  visitedIds,
}: {
  activeId: string;
  definitions: CurveDefinition[];
  onSelect: (definition: CurveDefinition) => void;
  visitedIds: Set<string>;
}) {
  return (
    <nav className="curve-museum-legend" aria-label="Curve chapters">
      {definitions.map((definition, index) => {
        const active = definition.id === activeId;
        const visited = visitedIds.has(definition.id);
        return (
          <button
            aria-label={`Chapter ${index + 1}: ${definition.name}`}
            aria-pressed={active}
            className="curve-museum-legend-item"
            data-visited={visited}
            key={definition.id}
            onClick={() => onSelect(definition)}
            type="button"
          >
            <LegendCurve definition={definition} />
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{definition.name}</strong>
          </button>
        );
      })}
    </nav>
  );
}
