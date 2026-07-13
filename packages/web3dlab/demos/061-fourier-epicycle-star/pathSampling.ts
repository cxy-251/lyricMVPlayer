import type {ComplexPoint} from './types';

export type ClosedPathGenerator = () => ComplexPoint[];

const distance = (a: ComplexPoint, b: ComplexPoint) => Math.hypot(b.x - a.x, b.y - a.y);

export function createPentagramPath(radius = 1): ComplexPoint[] {
  const outerVertices = Array.from({length: 5}, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });

  return [0, 2, 4, 1, 3].map((index) => outerVertices[index]);
}

export function createCirclePath(radius = 0.92, vertexCount = 256): ComplexPoint[] {
  return Array.from({length: vertexCount}, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / vertexCount;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
}

export function createRegularPolygonPath(
  sides: number,
  radius = 0.95,
  rotation = -Math.PI / 2,
): ComplexPoint[] {
  return Array.from({length: sides}, (_, index) => {
    const angle = rotation + index * Math.PI * 2 / sides;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
}

export function createSquarePath(radius = 0.82): ComplexPoint[] {
  return [
    {x: -radius, y: -radius},
    {x: radius, y: -radius},
    {x: radius, y: radius},
    {x: -radius, y: radius},
  ];
}

export function createTrianglePath(radius = 1): ComplexPoint[] {
  return createRegularPolygonPath(3, radius);
}

export function createHeartPath(vertexCount = 320): ComplexPoint[] {
  return Array.from({length: vertexCount}, (_, index) => {
    const angle = index * Math.PI * 2 / vertexCount;
    const sine = Math.sin(angle);
    return {
      x: 16 * sine * sine * sine / 17,
      y: -(
        13 * Math.cos(angle)
        - 5 * Math.cos(2 * angle)
        - 2 * Math.cos(3 * angle)
        - Math.cos(4 * angle)
      ) / 17,
    };
  });
}

export function createInfinityPath(vertexCount = 320): ComplexPoint[] {
  return Array.from({length: vertexCount}, (_, index) => {
    const angle = index * Math.PI * 2 / vertexCount;
    return {
      x: Math.sin(angle) * 0.98,
      y: Math.sin(2 * angle) * 0.48,
    };
  });
}

export function createRosePath(vertexCount = 480): ComplexPoint[] {
  return Array.from({length: vertexCount}, (_, index) => {
    const angle = index * Math.PI * 2 / vertexCount;
    const radius = Math.cos(3 * angle) * 0.94;
    return {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    };
  });
}

export function createLissajousPath(vertexCount = 480): ComplexPoint[] {
  return Array.from({length: vertexCount}, (_, index) => {
    const angle = index * Math.PI * 2 / vertexCount;
    return {
      x: Math.sin(3 * angle + Math.PI / 2) * 0.92,
      y: Math.sin(2 * angle) * 0.84,
    };
  });
}

export function sampleClosedPolyline(vertices: ComplexPoint[], sampleCount: number): ComplexPoint[] {
  if (vertices.length < 2 || sampleCount < 1) return [];

  const segments = vertices.map((start, index) => {
    const end = vertices[(index + 1) % vertices.length];
    return {start, end, length: distance(start, end)};
  });
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);

  if (totalLength <= Number.EPSILON) {
    return Array.from({length: sampleCount}, () => ({...vertices[0]}));
  }

  const samples: ComplexPoint[] = [];
  let segmentIndex = 0;
  let segmentStartDistance = 0;

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const targetDistance = sampleIndex * totalLength / sampleCount;

    while (
      segmentIndex < segments.length - 1
      && targetDistance >= segmentStartDistance + segments[segmentIndex].length
    ) {
      segmentStartDistance += segments[segmentIndex].length;
      segmentIndex += 1;
    }

    const segment = segments[segmentIndex];
    const localDistance = targetDistance - segmentStartDistance;
    const progress = segment.length <= Number.EPSILON ? 0 : localDistance / segment.length;
    samples.push({
      x: segment.start.x + (segment.end.x - segment.start.x) * progress,
      y: segment.start.y + (segment.end.y - segment.start.y) * progress,
    });
  }

  return samples;
}

export const CLOSED_PATHS = {
  pentagram: () => createPentagramPath(1),
  circle: () => createCirclePath(),
  square: () => createSquarePath(),
  triangle: () => createTrianglePath(),
  heart: () => createHeartPath(),
  pentagon: () => createRegularPolygonPath(5),
  hexagon: () => createRegularPolygonPath(6),
  infinity: () => createInfinityPath(),
  rose: () => createRosePath(),
  lissajous: () => createLissajousPath(),
} satisfies Record<string, ClosedPathGenerator>;

export type ClosedPathId = keyof typeof CLOSED_PATHS;

export const CLOSED_PATH_CHOICES: Array<{id: ClosedPathId; label: string}> = [
  {id: 'pentagram', label: 'Pentagram'},
  {id: 'circle', label: 'Circle'},
  {id: 'square', label: 'Square'},
  {id: 'triangle', label: 'Triangle'},
  {id: 'heart', label: 'Heart'},
  {id: 'pentagon', label: 'Pentagon'},
  {id: 'hexagon', label: 'Hexagon'},
  {id: 'infinity', label: 'Infinity'},
  {id: 'rose', label: 'Rose'},
  {id: 'lissajous', label: 'Lissajous'},
];
