import {
    XorShift32Random,
    type RandomSource,
} from '../shared/RandomSource';
import type {
    Game2048Direction,
    Game2048Observation,
    Game2048RuleSet,
} from './Game2048Types';

const SIZE = 4;
const RESET_SALT = 0x9e3779b9;
const RULE_SETS: readonly Game2048RuleSet[] = ['classic', 'chain', 'corner'];
const START_TARGET = 128;

export interface Game2048MoveResult {
    readonly board: number[][];
    readonly score: number;
    readonly changed: boolean;
}

export class Game2048Model {
    private boardState: number[][] = [];
    private currentScore = 0;
    private currentPhase: 'playing' | 'lost' = 'playing';
    private currentChain = 0;
    private highestChain = 0;
    private currentTargetTile = START_TARGET;
    private currentRuleSet: Game2048RuleSet = 'classic';
    private ruleSetIndex = -1;
    private lastEvent = 'NEW RUN';

    constructor(
        private readonly randomSource: RandomSource = new XorShift32Random(0x4f1bbcdc),
    ) {
        this.reset();
    }

    get phase(): 'playing' | 'lost' {
        return this.currentPhase;
    }

    get score(): number {
        return this.currentScore;
    }

    get chain(): number {
        return this.currentChain;
    }

    get bestChain(): number {
        return this.highestChain;
    }

    get targetTile(): number {
        return this.currentTargetTile;
    }

    get ruleSet(): Game2048RuleSet {
        return this.currentRuleSet;
    }

    get eventText(): string {
        return this.lastEvent;
    }

    get maximumTile(): number {
        return Math.max(...this.boardState.flat(), 0);
    }

    reset(): void {
        this.ruleSetIndex = (this.ruleSetIndex + 1) % RULE_SETS.length;
        this.currentRuleSet = RULE_SETS[this.ruleSetIndex];
        this.boardState = Array.from({ length: SIZE }, () => new Array<number>(SIZE).fill(0));
        this.currentScore = 0;
        this.currentPhase = 'playing';
        this.currentChain = 0;
        this.highestChain = 0;
        this.currentTargetTile = START_TARGET;
        this.lastEvent = `${this.currentRuleSet.toUpperCase()} MODE`;
        this.randomSource.reset(
            XorShift32Random.mix(this.randomSource.snapshot() ^ RESET_SALT),
        );
        this.addRandomTile();
        this.addRandomTile();
    }

    move(direction: Game2048Direction): boolean {
        if (this.currentPhase !== 'playing') {
            return false;
        }
        const result = Game2048Model.simulateMove(this.boardState, direction);
        if (!result.changed) {
            this.currentChain = 0;
            this.lastEvent = 'NO MERGE';
            if (!this.hasAvailableMove(this.boardState)) {
                this.currentPhase = 'lost';
                this.lastEvent = 'NO MOVES';
            }
            return false;
        }

        this.boardState = result.board;
        if (result.score > 0) {
            this.currentChain += 1;
            this.highestChain = Math.max(this.highestChain, this.currentChain);
        } else {
            this.currentChain = 0;
        }

        const multiplier = this.scoreMultiplier(result.score > 0);
        const earned = Math.round(result.score * multiplier);
        this.currentScore += earned;
        this.lastEvent = result.score > 0
            ? `CHAIN ${this.currentChain} · +${earned}`
            : 'SHIFT';
        this.resolveMilestones();
        this.addRandomTile();
        if (!this.hasAvailableMove(this.boardState)) {
            this.currentPhase = 'lost';
            this.lastEvent = 'NO MOVES';
        }
        return true;
    }

    createObservation(): Game2048Observation {
        return {
            board: this.boardState.map((row) => [...row]),
            phase: this.currentPhase,
        };
    }

    static simulateMove(
        source: readonly (readonly number[])[],
        direction: Game2048Direction,
    ): Game2048MoveResult {
        const board = source.map((row) => [...row]);
        let score = 0;
        let changed = false;
        for (let index = 0; index < SIZE; index += 1) {
            const line = Game2048Model.readLine(board, direction, index);
            const merged = Game2048Model.slideLine(line);
            score += merged.score;
            for (let offset = 0; offset < SIZE; offset += 1) {
                if (line[offset] !== merged.values[offset]) {
                    changed = true;
                }
            }
            Game2048Model.writeLine(board, direction, index, merged.values);
        }
        return { board, score, changed };
    }

