import type {
    MatchThreeCell,
    MatchThreeColor,
    MatchThreeObservation,
    MatchThreeSpecial,
    MatchThreeSwap,
    MatchThreeTileState,
} from './MatchThreeTypes';

const SIZE = 8;
const COLOR_COUNT = 6;
const START_MOVES = 30;
const TARGET_SCORE = 1800;
const MAX_CASCADES = 32;

type MutableTile = MatchThreeTileState | null;

interface MatchRun {
    readonly cells: readonly MatchThreeCell[];
    readonly color: MatchThreeColor;
    readonly horizontal: boolean;
}

interface SpecialCreation {
    readonly cell: MatchThreeCell;
    readonly color: MatchThreeColor;
    readonly special: Exclude<MatchThreeSpecial, 'none'>;
}

export class MatchThreeModel {
    private boardState: MutableTile[][] = [];
    private currentScore = 0;
    private currentMoves = START_MOVES;
    private currentPhase: 'playing' | 'won' | 'lost' = 'playing';
    private currentCombo = 0;
    private randomState = 0x6d2b79f5;

    constructor() {
        this.reset();
    }

    get phase(): 'playing' | 'won' | 'lost' {
        return this.currentPhase;
    }

    get score(): number {
        return this.currentScore;
    }

    get movesRemaining(): number {
        return this.currentMoves;
    }

    get targetScore(): number {
        return TARGET_SCORE;
    }

    get combo(): number {
        return this.currentCombo;
    }

    reset(): void {
        this.randomState = this.nextRandomState(this.randomState ^ 0x9e3779b9);
        this.boardState = this.createPlayableBoard();
        this.currentScore = 0;
        this.currentMoves = START_MOVES;
        this.currentPhase = 'playing';
        this.currentCombo = 0;
    }

    swap(first: MatchThreeCell, second: MatchThreeCell): boolean {
        if (
            this.currentPhase !== 'playing'
            || !this.inside(first)
            || !this.inside(second)
            || this.manhattan(first, second) !== 1
        ) {
            return false;
        }

        this.currentCombo = 0;
        const firstTile = this.requireTile(first);
        const secondTile = this.requireTile(second);
        const prismSwap = firstTile.special === 'prism' || secondTile.special === 'prism';

        this.swapCells(first, second);

        let scoreGain = 0;
        if (prismSwap) {
            const clear = new Set<string>([
                this.key(first),
                this.key(second),
            ]);
            if (firstTile.special === 'prism' && secondTile.special === 'prism') {
                for (let row = 0; row < SIZE; row += 1) {
                    for (let column = 0; column < SIZE; column += 1) {
                        clear.add(this.key({ row, column }));
                    }
                }
            } else {
                const targetColor = firstTile.special === 'prism'
                    ? secondTile.color
                    : firstTile.color;
                if (targetColor >= 0) {
                    for (let row = 0; row < SIZE; row += 1) {
                        for (let column = 0; column < SIZE; column += 1) {
                            const tile = this.boardState[row][column];
                            if (tile?.color === targetColor) {
                                clear.add(this.key({ row, column }));
                            }
                        }
                    }
                }
            }
            scoreGain = this.resolveExplicitClear(clear);
        } else {
            const runs = MatchThreeModel.findRuns(this.snapshotBoard());
            if (runs.length === 0) {
                this.swapCells(first, second);
                return false;
            }
            scoreGain = this.resolveRuns(runs, [second, first], 1);
        }

        this.currentMoves = Math.max(0, this.currentMoves - 1);
        this.currentScore += scoreGain;
        this.ensurePlayable();

        if (this.currentScore >= TARGET_SCORE) {
            this.currentPhase = 'won';
        } else if (this.currentMoves === 0) {
            this.currentPhase = 'lost';
        }
        return true;
    }

    createObservation(): MatchThreeObservation {
        return {
            size: SIZE,
            board: this.snapshotBoard(),
            score: this.currentScore,
            movesRemaining: this.currentMoves,
            targetScore: TARGET_SCORE,
            phase: this.currentPhase,
        };
    }

    static listLegalSwaps(
        board: readonly (readonly MatchThreeTileState[])[],
    ): MatchThreeSwap[] {
        const swaps: MatchThreeSwap[] = [];
        const size = board.length;
        for (let row = 0; row < size; row += 1) {
            for (let column = 0; column < size; column += 1) {
                const first = { row, column };
                if (column + 1 < size) {
                    const second = { row, column: column + 1 };
                    if (MatchThreeModel.isLegalSwap(board, first, second)) {
                        swaps.push({ first, second });
                    }
                }
                if (row + 1 < size) {
                    const second = { row: row + 1, column };
                    if (MatchThreeModel.isLegalSwap(board, first, second)) {
                        swaps.push({ first, second });
                    }
                }
            }
        }
        return swaps;
    }

