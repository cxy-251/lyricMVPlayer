import { SOKOBAN_LEVELS } from './SokobanLevels';
import type {
    SokobanCellViewState,
    SokobanDirection,
    SokobanObservation,
} from './SokobanTypes';

const DIRECTION_OFFSETS: Record<SokobanDirection, readonly [number, number]> = {
    up: [-1, 0],
    down: [1, 0],
    left: [0, -1],
    right: [0, 1],
};

interface SokobanSnapshot {
    readonly player: number;
    readonly boxes: readonly number[];
    readonly steps: number;
    readonly pushes: number;
    readonly phase: 'playing' | 'won';
    readonly deadlocked: boolean;
}

export class SokobanModel {
    private widthValue = 1;
    private heightValue = 1;
    private walls: boolean[] = [true];
    private goals: boolean[] = [false];
    private boxes = new Set<number>();
    private playerIndex = 0;
    private levelIndexValue = 0;
    private stepCount = 0;
    private pushCount = 0;
    private currentPhase: 'playing' | 'won' = 'playing';
    private history: SokobanSnapshot[] = [];
    private deadSquares = new Set<number>();
    private deadlockedValue = false;
    private versionValue = 0;

    constructor() {
        this.loadLevel(0);
    }

    get width(): number {
        return this.widthValue;
    }

    get height(): number {
        return this.heightValue;
    }

    get levelIndex(): number {
        return this.levelIndexValue;
    }

    get levelCount(): number {
        return SOKOBAN_LEVELS.length;
    }

    get levelName(): string {
        return SOKOBAN_LEVELS[this.levelIndexValue]?.name ?? 'UNTITLED';
    }

    get steps(): number {
        return this.stepCount;
    }

    get pushes(): number {
        return this.pushCount;
    }

    get phase(): 'playing' | 'won' {
        return this.currentPhase;
    }

    get canUndo(): boolean {
        return this.history.length > 0;
    }

    get deadlocked(): boolean {
        return this.deadlockedValue;
    }

    get stateVersion(): number {
        return this.versionValue;
    }

    move(direction: SokobanDirection): boolean {
        if (this.currentPhase !== 'playing') {
            return false;
        }
        const [rowOffset, columnOffset] = DIRECTION_OFFSETS[direction];
        const playerRow = Math.floor(this.playerIndex / this.widthValue);
        const playerColumn = this.playerIndex % this.widthValue;
        const target = this.indexAt(
            playerRow + rowOffset,
            playerColumn + columnOffset,
        );
        if (target < 0 || this.walls[target]) {
            return false;
        }

        const pushing = this.boxes.has(target);
        let boxDestination = -1;
        if (pushing) {
            const targetRow = Math.floor(target / this.widthValue);
            const targetColumn = target % this.widthValue;
            boxDestination = this.indexAt(
                targetRow + rowOffset,
                targetColumn + columnOffset,
            );
            if (
                boxDestination < 0
                || this.walls[boxDestination]
                || this.boxes.has(boxDestination)
            ) {
                return false;
            }
        }

        this.history.push(this.createSnapshot());
        if (this.history.length > 512) {
            this.history.shift();
        }
        this.playerIndex = target;
        this.stepCount += 1;

        if (pushing) {
            this.boxes.delete(target);
            this.boxes.add(boxDestination);
            this.pushCount += 1;
            this.deadlockedValue = this.detectDeadlock();
        }
        this.currentPhase = this.isSolved() ? 'won' : 'playing';
        this.versionValue += 1;
        return true;
    }

    undo(): boolean {
        const snapshot = this.history.pop();
        if (!snapshot) {
            return false;
        }
        this.playerIndex = snapshot.player;
        this.boxes = new Set(snapshot.boxes);
        this.stepCount = snapshot.steps;
        this.pushCount = snapshot.pushes;
        this.currentPhase = snapshot.phase;
        this.deadlockedValue = snapshot.deadlocked;
        this.versionValue += 1;
        return true;
    }

    restartLevel(): void {
        this.loadLevel(this.levelIndexValue);
    }

    previousLevel(): void {
        this.loadLevel(
            (this.levelIndexValue - 1 + SOKOBAN_LEVELS.length)
            % SOKOBAN_LEVELS.length,
        );
    }

    nextLevel(): void {
        this.loadLevel((this.levelIndexValue + 1) % SOKOBAN_LEVELS.length);
    }

