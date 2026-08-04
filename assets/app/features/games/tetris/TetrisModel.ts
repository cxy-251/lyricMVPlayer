import {
    normalizeTetrisRotation,
    tetrisKickTests,
    tetrisPieceCells,
} from './TetrisPieces';
import {
    TETRIS_BOARD_HEIGHT,
    TETRIS_BOARD_WIDTH,
    TETRIS_VISIBLE_HEIGHT,
    type TetrisActivePiece,
    type TetrisObservation,
    type TetrisPieceType,
    type TetrisRotation,
} from './TetrisTypes';

const PIECES: readonly TetrisPieceType[] = ['I', 'O', 'T', 'J', 'L', 'S', 'Z'];
const LOCK_DELAY = 0.5;
const MAXIMUM_LOCK_RESETS = 15;
const SOFT_DROP_INTERVAL = 0.035;

export class TetrisModel {
    private board: Array<Array<TetrisPieceType | null>> = [];
    private activePiece: TetrisActivePiece | null = null;
    private nextQueue: TetrisPieceType[] = [];
    private bag: TetrisPieceType[] = [];
    private holdPiece: TetrisPieceType | null = null;
    private holdAvailable = true;
    private currentPhase: 'playing' | 'lost' = 'playing';
    private currentScore = 0;
    private clearedLines = 0;
    private currentLevel = 0;
    private fallAccumulator = 0;
    private lockElapsed = 0;
    private lockResetCount = 0;
    private softDropActive = false;
    private serial = 0;
    private randomState = 0x6d2b79f5;

    constructor() {
        this.reset();
    }

    get phase(): 'playing' | 'lost' {
        return this.currentPhase;
    }

    get score(): number {
        return this.currentScore;
    }

    get lines(): number {
        return this.clearedLines;
    }

    get level(): number {
        return this.currentLevel;
    }

    get active(): Readonly<TetrisActivePiece> | null {
        return this.activePiece;
    }

    get next(): readonly TetrisPieceType[] {
        return this.nextQueue;
    }

    get hold(): TetrisPieceType | null {
        return this.holdPiece;
    }

    get canHold(): boolean {
        return this.holdAvailable;
    }

    get pieceSerial(): number {
        return this.serial;
    }

    reset(): void {
        this.board = Array.from(
            { length: TETRIS_BOARD_HEIGHT },
            () => new Array<TetrisPieceType | null>(TETRIS_BOARD_WIDTH).fill(null),
        );
        this.activePiece = null;
        this.nextQueue.length = 0;
        this.bag.length = 0;
        this.holdPiece = null;
        this.holdAvailable = true;
        this.currentPhase = 'playing';
        this.currentScore = 0;
        this.clearedLines = 0;
        this.currentLevel = 0;
        this.fallAccumulator = 0;
        this.lockElapsed = 0;
        this.lockResetCount = 0;
        this.softDropActive = false;
        this.randomState = this.nextRandomState(this.randomState ^ 0x9e3779b9);
        this.ensureQueue();
        this.spawnNextPiece();
    }

    setSoftDrop(active: boolean): void {
        this.softDropActive = active;
    }

    step(deltaTime: number): void {
        if (this.currentPhase !== 'playing' || !this.activePiece) {
            return;
        }
        const dt = Math.max(0, Math.min(0.1, deltaTime));
        if (dt <= 0) {
            return;
        }

        const interval = this.softDropActive
            ? SOFT_DROP_INTERVAL
            : this.gravityInterval();
        this.fallAccumulator += dt;
        while (this.fallAccumulator >= interval) {
            this.fallAccumulator -= interval;
            if (!this.moveDown(this.softDropActive)) {
                this.fallAccumulator = 0;
                break;
            }
        }

        if (this.isGrounded()) {
            this.lockElapsed += dt;
            if (this.lockElapsed >= LOCK_DELAY) {
                this.lockActivePiece();
            }
        } else {
            this.lockElapsed = 0;
            this.lockResetCount = 0;
        }
    }

    moveHorizontal(direction: -1 | 1): boolean {
        const active = this.activePiece;
        if (this.currentPhase !== 'playing' || !active) {
            return false;
        }
        const candidate = { ...active, x: active.x + direction };
        if (!this.canPlace(candidate)) {
            return false;
        }
        this.activePiece = candidate;
        this.resetLockDelayAfterManipulation();
        return true;
    }

    rotate(direction: -1 | 1): boolean {
        const active = this.activePiece;
        if (this.currentPhase !== 'playing' || !active) {
            return false;
        }
        const nextRotation = normalizeTetrisRotation(active.rotation + direction);
        for (const kick of tetrisKickTests(active.type, active.rotation, nextRotation)) {
            const candidate: TetrisActivePiece = {
                type: active.type,
                rotation: nextRotation,
                x: active.x + kick.x,
                y: active.y + kick.y,
            };
            if (this.canPlace(candidate)) {
                this.activePiece = candidate;
                this.resetLockDelayAfterManipulation();
                return true;
            }
        }
        return false;
    }

    softDropStep(): boolean {
        if (this.currentPhase !== 'playing') {
            return false;
        }
        return this.moveDown(true);
    }

    hardDrop(): boolean {
        if (this.currentPhase !== 'playing' || !this.activePiece) {
            return false;
        }
        let distance = 0;
        while (this.moveDown(false)) {
            distance += 1;
        }
        this.currentScore += distance * 2;
        this.lockActivePiece();
        return true;
    }