    static evaluateSwap(
        board: readonly (readonly MatchThreeTileState[])[],
        swap: MatchThreeSwap,
    ): number {
        const firstTile = board[swap.first.row]?.[swap.first.column];
        const secondTile = board[swap.second.row]?.[swap.second.column];
        if (!firstTile || !secondTile) {
            return Number.NEGATIVE_INFINITY;
        }

        if (firstTile.special === 'prism' || secondTile.special === 'prism') {
            if (firstTile.special === 'prism' && secondTile.special === 'prism') {
                return board.length * board.length * 80;
            }
            const target = firstTile.special === 'prism'
                ? secondTile.color
                : firstTile.color;
            const count = board.flat().filter((tile) => tile.color === target).length;
            return 900 + count * 55;
        }

        const simulated = board.map((row) => row.map((tile) => ({ ...tile })));
        const temporary = simulated[swap.first.row][swap.first.column];
        simulated[swap.first.row][swap.first.column] =
            simulated[swap.second.row][swap.second.column];
        simulated[swap.second.row][swap.second.column] = temporary;

        const runs = MatchThreeModel.findRuns(simulated);
        if (runs.length === 0) {
            return Number.NEGATIVE_INFINITY;
        }

        const matched = new Set<string>();
        let score = 0;
        for (const run of runs) {
            for (const cell of run.cells) {
                matched.add(`${cell.row}:${cell.column}`);
            }
            score += run.cells.length >= 5
                ? 420
                : run.cells.length === 4
                    ? 190
                    : 0;
        }
        for (const key of matched) {
            const [rowText, columnText] = key.split(':');
            const tile = simulated[Number(rowText)][Number(columnText)];
            if (tile.special === 'row' || tile.special === 'column') {
                score += 240;
            } else if (tile.special === 'prism') {
                score += 700;
            }
        }

        const center = (board.length - 1) / 2;
        const centerDistance = Math.abs(swap.second.row - center)
            + Math.abs(swap.second.column - center);
        return score + matched.size * 45 - centerDistance * 2;
    }

    private resolveExplicitClear(initial: ReadonlySet<string>): number {
        this.currentCombo = 1;
        let score = this.clearCells(initial, [], 1);
        this.collapseAndRefill();

        let cascade = 2;
        while (cascade <= MAX_CASCADES) {
            const runs = MatchThreeModel.findRuns(this.snapshotBoard());
            if (runs.length === 0) {
                break;
            }
            score += this.resolveSingleRunSet(runs, [], cascade);
            this.currentCombo = cascade;
            cascade += 1;
        }
        return score;
    }

    private resolveRuns(
        initialRuns: readonly MatchRun[],
        preferred: readonly MatchThreeCell[],
        startCascade: number,
    ): number {
        let runs = initialRuns;
        let cascade = startCascade;
        let score = 0;
        while (runs.length > 0 && cascade <= MAX_CASCADES) {
            score += this.resolveSingleRunSet(
                runs,
                cascade === startCascade ? preferred : [],
                cascade,
            );
            this.currentCombo = cascade;
            cascade += 1;
            runs = MatchThreeModel.findRuns(this.snapshotBoard());
        }

        if (runs.length > 0) {
            this.boardState = this.createPlayableBoard();
        }
        return score;
    }

    private resolveSingleRunSet(
        runs: readonly MatchRun[],
        preferred: readonly MatchThreeCell[],
        cascade: number,
    ): number {
        const creations = this.buildSpecialCreations(runs, preferred);
        const creationKeys = new Set(creations.map((creation) => this.key(creation.cell)));
        const clear = new Set<string>();
        for (const run of runs) {
            for (const cell of run.cells) {
                const key = this.key(cell);
                if (!creationKeys.has(key)) {
                    clear.add(key);
                }
            }
        }

        const score = this.clearCells(clear, creations, cascade);
        this.collapseAndRefill();
        return score;
    }

    private clearCells(
        initial: ReadonlySet<string>,
        creations: readonly SpecialCreation[],
        cascade: number,
    ): number {
        const clear = this.expandSpecialClears(initial);
        for (const key of clear) {
            const cell = this.parseKey(key);
            this.boardState[cell.row][cell.column] = null;
        }

        let creationBonus = 0;
        for (const creation of creations) {
            this.boardState[creation.cell.row][creation.cell.column] = {
                color: creation.special === 'prism' ? -1 : creation.color,
                special: creation.special,
            };
            creationBonus += creation.special === 'prism' ? 150 : 65;
        }
        return clear.size * 12 * Math.max(1, cascade) + creationBonus;
    }

