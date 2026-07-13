import {useEffect, useMemo, useRef} from 'react';
import type {WheelEvent} from 'react';

import {
  CLOSED_PATHS,
  type ClosedPathId,
} from './pathSampling';

type ShapeChoice = {id: ClosedPathId; label: string};

const makePathData = (shapeId: ClosedPathId) => {
  const points = CLOSED_PATHS[shapeId]();
  const minimumX = Math.min(...points.map((point) => point.x));
  const maximumX = Math.max(...points.map((point) => point.x));
  const minimumY = Math.min(...points.map((point) => point.y));
  const maximumY = Math.max(...points.map((point) => point.y));
  const width = Math.max(0.001, maximumX - minimumX);
  const height = Math.max(0.001, maximumY - minimumY);
  const scale = Math.min(45 / width, 27 / height);
  const offsetX = 26 - (minimumX + maximumX) * scale / 2;
  const offsetY = 16 - (minimumY + maximumY) * scale / 2;
  return `${points.map((point, index) => (
    `${index === 0 ? 'M' : 'L'}${(offsetX + point.x * scale).toFixed(2)} ${(offsetY + point.y * scale).toFixed(2)}`
  )).join(' ')} Z`;
};

function ShapeThumbnail({shapeId}: {shapeId: ClosedPathId}) {
  const pathData = useMemo(() => makePathData(shapeId), [shapeId]);
  return (
    <svg aria-hidden="true" viewBox="0 0 52 32">
      <path d={pathData} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ShapeChapterRail({
  activeId,
  choices,
  onSelect,
  visitedIds,
}: {
  activeId: ClosedPathId;
  choices: ShapeChoice[];
  onSelect: (choice: ShapeChoice) => void;
  visitedIds: Set<ClosedPathId>;
}) {
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    const activeItem = rail?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!rail || !activeItem) return;
    rail.scrollTo({
      behavior: 'smooth',
      left: activeItem.offsetLeft - (rail.clientWidth - activeItem.clientWidth) / 2,
    });
  }, [activeId]);

  const handleWheel = (event: WheelEvent<HTMLElement>) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    event.currentTarget.scrollLeft += event.deltaY;
  };

  return (
    <nav
      className="fourier-star-legend"
      aria-label="Fourier curve chapters"
      onWheel={handleWheel}
      ref={railRef}
    >
      {choices.map((choice, index) => (
        <button
          aria-label={`Chapter ${index + 1}: ${choice.label}`}
          aria-pressed={choice.id === activeId}
          className="fourier-star-legend-item"
          data-visited={visitedIds.has(choice.id)}
          key={choice.id}
          onClick={() => onSelect(choice)}
          type="button"
        >
          <ShapeThumbnail shapeId={choice.id} />
          <span>{String(index + 1).padStart(2, '0')}</span>
          <strong>{choice.label}</strong>
        </button>
      ))}
    </nav>
  );
}
