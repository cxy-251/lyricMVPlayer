import type {
    MinesweeperCellState,
    MinesweeperCellViewState,
    MinesweeperObservation,
    MinesweeperObservationCell,
    MinesweeperPhase,
} from './MinesweeperTypes';

const DEFAULT_ROWS = 9;
const DEFAULT_COLUMNS = 9;
const DEFAULT_MINE_COUNT = 10;

interface MinesweeperCell {
    mine: boolean;
    state: MinesweeperCellState;
    adjacentMines: number;
    exploded: boolean;
}

export class MinesweeperModel {
    readonly rows: number;
    readonly columns: number;
    readonly mineCount: number;

    private readonly cells: MinesweeperCell[];
    private phaseValue: MinesweeperPhase = 'ready';
    private generated = false;
    private elapsed = 0;
    private seed = 0x6d2b79f5;

    constructor(
        rows = DEFAULT_ROWS,
        columns = DEFAULT_COLUMNS,
        mineCount = DEFAULT_MINE_COUNT,
    ) {
        this.rows = Math.max(4, Math.floor(rows));
        this.columns = Math.max(4, Math.floor(columns));
        this.mineCount = Math.max(
            1,
            Math.min(Math.floor(mineCount), this.rows * this.columns - 9),
        );
        this.cells = Array.from(
            { length: this.rows * this.columns },
            (): MinesweeperCell => ({
                mine: false,
                state: 'hidden',
                adjacentMines: 0,
                exploded: false,
            }),
        );
        this.reset();
    }

    get phase(): MinesweeperPhase {
        return this.phaseValue;
    }

    get elapsedSeconds(): number {
        return this.elapsed;
    }

    get remainingMines(): number {
        let flags = 0;
        for (const cell of this.cells) {
            if (cell.state === 'flagged') {
                flags += 1;
            }
        }
        return this.mineCount - flags;
    }

    reset(): void {
        this.seed = (this.seed + 0x9e3779b9) >>> 0;
        this.generated = false;
        this.phaseValue = 'ready';
        this.elapsed = 0;
        for (const cell of this.cells) {
            cell.mine = false;
            cell.state = 'hidden';
            cell.adjacentMines = 0;
            cell.exploded = false;
        }
    }

    pause(): void {
        if (this.phaseValue === 'playing') {
            this.phaseValue = 'paused';
        }
    }

    resume(): void {
        if (this.phaseValue === 'paused') {
            this.phaseValue = 'playing';
        }
    }

    step(deltaTime: number): void {
        if (this.phaseValue !== 'playing') {
            return;
        }
        this.elapsed += Math.max(0, Math.min(0.1, deltaTime));
    }

    reveal(row: number, column: number): boolean {
        if (!this.isPlayable() || !this.inBounds(row, column)) {
            return false;
        }
        const index = this.indexOf(row, column);
        const cell = this.cells[index];
        if (cell.state === 'flagged') {
            return false;
        }
        if (cell.state === 'revealed') {
            return this.chord(row, column);
        }
        if (!this.generated) {
            this.generateMines(row, column);
            this.generated = true;
            this.phaseValue = 'playing';
        }
        if (cell.mine) {
            cell.state = 'revealed';
            cell.exploded = true;
            this.phaseValue = 'lost';
            return true;
        }
        this.revealSafeArea(row, column);
        this.checkWin();
        return true;
    }

    toggleFlag(row: number, column: number): boolean {
        if (!this.isPlayable() || !this.inBounds(row, column)) {
            return false;
        }
        const cell = this.cells[this.indexOf(row, column)];
        if (cell.state === 'revealed') {
            return false;
        }
        cell.state = cell.state === 'flagged' ? 'hidden' : 'flagged';
        return true;
    }

    chord(row: number, column: number): boolean {
        if (!this.isPlayable() || !this.inBounds(row, column)) {
            return false;
        }
        const source = this.cells[this.indexOf(row, column)];
        if (source.state !== 'revealed' || source.adjacentMines <= 0) {
            return false;
        }
        const neighbors = this.neighborIndexes(row, column);
        let flags = 0;
        for (const index of neighbors) {
            if (this.cells[index].state === 'flagged') {
                flags += 1;
            }
        }
        if (flags !== source.adjacentMines) {
            return false;
        }

        let changed = false;
        for (const index of neighbors) {
            const cell = this.cells[index];
            if (cell.state !== 'hidden') {
                continue;
            }
            changed = true;
            if (cell.mine) {
                cell.state = 'revealed';
                cell.exploded = true;
                this.phaseValue = 'lost';
                return true;
            }
            const neighborRow = Math.floor(index / this.columns);
            const neighborColumn = index % this.columns;
            this.revealSafeArea(neighborRow, neighborColumn);
        }
        if (changed) {
            this.checkWin();
        }
        return changed;
    }

