import type {
    TetrisPieceType,
    TetrisPoint,
    TetrisRotation,
} from './TetrisTypes';

const PIECE_CELLS: Readonly<Record<
    TetrisPieceType,
    readonly (readonly TetrisPoint[])[]
>> = {
    I: [
        [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
        [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }],
        [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }],
        [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }],
    ],
    O: [
        [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
        [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
        [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
        [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
    ],
    T: [
        [{ x: 1, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
        [{ x: 1, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 0 }],
        [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 0 }],
        [{ x: 1, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }],
    ],
    J: [
        [{ x: 0, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
        [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 1, y: 1 }, { x: 1, y: 0 }],
        [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 0 }],
        [{ x: 1, y: 2 }, { x: 1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }],
    ],
    L: [
        [{ x: 2, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
        [{ x: 1, y: 2 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
        [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 0 }],
        [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 1, y: 0 }],
    ],
    S: [
        [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
        [{ x: 1, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 0 }],
        [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }],
        [{ x: 0, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }],
    ],
    Z: [
        [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
        [{ x: 2, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 0 }],
        [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
        [{ x: 1, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 0 }],
    ],
};

const JLSTZ_KICKS: Readonly<Record<string, readonly TetrisPoint[]>> = {
    '0>1': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: -2 }, { x: -1, y: -2 }],
    '1>0': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
    '1>2': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
    '2>1': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: -2 }, { x: -1, y: -2 }],
    '2>3': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: -2 }, { x: 1, y: -2 }],
    '3>2': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: 2 }, { x: -1, y: 2 }],
    '3>0': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: 2 }, { x: -1, y: 2 }],
    '0>3': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: -2 }, { x: 1, y: -2 }],
};

const I_KICKS: Readonly<Record<string, readonly TetrisPoint[]>> = {
    '0>1': [{ x: 0, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 0 }, { x: -2, y: -1 }, { x: 1, y: 2 }],
    '1>0': [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 1 }, { x: -1, y: -2 }],
    '1>2': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 2 }, { x: 2, y: -1 }],
    '2>1': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -2, y: 0 }, { x: 1, y: -2 }, { x: -2, y: 1 }],
    '2>3': [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 1 }, { x: -1, y: -2 }],
    '3>2': [{ x: 0, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 0 }, { x: -2, y: -1 }, { x: 1, y: 2 }],
    '3>0': [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -2, y: 0 }, { x: 1, y: -2 }, { x: -2, y: 1 }],
    '0>3': [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 2 }, { x: 2, y: -1 }],
};

export function tetrisPieceCells(
    type: TetrisPieceType,
    rotation: TetrisRotation,
): readonly TetrisPoint[] {
    return PIECE_CELLS[type][rotation];
}

export function tetrisKickTests(
    type: TetrisPieceType,
    from: TetrisRotation,
    to: TetrisRotation,
): readonly TetrisPoint[] {
    if (type === 'O') {
        return [{ x: 0, y: 0 }];
    }
    const key = `${from}>${to}`;
    return type === 'I'
        ? I_KICKS[key] ?? [{ x: 0, y: 0 }]
        : JLSTZ_KICKS[key] ?? [{ x: 0, y: 0 }];
}

export function normalizeTetrisRotation(value: number): TetrisRotation {
    return ((value % 4) + 4) % 4 as TetrisRotation;
}