    private expandSpecialClears(initial: ReadonlySet<string>): Set<string> {
        const clear = new Set(initial);
        const queue = [...initial];
        for (let cursor = 0; cursor < queue.length; cursor += 1) {
            const cell = this.parseKey(queue[cursor]);
            const tile = this.boardState[cell.row]?.[cell.column];
            if (!tile || tile.special === 'none') {
                continue;
            }

            const add = (row: number, column: number): void => {
                const key = this.key({ row, column });
                if (!clear.has(key)) {
                    clear.add(key);
                    queue.push(key);
                }
            };

            if (tile.special === 'row') {
                for (let column = 0; column < SIZE; column += 1) {
                    add(cell.row, column);
                }
            } else if (tile.special === 'column') {
                for (let row = 0; row < SIZE; row += 1) {
                    add(row, cell.column);
                }
            } else {
                for (let row = 0; row < SIZE; row += 1) {
                    for (let column = 0; column < SIZE; column += 1) {
                        add(row, column);
                    }
                }
            }
        }
        return clear;
    }

    private buildSpecialCreations(
        runs: readonly MatchRun[],
        preferred: readonly MatchThreeCell[],
    ): SpecialCreation[] {
        const membership = new Map<string, MatchRun[]>();
        for (const run of runs) {
            for (const cell of run.cells) {
                const key = this.key(cell);
                const list = membership.get(key) ?? [];
                list.push(run);
                membership.set(key, list);
            }
        }

        const creations = new Map<string, SpecialCreation>();
        for (const [key, memberRuns] of membership) {
            if (memberRuns.length > 1) {
                const cell = this.parseKey(key);
                creations.set(key, {
                    cell,
                    color: memberRuns[0].color,
                    special: 'prism',
                });
            }
        }

        for (const run of runs) {
            if (run.cells.length < 4) {
                continue;
            }
            const anchor = preferred.find((cell) => (
                run.cells.some((candidate) => this.sameCell(candidate, cell))
            )) ?? run.cells[Math.floor(run.cells.length / 2)];
            const key = this.key(anchor);
            const special: Exclude<MatchThreeSpecial, 'none'> =
                run.cells.length >= 5 ? 'prism' : run.horizontal ? 'row' : 'column';
            const existing = creations.get(key);
            if (!existing || existing.special !== 'prism') {
                creations.set(key, {
                    cell: anchor,
                    color: run.color,
                    special,
                });
            }
        }
        return [...creations.values()];
    }

    private collapseAndRefill(): void {
        for (let column = 0; column < SIZE; column += 1) {
            const survivors: MatchThreeTileState[] = [];
            for (let row = 0; row < SIZE; row += 1) {
                const tile = this.boardState[row][column];
                if (tile) {
                    survivors.push(tile);
                }
            }
            for (let row = 0; row < SIZE; row += 1) {
                this.boardState[row][column] = row < survivors.length
                    ? survivors[row]
                    : this.createRandomTile();
            }
        }
    }

    private ensurePlayable(): void {
        const board = this.snapshotBoard();
        if (
            MatchThreeModel.findRuns(board).length > 0
            || MatchThreeModel.listLegalSwaps(board).length === 0
        ) {
            this.boardState = this.createPlayableBoard();
        }
    }

    private createPlayableBoard(): MatchThreeTileState[][] {
        let lastBoard: MatchThreeTileState[][] = [];
        for (let attempt = 0; attempt < 128; attempt += 1) {
            const board = Array.from(
                { length: SIZE },
                () => new Array<MatchThreeTileState>(SIZE),
            );
            for (let row = 0; row < SIZE; row += 1) {
                for (let column = 0; column < SIZE; column += 1) {
                    const forbidden = new Set<number>();
                    if (
                        column >= 2
                        && board[row][column - 1].color === board[row][column - 2].color
                    ) {
                        forbidden.add(board[row][column - 1].color);
                    }
                    if (
                        row >= 2
                        && board[row - 1][column].color === board[row - 2][column].color
                    ) {
                        forbidden.add(board[row - 1][column].color);
                    }
                    board[row][column] = this.createRandomTile(forbidden);
                }
            }
            lastBoard = board;
            if (MatchThreeModel.listLegalSwaps(board).length > 0) {
                return board;
            }
        }
        return lastBoard;
    }

