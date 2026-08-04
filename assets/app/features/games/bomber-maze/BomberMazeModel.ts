import type {
    BomberMazeAction,
    BomberMazeBombState,
    BomberMazeCellKind,
    BomberMazeDirection,
    BomberMazeEnemyState,
    BomberMazeExplosionState,
    BomberMazeObservation,
    BomberMazePoint,
    BomberMazePowerupKind,
    BomberMazePowerupState,
} from './BomberMazeTypes';

const WIDTH = 13;
const HEIGHT = 11;
const START_LIVES = 3;
const MAX_LIVES = 4;
const BOMB_FUSE = 2.15;
const EXPLOSION_DURATION = 0.36;
const ENEMY_BASE_INTERVAL = 0.32;
const INVULNERABLE_DURATION = 1.1;
const MAX_BOMB_CAPACITY = 4;
const MAX_BLAST_RANGE = 5;
const MAX_ENEMIES = 6;
const DIRECTIONS: readonly BomberMazeDirection[] = ['up', 'down', 'left', 'right'];

const OFFSETS: Record<BomberMazeDirection, readonly [number, number]> = {
    up: [0, 1],
    down: [0, -1],
    left: [-1, 0],
    right: [1, 0],
};

const ENEMY_SPAWNS: readonly BomberMazePoint[] = [
    { x: WIDTH - 2, y: HEIGHT - 2 },
    { x: 1, y: HEIGHT - 2 },
    { x: WIDTH - 2, y: 1 },
    { x: 1, y: 5 },
    { x: WIDTH - 2, y: 5 },
    { x: 5, y: HEIGHT - 2 },
];

interface MutableBomb {
    x: number;
    y: number;
    fuse: number;
    range: number;
}

interface MutableExplosion {
    x: number;
    y: number;
    remaining: number;
}

interface MutableEnemy {
    id: number;
    x: number;
    y: number;
    spawnX: number;
    spawnY: number;
    direction: BomberMazeDirection;
    alive: boolean;
}

interface MutablePowerup {
    x: number;
    y: number;
    kind: BomberMazePowerupKind;
    revealed: boolean;
    collected: boolean;
}

export class BomberMazeModel {
    readonly width = WIDTH;
    readonly height = HEIGHT;

    private cells: BomberMazeCellKind[] = [];
    private player: BomberMazePoint = { x: 1, y: 1 };
    private enemies: MutableEnemy[] = [];
    private bombs: MutableBomb[] = [];
    private explosions: MutableExplosion[] = [];
    private powerups: MutablePowerup[] = [];
    private currentPhase: 'playing' | 'won' | 'lost' = 'playing';
    private currentScore = 0;
    private currentLives = START_LIVES;
    private currentBombCapacity = 1;
    private currentBlastRange = 2;
    private currentRound = 1;
    private highestRound = 1;
    private enemyElapsed = 0;
    private invulnerableElapsed = 0;
    private randomState = 0x83a5f17d;

    constructor() {
        this.reset();
    }

    get phase(): 'playing' | 'won' | 'lost' {
        return this.currentPhase;
    }

    get score(): number {
        return this.currentScore;
    }

    get lives(): number {
        return this.currentLives;
    }

    get round(): number {
        return this.currentRound;
    }

    get bestRound(): number {
        return this.highestRound;
    }

    get invulnerable(): boolean {
        return this.invulnerableElapsed > 0;
    }

    reset(): void {
        this.randomState = this.nextRandomState(this.randomState ^ 0x9e3779b9);
        this.currentPhase = 'playing';
        this.currentScore = 0;
        this.currentLives = START_LIVES;
        this.currentBombCapacity = 1;
        this.currentBlastRange = 2;
        this.currentRound = 1;
        this.highestRound = Math.max(this.highestRound, this.currentRound);
        this.prepareRound();
    }