    loadLevel(index: number): void {
        const count = Math.max(1, SOKOBAN_LEVELS.length);
        this.levelIndexValue = ((index % count) + count) % count;
        const level = SOKOBAN_LEVELS[this.levelIndexValue];
        this.heightValue = Math.max(1, level.map.length);
        this.widthValue = Math.max(
            1,
            ...level.map.map((row) => row.length),
        );
        this.walls = new Array<boolean>(
            this.widthValue * this.heightValue,
        ).fill(true);
        this.goals = new Array<boolean>(
            this.widthValue * this.heightValue,
        ).fill(false);
        this.boxes = new Set<number>();
        this.playerIndex = -1;

        for (let row = 0; row < this.heightValue; row += 1) {
            const source = level.map[row] ?? '';
            for (let column = 0; column < this.widthValue; column += 1) {
                const indexValue = row * this.widthValue + column;
                const token = source[column] ?? '#';
                if (token === '#') {
                    this.walls[indexValue] = true;
                    continue;
                }
                this.walls[indexValue] = false;
                if (token === '.' || token === '*' || token === '+') {
                    this.goals[indexValue] = true;
                }
                if (token === '$' || token === '*') {
                    this.boxes.add(indexValue);
                }
                if (token === '@' || token === '+') {
                    this.playerIndex = indexValue;
                }
            }
        }

        if (this.playerIndex < 0) {
            this.playerIndex = this.walls.findIndex((wall) => !wall);
        }
        this.history = [];
        this.stepCount = 0;
        this.pushCount = 0;
        this.currentPhase = 'playing';
        this.deadSquares = this.computeDeadSquares();
        this.deadlockedValue = this.detectDeadlock();
        this.versionValue += 1;
    }

    createCellViewStates(): readonly SokobanCellViewState[] {
        const result: SokobanCellViewState[] = [];
        for (let index = 0; index < this.walls.length; index += 1) {
            result.push({
                row: Math.floor(index / this.widthValue),
                column: index % this.widthValue,
                wall: this.walls[index],
                goal: this.goals[index],
                box: this.boxes.has(index),
                player: this.playerIndex === index,
            });
        }
        return result;
    }

    createObservation(): SokobanObservation {
        return {
            width: this.widthValue,
            height: this.heightValue,
            walls: [...this.walls],
            goals: [...this.goals],
            boxes: [...this.boxes].sort((left, right) => left - right),
            player: this.playerIndex,
            phase: this.currentPhase,
            levelIndex: this.levelIndexValue,
            stateVersion: this.versionValue,
        };
    }

    private createSnapshot(): SokobanSnapshot {
        return {
            player: this.playerIndex,
            boxes: [...this.boxes],
            steps: this.stepCount,
            pushes: this.pushCount,
            phase: this.currentPhase,
            deadlocked: this.deadlockedValue,
        };
    }

    private indexAt(row: number, column: number): number {
        if (
            row < 0
            || row >= this.heightValue
            || column < 0
            || column >= this.widthValue
        ) {
            return -1;
        }
        return row * this.widthValue + column;
    }

    private isSolved(): boolean {
        for (const box of this.boxes) {
            if (!this.goals[box]) {
                return false;
            }
        }
        return this.boxes.size > 0;
    }

    private computeDeadSquares(): Set<number> {
        const reachable = new Set<number>();
        const queue: number[] = [];
        for (let index = 0; index < this.goals.length; index += 1) {
            if (this.goals[index] && !this.walls[index]) {
                reachable.add(index);
                queue.push(index);
            }
        }

        for (let cursor = 0; cursor < queue.length; cursor += 1) {
            const current = queue[cursor];
            const row = Math.floor(current / this.widthValue);
            const column = current % this.widthValue;
            for (const [rowOffset, columnOffset] of Object.values(DIRECTION_OFFSETS)) {
                const previous = this.indexAt(
                    row - rowOffset,
                    column - columnOffset,
                );
                const support = this.indexAt(
                    row - rowOffset * 2,
                    column - columnOffset * 2,
                );
                if (
                    previous >= 0
                    && support >= 0
                    && !this.walls[previous]
                    && !this.walls[support]
                    && !reachable.has(previous)
                ) {
                    reachable.add(previous);
                    queue.push(previous);
                }
            }
        }

        const dead = new Set<number>();
        for (let index = 0; index < this.walls.length; index += 1) {
            if (!this.walls[index] && !this.goals[index] && !reachable.has(index)) {
                dead.add(index);
            }
        }
        return dead;
    }

    private detectDeadlock(): boolean {
        for (const box of this.boxes) {
            if (!this.goals[box] && this.deadSquares.has(box)) {
                return true;
            }
            const row = Math.floor(box / this.widthValue);
            const column = box % this.widthValue;
            for (const rowStart of [row - 1, row]) {
                for (const columnStart of [column - 1, column]) {
                    if (this.isDeadlockedSquare(rowStart, columnStart)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private isDeadlockedSquare(row: number, column: number): boolean {
        const cells = [
            this.indexAt(row, column),
            this.indexAt(row, column + 1),
            this.indexAt(row + 1, column),
            this.indexAt(row + 1, column + 1),
        ];
        if (cells.some((index) => index < 0)) {
            return false;
        }
        if (!cells.every((index) => this.walls[index] || this.boxes.has(index))) {
            return false;
        }
        return cells.some(
            (index) => this.boxes.has(index) && !this.goals[index],
        );
    }
}