    private createRandomTile(
        forbidden: ReadonlySet<number> = new Set<number>(),
    ): MatchThreeTileState {
        const available: MatchThreeColor[] = [];
        for (let color = 0; color < COLOR_COUNT; color += 1) {
            if (!forbidden.has(color)) {
                available.push(color as MatchThreeColor);
            }
        }
        const color = available[Math.floor(this.random() * available.length)]
            ?? 0;
        return { color, special: 'none' };
    }

    private snapshotBoard(): MatchThreeTileState[][] {
        return this.boardState.map((row, rowIndex) => row.map((tile, columnIndex) => {
            if (!tile) {
                throw new Error(
                    `Match Three board contains an empty cell at ${rowIndex}:${columnIndex}.`,
                );
            }
            return { ...tile };
        }));
    }

    private requireTile(cell: MatchThreeCell): MatchThreeTileState {
        const tile = this.boardState[cell.row]?.[cell.column];
        if (!tile) {
            throw new Error(`Match Three tile is unavailable at ${this.key(cell)}.`);
        }
        return tile;
    }

    private swapCells(first: MatchThreeCell, second: MatchThreeCell): void {
        const temporary = this.boardState[first.row][first.column];
        this.boardState[first.row][first.column] =
            this.boardState[second.row][second.column];
        this.boardState[second.row][second.column] = temporary;
    }

    private inside(cell: MatchThreeCell): boolean {
        return cell.row >= 0
            && cell.row < SIZE
            && cell.column >= 0
            && cell.column < SIZE;
    }

    private manhattan(first: MatchThreeCell, second: MatchThreeCell): number {
        return Math.abs(first.row - second.row)
            + Math.abs(first.column - second.column);
    }

    private sameCell(first: MatchThreeCell, second: MatchThreeCell): boolean {
        return first.row === second.row && first.column === second.column;
    }

    private key(cell: MatchThreeCell): string {
        return `${cell.row}:${cell.column}`;
    }

    private parseKey(key: string): MatchThreeCell {
        const [rowText, columnText] = key.split(':');
        return { row: Number(rowText), column: Number(columnText) };
    }

    private random(): number {
        this.randomState = this.nextRandomState(this.randomState);
        return this.randomState / 0x100000000;
    }

    private nextRandomState(value: number): number {
        let state = value >>> 0;
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return state >>> 0;
    }

    private static isLegalSwap(
        board: readonly (readonly MatchThreeTileState[])[],
        first: MatchThreeCell,
        second: MatchThreeCell,
    ): boolean {
        const firstTile = board[first.row]?.[first.column];
        const secondTile = board[second.row]?.[second.column];
        if (!firstTile || !secondTile) {
            return false;
        }
        if (firstTile.special === 'prism' || secondTile.special === 'prism') {
            return true;
        }
        const simulated = board.map((row) => row.map((tile) => ({ ...tile })));
        const temporary = simulated[first.row][first.column];
        simulated[first.row][first.column] = simulated[second.row][second.column];
        simulated[second.row][second.column] = temporary;
        return MatchThreeModel.findRuns(simulated).length > 0;
    }

    private static findRuns(
        board: readonly (readonly MatchThreeTileState[])[],
    ): MatchRun[] {
        const size = board.length;
        const runs: MatchRun[] = [];

        for (let row = 0; row < size; row += 1) {
            let start = 0;
            while (start < size) {
                const color = board[row][start].color;
                if (color < 0) {
                    start += 1;
                    continue;
                }
                let end = start + 1;
                while (end < size && board[row][end].color === color) {
                    end += 1;
                }
                if (end - start >= 3) {
                    const cells: MatchThreeCell[] = [];
                    for (let column = start; column < end; column += 1) {
                        cells.push({ row, column });
                    }
                    runs.push({
                        cells,
                        color: color as MatchThreeColor,
                        horizontal: true,
                    });
                }
                start = end;
            }
        }

        for (let column = 0; column < size; column += 1) {
            let start = 0;
            while (start < size) {
                const color = board[start][column].color;
                if (color < 0) {
                    start += 1;
                    continue;
                }
                let end = start + 1;
                while (end < size && board[end][column].color === color) {
                    end += 1;
                }
                if (end - start >= 3) {
                    const cells: MatchThreeCell[] = [];
                    for (let row = start; row < end; row += 1) {
                        cells.push({ row, column });
                    }
                    runs.push({
                        cells,
                        color: color as MatchThreeColor,
                        horizontal: false,
                    });
                }
                start = end;
            }
        }
        return runs;
    }
}