    advanceRound(): boolean {
        if (this.currentPhase !== 'won') {
            return false;
        }
        const completedRound = this.currentRound;
        this.currentScore += 250 + completedRound * 75;
        if (completedRound % 3 === 0) {
            this.currentLives = Math.min(MAX_LIVES, this.currentLives + 1);
        }
        this.currentRound += 1;
        this.highestRound = Math.max(this.highestRound, this.currentRound);
        this.currentPhase = 'playing';
        this.prepareRound();
        return true;
    }

    perform(action: BomberMazeAction): boolean {
        if (this.currentPhase !== 'playing') {
            return false;
        }
        return action.kind === 'bomb'
            ? this.placeBomb()
            : this.movePlayer(action.direction);
    }

    movePlayer(direction: BomberMazeDirection): boolean {
        if (this.currentPhase !== 'playing') {
            return false;
        }
        const next = this.offset(this.player, direction);
        if (!this.canOccupy(next)) {
            return false;
        }
        this.player = next;
        this.collectPowerup();
        this.resolveContactDamage();
        return true;
    }

    placeBomb(): boolean {
        if (
            this.currentPhase !== 'playing'
            || this.bombs.length >= this.currentBombCapacity
            || this.bombAt(this.player.x, this.player.y)
        ) {
            return false;
        }
        this.bombs.push({
            x: this.player.x,
            y: this.player.y,
            fuse: BOMB_FUSE,
            range: this.currentBlastRange,
        });
        return true;
    }

    step(deltaTime: number): boolean {
        if (this.currentPhase !== 'playing') {
            return false;
        }
        const dt = Math.max(0, Math.min(0.1, deltaTime));
        if (dt <= 0) {
            return false;
        }

        let changed = false;
        this.invulnerableElapsed = Math.max(0, this.invulnerableElapsed - dt);

        for (const explosion of this.explosions) {
            explosion.remaining -= dt;
        }
        const beforeExplosionCount = this.explosions.length;
        this.explosions = this.explosions.filter((explosion) => explosion.remaining > 0);
        changed = this.explosions.length !== beforeExplosionCount || changed;

        const detonationQueue: MutableBomb[] = [];
        for (const bomb of this.bombs) {
            bomb.fuse -= dt;
            if (bomb.fuse <= 0) {
                detonationQueue.push(bomb);
            }
        }
        if (detonationQueue.length > 0) {
            this.resolveDetonations(detonationQueue);
            changed = true;
        }

        this.enemyElapsed += dt;
        let enemySteps = 0;
        const interval = this.enemyInterval();
        while (
            this.enemyElapsed >= interval
            && enemySteps < 3
            && this.currentPhase === 'playing'
        ) {
            this.enemyElapsed -= interval;
            changed = this.moveEnemies() || changed;
            enemySteps += 1;
        }

        if (this.currentPhase === 'playing') {
            this.resolveExplosionDamage();
            this.resolveContactDamage();
        }
        return changed;
    }

    createObservation(): BomberMazeObservation {
        return {
            width: WIDTH,
            height: HEIGHT,
            round: this.currentRound,
            cells: [...this.cells],
            player: { ...this.player },
            enemies: this.enemies
                .filter((enemy) => enemy.alive)
                .map((enemy): BomberMazeEnemyState => ({
                    id: enemy.id,
                    x: enemy.x,
                    y: enemy.y,
                })),
            bombs: this.bombs.map((bomb): BomberMazeBombState => ({ ...bomb })),
            explosions: this.explosions.map((explosion): BomberMazeExplosionState => ({
                ...explosion,
            })),
            powerups: this.powerups
                .filter((powerup) => powerup.revealed && !powerup.collected)
                .map((powerup): BomberMazePowerupState => ({
                    x: powerup.x,
                    y: powerup.y,
                    kind: powerup.kind,
                })),
            bombCapacity: this.currentBombCapacity,
            activeBombs: this.bombs.length,
            blastRange: this.currentBlastRange,
            phase: this.currentPhase,
        };
    }

    private prepareRound(): void {
        this.enemyElapsed = 0;
        this.invulnerableElapsed = 0;
        this.bombs = [];
        this.explosions = [];
        this.enemies = [];
        this.generateBoard();
        this.resetActors();
    }