    holdCurrent(): boolean {
        const active = this.activePiece;
        if (
            this.currentPhase !== 'playing'
            || !active
            || !this.holdAvailable
        ) {
            return false;
        }

        const outgoing = active.type;
        this.holdAvailable = false;
        this.fallAccumulator = 0;
        this.lockElapsed = 0;
        this.lockResetCount = 0;
        if (this.holdPiece === null) {
            this.holdPiece = outgoing;
            this.spawnNextPiece(false);
        } else {
            const incoming = this.holdPiece;
            this.holdPiece = outgoing;
            this.spawnPiece(incoming);
        }
        return true;
    }

    ghostY(): number {
        const active = this.activePiece;
        if (!active) {
            return 0;
        }
        let y = active.y;
        while (this.canPlace({ ...active, y: y - 1 })) {
            y -= 1;
        }
        return y;
    }

    createVisibleBoard(): readonly (readonly (TetrisPieceType | null)[])[] {
        return this.board
            .slice(0, TETRIS_VISIBLE_HEIGHT)
            .map((row) => [...row]);
    }

    createObservation(): TetrisObservation {
        return {
            phase: this.currentPhase,
            board: this.board.map((row) => [...row]),
            active: this.activePiece ? { ...this.activePiece } : null,
            next: [...this.nextQueue.slice(0, 5)],
            hold: this.holdPiece,
            canHold: this.holdAvailable,
            pieceSerial: this.serial,
        };
    }

    private moveDown(scoreSoftDrop: boolean): boolean {
        const active = this.activePiece;
        if (!active) {
            return false;
        }
        const candidate = { ...active, y: active.y - 1 };
        if (!this.canPlace(candidate)) {
            return false;
        }
        this.activePiece = candidate;
        if (scoreSoftDrop) {
            this.currentScore += 1;
        }
        this.lockElapsed = 0;
        return true;
    }

    private isGrounded(): boolean {
        const active = this.activePiece;
        return Boolean(active && !this.canPlace({ ...active, y: active.y - 1 }));
    }

    private resetLockDelayAfterManipulation(): void {
        if (!this.isGrounded() || this.lockResetCount >= MAXIMUM_LOCK_RESETS) {
            return;
        }
        this.lockElapsed = 0;
        this.lockResetCount += 1;
    }

    private lockActivePiece(): void {
        const active = this.activePiece;
        if (!active) {
            return;
        }
        for (const cell of tetrisPieceCells(active.type, active.rotation)) {
            const x = active.x + cell.x;
            const y = active.y + cell.y;
            if (
                x >= 0
                && x < TETRIS_BOARD_WIDTH
                && y >= 0
                && y < TETRIS_BOARD_HEIGHT
            ) {
                this.board[y][x] = active.type;
            }
        }

        const lineCount = this.clearCompletedLines();
        const scoreTable = [0, 100, 300, 500, 800] as const;
        this.currentScore += scoreTable[lineCount] * (this.currentLevel + 1);
        this.clearedLines += lineCount;
        this.currentLevel = Math.floor(this.clearedLines / 10);
        this.holdAvailable = true;
        this.spawnNextPiece();
    }

    private clearCompletedLines(): number {
        let cleared = 0;
        for (let y = 0; y < TETRIS_BOARD_HEIGHT; y += 1) {
            if (this.board[y].every((cell) => cell !== null)) {
                this.board.splice(y, 1);
                this.board.push(
                    new Array<TetrisPieceType | null>(TETRIS_BOARD_WIDTH).fill(null),
                );
                cleared += 1;
                y -= 1;
            }
        }
        return cleared;
    }

    private spawnNextPiece(resetHold = true): void {
        this.ensureQueue();
        const type = this.nextQueue.shift();
        if (!type) {
            throw new Error('Tetris next queue is empty');
        }
        this.ensureQueue();
        if (resetHold) {
            this.holdAvailable = true;
        }
        this.spawnPiece(type);
    }

    private spawnPiece(type: TetrisPieceType): void {
        const piece: TetrisActivePiece = {
            type,
            rotation: 0,
            x: 3,
            y: 18,
        };
        this.activePiece = piece;
        this.fallAccumulator = 0;
        this.lockElapsed = 0;
        this.lockResetCount = 0;
        this.serial += 1;
        if (!this.canPlace(piece)) {
            this.currentPhase = 'lost';
            this.activePiece = null;
        }
    }

    private canPlace(piece: TetrisActivePiece): boolean {
        for (const cell of tetrisPieceCells(piece.type, piece.rotation)) {
            const x = piece.x + cell.x;
            const y = piece.y + cell.y;
            if (
                x < 0
                || x >= TETRIS_BOARD_WIDTH
                || y < 0
                || y >= TETRIS_BOARD_HEIGHT
                || this.board[y][x] !== null
            ) {
                return false;
            }
        }
        return true;
    }

    private ensureQueue(): void {
        while (this.nextQueue.length < 5) {
            if (this.bag.length === 0) {
                this.refillBag();
            }
            const piece = this.bag.pop();
            if (piece) {
                this.nextQueue.push(piece);
            }
        }
    }

    private refillBag(): void {
        this.bag = [...PIECES];
        for (let index = this.bag.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(this.random() * (index + 1));
            [this.bag[index], this.bag[swapIndex]] = [
                this.bag[swapIndex],
                this.bag[index],
            ];
        }
    }

    private gravityInterval(): number {
        return Math.max(0.055, 0.78 * Math.pow(0.84, this.currentLevel));
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
        return state >>> 0 || 0x6d2b79f5;
    }
}