    createObservation(): MinesweeperObservation {
        const cells: MinesweeperObservationCell[] = this.cells.map((cell, index) => ({
            row: Math.floor(index / this.columns),
            column: index % this.columns,
            state: cell.state,
            adjacentMines: cell.state === 'revealed' ? cell.adjacentMines : 0,
        }));
        return {
            rows: this.rows,
            columns: this.columns,
            remainingMines: this.remainingMines,
            phase: this.phaseValue,
            cells,
        };
    }

    createCellViewStates(): readonly MinesweeperCellViewState[] {
        const terminal = this.phaseValue === 'won' || this.phaseValue === 'lost';
        return this.cells.map((cell, index) => ({
            row: Math.floor(index / this.columns),
            column: index % this.columns,
            state: cell.state,
            adjacentMines: cell.state === 'revealed' ? cell.adjacentMines : 0,
            exploded: cell.exploded,
            mineVisible: terminal && cell.mine,
            wrongFlag: terminal && cell.state === 'flagged' && !cell.mine,
        }));
    }

    private isPlayable(): boolean {
        return this.phaseValue === 'ready' || this.phaseValue === 'playing';
    }

    private generateMines(firstRow: number, firstColumn: number): void {
        const excluded = new Set<number>();
        excluded.add(this.indexOf(firstRow, firstColumn));
        for (const index of this.neighborIndexes(firstRow, firstColumn)) {
            excluded.add(index);
        }

        const candidates: number[] = [];
        for (let index = 0; index < this.cells.length; index += 1) {
            if (!excluded.has(index)) {
                candidates.push(index);
            }
        }
        this.shuffle(candidates);
        for (let index = 0; index < this.mineCount; index += 1) {
            this.cells[candidates[index]].mine = true;
        }

        for (let row = 0; row < this.rows; row += 1) {
            for (let column = 0; column < this.columns; column += 1) {
                const cell = this.cells[this.indexOf(row, column)];
                if (cell.mine) {
                    continue;
                }
                let count = 0;
                for (const neighborIndex of this.neighborIndexes(row, column)) {
                    if (this.cells[neighborIndex].mine) {
                        count += 1;
                    }
                }
                cell.adjacentMines = count;
            }
        }
    }

    private revealSafeArea(startRow: number, startColumn: number): void {
        const queue = [this.indexOf(startRow, startColumn)];
        const visited = new Set<number>();
        while (queue.length > 0) {
            const index = queue.shift();
            if (index === undefined || visited.has(index)) {
                continue;
            }
            visited.add(index);
            const cell = this.cells[index];
            if (cell.mine || cell.state === 'flagged') {
                continue;
            }
            cell.state = 'revealed';
            if (cell.adjacentMines !== 0) {
                continue;
            }
            const row = Math.floor(index / this.columns);
            const column = index % this.columns;
            for (const neighborIndex of this.neighborIndexes(row, column)) {
                const neighbor = this.cells[neighborIndex];
                if (!neighbor.mine && neighbor.state === 'hidden') {
                    queue.push(neighborIndex);
                }
            }
        }
    }

    private checkWin(): void {
        for (const cell of this.cells) {
            if (!cell.mine && cell.state !== 'revealed') {
                return;
            }
        }
        this.phaseValue = 'won';
        for (const cell of this.cells) {
            if (cell.mine && cell.state === 'hidden') {
                cell.state = 'flagged';
            }
        }
    }

    private neighborIndexes(row: number, column: number): number[] {
        const result: number[] = [];
        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
            for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
                if (rowOffset === 0 && columnOffset === 0) {
                    continue;
                }
                const nextRow = row + rowOffset;
                const nextColumn = column + columnOffset;
                if (this.inBounds(nextRow, nextColumn)) {
                    result.push(this.indexOf(nextRow, nextColumn));
                }
            }
        }
        return result;
    }

    private shuffle(values: number[]): void {
        for (let index = values.length - 1; index > 0; index -= 1) {
            const target = Math.floor(this.random() * (index + 1));
            const swap = values[index];
            values[index] = values[target];
            values[target] = swap;
        }
    }

    private random(): number {
        this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
        return this.seed / 0x1_0000_0000;
    }

    private inBounds(row: number, column: number): boolean {
        return row >= 0 && row < this.rows && column >= 0 && column < this.columns;
    }

    private indexOf(row: number, column: number): number {
        return row * this.columns + column;
    }
}