    private generateBoard(): void {
        this.cells = new Array<BomberMazeCellKind>(WIDTH * HEIGHT).fill('floor');
        this.powerups = [];

        const protectedCells = new Set<string>([
            this.key(1, 1),
            this.key(2, 1),
            this.key(3, 1),
            this.key(4, 1),
            this.key(1, 2),
            this.key(1, 3),
            this.key(1, 4),
            this.key(WIDTH - 2, HEIGHT - 2),
            this.key(WIDTH - 3, HEIGHT - 2),
            this.key(WIDTH - 4, HEIGHT - 2),
            this.key(WIDTH - 5, HEIGHT - 2),
            this.key(WIDTH - 2, HEIGHT - 3),
            this.key(WIDTH - 2, HEIGHT - 4),
            this.key(WIDTH - 2, HEIGHT - 5),
            this.key(1, HEIGHT - 2),
            this.key(2, HEIGHT - 2),
            this.key(3, HEIGHT - 2),
            this.key(4, HEIGHT - 2),
            this.key(1, HEIGHT - 3),
            this.key(1, HEIGHT - 4),
            this.key(1, HEIGHT - 5),
            this.key(WIDTH - 2, 1),
            this.key(WIDTH - 3, 1),
            this.key(WIDTH - 4, 1),
            this.key(WIDTH - 5, 1),
            this.key(WIDTH - 2, 2),
            this.key(WIDTH - 2, 3),
            this.key(WIDTH - 2, 4),
        ]);
        for (const spawn of ENEMY_SPAWNS) {
            protectedCells.add(this.key(spawn.x, spawn.y));
            for (const direction of DIRECTIONS) {
                const neighbor = this.offset(spawn, direction);
                if (this.inside(neighbor)) {
                    protectedCells.add(this.key(neighbor.x, neighbor.y));
                }
            }
        }

        const softCells: BomberMazePoint[] = [];
        const density = Math.min(0.62, 0.43 + (this.currentRound - 1) * 0.025);
        for (let y = 0; y < HEIGHT; y += 1) {
            for (let x = 0; x < WIDTH; x += 1) {
                const border = x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1;
                const pillar = x % 2 === 0 && y % 2 === 0;
                if (border || pillar) {
                    this.setCell(x, y, 'hard-wall');
                    continue;
                }
                if (!protectedCells.has(this.key(x, y)) && this.random() < density) {
                    this.setCell(x, y, 'soft-wall');
                    softCells.push({ x, y });
                }
            }
        }

        for (let index = softCells.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(this.random() * (index + 1));
            const temporary = softCells[index];
            softCells[index] = softCells[swapIndex];
            softCells[swapIndex] = temporary;
        }
        const powerupTarget = Math.min(8, 4 + Math.ceil(this.currentRound / 2));
        const powerupCount = Math.min(powerupTarget, softCells.length);
        for (let index = 0; index < powerupCount; index += 1) {
            const point = softCells[index];
            this.powerups.push({
                x: point.x,
                y: point.y,
                kind: index % 2 === 0 ? 'range' : 'capacity',
                revealed: false,
                collected: false,
            });
        }
    }

    private resetActors(): void {
        this.player = { x: 1, y: 1 };
        if (this.enemies.length === 0) {
            const count = Math.min(
                MAX_ENEMIES,
                3 + Math.floor((this.currentRound - 1) / 2),
            );
            this.enemies = ENEMY_SPAWNS
                .slice(0, count)
                .map((spawn, id): MutableEnemy => ({
                    id,
                    x: spawn.x,
                    y: spawn.y,
                    spawnX: spawn.x,
                    spawnY: spawn.y,
                    direction: id % 2 === 0 ? 'left' : 'down',
                    alive: true,
                }));
            return;
        }
        for (const enemy of this.enemies) {
            if (!enemy.alive) {
                continue;
            }
            enemy.x = enemy.spawnX;
            enemy.y = enemy.spawnY;
            enemy.direction = enemy.id % 2 === 0 ? 'left' : 'down';
        }
    }