    private static readLine(
        board: readonly (readonly number[])[],
        direction: Game2048Direction,
        index: number,
    ): number[] {
        switch (direction) {
            case 'left':
                return [...board[index]];
            case 'right':
                return [...board[index]].reverse();
            case 'up':
                return board.map((row) => row[index]);
            case 'down':
                return board.map((row) => row[index]).reverse();
        }
    }

    private static writeLine(
        board: number[][],
        direction: Game2048Direction,
        index: number,
        values: readonly number[],
    ): void {
        for (let offset = 0; offset < SIZE; offset += 1) {
            switch (direction) {
                case 'left':
                    board[index][offset] = values[offset];
                    break;
                case 'right':
                    board[index][SIZE - 1 - offset] = values[offset];
                    break;
                case 'up':
                    board[offset][index] = values[offset];
                    break;
                case 'down':
                    board[SIZE - 1 - offset][index] = values[offset];
                    break;
            }
        }
    }

    private static slideLine(values: readonly number[]): {
        values: number[];
        score: number;
    } {
        const compact = values.filter((value) => value > 0);
        const result: number[] = [];
        let score = 0;
        for (let index = 0; index < compact.length; index += 1) {
            if (compact[index] === compact[index + 1]) {
                const merged = compact[index] * 2;
                result.push(merged);
                score += merged;
                index += 1;
            } else {
                result.push(compact[index]);
            }
        }
        while (result.length < SIZE) {
            result.push(0);
        }
        return { values: result, score };
    }

    private scoreMultiplier(merged: boolean): number {
        if (!merged) {
            return 1;
        }
        switch (this.currentRuleSet) {
            case 'chain':
                return 1 + Math.min(4, Math.max(0, this.currentChain - 1)) * 0.25;
            case 'corner':
                return this.maximumTileInCorner(this.boardState) ? 1.35 : 1;
            case 'classic':
                return 1;
        }
    }

    private resolveMilestones(): void {
        while (this.maximumTile >= this.currentTargetTile) {
            const reached = this.currentTargetTile;
            const bonus = reached * 2;
            const releaseCount = reached >= 512 ? 2 : 1;
            const released = this.releaseLowestTiles(releaseCount);
            this.currentScore += bonus;
            this.currentTargetTile *= 2;
            this.lastEvent = `TARGET ${reached} · +${bonus} · SPACE +${released}`;
        }
    }

    private releaseLowestTiles(count: number): number {
        const maximum = this.maximumTile;
        const candidates: Array<{ row: number; column: number; value: number }> = [];
        for (let row = 0; row < SIZE; row += 1) {
            for (let column = 0; column < SIZE; column += 1) {
                const value = this.boardState[row][column];
                if (value > 0 && value < maximum) {
                    candidates.push({ row, column, value });
                }
            }
        }
        candidates.sort((left, right) => left.value - right.value);
        let released = 0;
        for (const candidate of candidates.slice(0, count)) {
            this.boardState[candidate.row][candidate.column] = 0;
            released += 1;
        }
        return released;
    }

    private maximumTileInCorner(board: readonly (readonly number[])[]): boolean {
        const maximum = Math.max(...board.flat(), 0);
        return board[0][0] === maximum
            || board[0][SIZE - 1] === maximum
            || board[SIZE - 1][0] === maximum
            || board[SIZE - 1][SIZE - 1] === maximum;
    }

    private addRandomTile(): void {
        const empty: Array<{ row: number; column: number }> = [];
        for (let row = 0; row < SIZE; row += 1) {
            for (let column = 0; column < SIZE; column += 1) {
                if (this.boardState[row][column] === 0) {
                    empty.push({ row, column });
                }
            }
        }
        if (empty.length === 0) {
            return;
        }
        const location = empty[this.randomSource.nextInt(empty.length)];
        const twoChance = this.currentRuleSet === 'chain'
            ? 0.78
            : this.currentRuleSet === 'corner'
                ? 0.92
                : 0.9;
        this.boardState[location.row][location.column] = this.randomSource.next() < twoChance
            ? 2
            : 4;
    }

    private hasAvailableMove(board: readonly (readonly number[])[]): boolean {
        if (board.some((row) => row.some((value) => value === 0))) {
            return true;
        }
        for (let row = 0; row < SIZE; row += 1) {
            for (let column = 0; column < SIZE; column += 1) {
                const value = board[row][column];
                if (
                    (column + 1 < SIZE && board[row][column + 1] === value)
                    || (row + 1 < SIZE && board[row + 1][column] === value)
                ) {
                    return true;
                }
            }
        }
        return false;
    }
}
