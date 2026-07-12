import type {DemoMetadata} from '../../types';

export const paperRubiksCubeMetadata: DemoMetadata = {
  id: 'paper-rubiks-cube',
  title: 'Rubik’s Cube Playground',
  description: 'A playable 2×2–6×6 cube lab with responsive sizing, click-to-turn outer faces, drag-selected layers from 3×3 upward, dimension-aware scrambling, selectable materials, timing, and state solving.',
  tags: ['Interactive Puzzle', 'State Solver', 'Min2phase', 'Twips', 'Raycasting', 'Rubik’s Cube'],
  instructions: [
    'Drag the background or black trim to orbit the camera; scroll to zoom.',
    'Short-click a colored sticker to turn its outer face. Toggle direction or hold Shift to reverse that click turn.',
    'On 3×3–6×6 cubes, drag a colored sticker along its visible row or column. Drag direction chooses the rotation axis and the starting sticker chooses the exact outer or inner layer; 2×2 keeps click turns only.',
    'Open the Leva panel to choose a 2×2 through 6×6 cube, switch sticker colors, and change the cube body finish.',
    'Scramble adds new moves to the current position. Higher dimensions use more moves and include inner layers, so their scramble takes longer. Undo or reset remain available as separate actions.',
    'Start the timer explicitly for manual play; smart solve starts its own timer automatically.',
    'Smart solve reads the current cube state directly; it does not reverse or compare your move history.',
    '2×2 uses its dedicated browser solver and 3×3 uses browser min2phase. During local development, 4×4–6×6 use the matching Python reduction solver; the deployed gallery keeps those dimensions as manual challenges.',
    'Pause smart solve, scramble or turn stickers from that state, then continue to calculate a new solution and step count.',
    'While a valid solution is paused, continue it or advance exactly one move.',
  ],
  route: 'paper-rubiks-cube',
};