    private enemyInterval(): number {
        return Math.max(0.18, ENEMY_BASE_INTERVAL - (this.currentRound - 1) * 0.018);
    }

    private moveEnemies(): boolean {
        let changed = false;
        for (const enemy of this.enemies) {
            if (!enemy.alive) {
                continue;
            }
            const directions = this.enemyDirections(enemy);
            const chosen = directions[0];
            if (!chosen) {
                continue;
            }
            const next = this.offset(enemy, chosen);
            enemy.x = next.x;
            enemy.y = next.y;
            enemy.direction = chosen;
            changed = true;
        }
        this.resolveContactDamage();
        return changed;
    }

    private enemyDirections(enemy: MutableEnemy): BomberMazeDirection[] {
        const reverse = this.opposite(enemy.direction);
        return DIRECTIONS
            .filter((direction) => {
                const next = this.offset(enemy, direction);
                return this.canOccupy(next) && !this.isExplosionCell(next.x, next.y);
            })
            .sort((left, right) => {
                const leftPoint = this.offset(enemy, left);
                const rightPoint = this.offset(enemy, right);
                const leftScore = this.enemyMoveScore(leftPoint, left === reverse);
                const rightScore = this.enemyMoveScore(rightPoint, right === reverse);
                return rightScore - leftScore;
            });
    }

    private enemyMoveScore(point: BomberMazePoint, reversing: boolean): number {
        const distance = Math.abs(point.x - this.player.x) + Math.abs(point.y - this.player.y);
        const danger = this.futureBlastTime(point.x, point.y);
        return -distance * 8
            - (reversing ? 7 : 0)
            + (danger === null ? 20 : Math.min(0, danger - 0.65) * 80)
            + this.random() * 3;
    }

    private resolveDetonations(initial: readonly MutableBomb[]): void {
        const queue = [...initial];
        const queued = new Set(queue.map((bomb) => this.key(bomb.x, bomb.y)));

        for (let cursor = 0; cursor < queue.length; cursor += 1) {
            const bomb = queue[cursor];
            const liveIndex = this.bombs.indexOf(bomb);
            if (liveIndex < 0) {
                continue;
            }
            this.bombs.splice(liveIndex, 1);
            const blastCells = this.computeBlastCells(bomb.x, bomb.y, bomb.range);
            for (const cell of blastCells) {
                this.addExplosion(cell.x, cell.y);
                const chained = this.bombAt(cell.x, cell.y);
                if (chained && !queued.has(this.key(chained.x, chained.y))) {
                    queued.add(this.key(chained.x, chained.y));
                    queue.push(chained);
                }
                if (this.cellAt(cell.x, cell.y) === 'soft-wall') {
                    this.setCell(cell.x, cell.y, 'floor');
                    this.currentScore += 20;
                    const powerup = this.powerups.find((candidate) => (
                        candidate.x === cell.x
                        && candidate.y === cell.y
                        && !candidate.collected
                    ));
                    if (powerup) {
                        powerup.revealed = true;
                    }
                }
            }
        }
        this.resolveExplosionDamage();
    }

    private computeBlastCells(x: number, y: number, range: number): BomberMazePoint[] {
        const cells: BomberMazePoint[] = [{ x, y }];
        for (const direction of DIRECTIONS) {
            const [dx, dy] = OFFSETS[direction];
            for (let step = 1; step <= range; step += 1) {
                const next = { x: x + dx * step, y: y + dy * step };
                if (!this.inside(next) || this.cellAt(next.x, next.y) === 'hard-wall') {
                    break;
                }
                cells.push(next);
                if (this.cellAt(next.x, next.y) === 'soft-wall') {
                    break;
                }
            }
        }
        return cells;
    }

    private addExplosion(x: number, y: number): void {
        const existing = this.explosions.find((explosion) => (
            explosion.x === x && explosion.y === y
        ));
        if (existing) {
            existing.remaining = Math.max(existing.remaining, EXPLOSION_DURATION);
            return;
        }
        this.explosions.push({ x, y, remaining: EXPLOSION_DURATION });
    }

    private resolveExplosionDamage(): void {
        for (const enemy of this.enemies) {
            if (enemy.alive && this.isExplosionCell(enemy.x, enemy.y)) {
                enemy.alive = false;
                this.currentScore += 100 + this.currentRound * 15;
            }
        }
        if (this.enemies.every((enemy) => !enemy.alive)) {
            this.currentPhase = 'won';
            this.bombs = [];
            return;
        }
        if (this.isExplosionCell(this.player.x, this.player.y)) {
            this.damagePlayer();
        }
    }

    private resolveContactDamage(): void {
        if (
            this.currentPhase === 'playing'
            && this.enemies.some((enemy) => (
                enemy.alive
                && enemy.x === this.player.x
                && enemy.y === this.player.y
            ))
        ) {
            this.damagePlayer();
        }
    }

    private damagePlayer(): void {
        if (this.invulnerableElapsed > 0 || this.currentPhase !== 'playing') {
            return;
        }
        this.currentLives = Math.max(0, this.currentLives - 1);
        this.bombs = [];
        this.explosions = [];
        this.enemyElapsed = 0;
        if (this.currentLives === 0) {
            this.currentPhase = 'lost';
            this.invulnerableElapsed = 0;
            return;
        }
        this.resetActors();
        this.invulnerableElapsed = INVULNERABLE_DURATION;
    }

    private collectPowerup(): void {
        const powerup = this.powerups.find((candidate) => (
            candidate.revealed
            && !candidate.collected
            && candidate.x === this.player.x
            && candidate.y === this.player.y
        ));
        if (!powerup) {
            return;
        }
        powerup.collected = true;
        if (powerup.kind === 'range') {
            this.currentBlastRange = Math.min(MAX_BLAST_RANGE, this.currentBlastRange + 1);
        } else {
            this.currentBombCapacity = Math.min(
                MAX_BOMB_CAPACITY,
                this.currentBombCapacity + 1,
            );
        }
        this.currentScore += 60 + this.currentRound * 10;
    }

    private canOccupy(point: BomberMazePoint): boolean {
        return this.inside(point)
            && this.cellAt(point.x, point.y) === 'floor'
            && !this.bombAt(point.x, point.y);
    }

    private futureBlastTime(x: number, y: number): number | null {
        if (this.isExplosionCell(x, y)) {
            return 0;
        }
        let earliest: number | null = null;
        for (const bomb of this.bombs) {
            if (this.computeBlastCells(bomb.x, bomb.y, bomb.range).some((cell) => (
                cell.x === x && cell.y === y
            ))) {
                earliest = earliest === null ? bomb.fuse : Math.min(earliest, bomb.fuse);
            }
        }
        return earliest;
    }

    private isExplosionCell(x: number, y: number): boolean {
        return this.explosions.some((explosion) => explosion.x === x && explosion.y === y);
    }

    private bombAt(x: number, y: number): MutableBomb | null {
        return this.bombs.find((bomb) => bomb.x === x && bomb.y === y) ?? null;
    }

    private cellAt(x: number, y: number): BomberMazeCellKind {
        return this.cells[this.index(x, y)] ?? 'hard-wall';
    }

    private setCell(x: number, y: number, kind: BomberMazeCellKind): void {
        this.cells[this.index(x, y)] = kind;
    }

    private offset(point: BomberMazePoint, direction: BomberMazeDirection): BomberMazePoint {
        const [dx, dy] = OFFSETS[direction];
        return { x: point.x + dx, y: point.y + dy };
    }

    private opposite(direction: BomberMazeDirection): BomberMazeDirection {
        return direction === 'up'
            ? 'down'
            : direction === 'down'
                ? 'up'
                : direction === 'left'
                    ? 'right'
                    : 'left';
    }

    private inside(point: BomberMazePoint): boolean {
        return point.x >= 0 && point.x < WIDTH && point.y >= 0 && point.y < HEIGHT;
    }

    private index(x: number, y: number): number {
        return y * WIDTH + x;
    }

    private key(x: number, y: number): string {
        return `${x}:${y}`;
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
}
