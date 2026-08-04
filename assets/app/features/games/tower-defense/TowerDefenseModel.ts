import type {
    TowerDefenseAction,
    TowerDefenseEnemyState,
    TowerDefenseObservation,
    TowerDefensePoint,
    TowerDefenseShotState,
    TowerDefenseSlotState,
    TowerDefenseTowerKind,
    TowerDefenseTowerState,
} from './TowerDefenseTypes';

const WIDTH = 12;
const HEIGHT = 8;
const START_GOLD = 175;
const START_LIVES = 12;
const MAX_WAVES = 8;
const BUILD_COUNTDOWN = 4;
const MAX_TOWER_LEVEL = 3;
const SHOT_DURATION = 0.15;

const PATH: readonly TowerDefensePoint[] = [
    { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 },
    { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 },
    { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 }, { x: 7, y: 1 },
    { x: 8, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 2 }, { x: 9, y: 3 },
    { x: 9, y: 4 }, { x: 8, y: 4 }, { x: 7, y: 4 }, { x: 6, y: 4 },
    { x: 5, y: 4 }, { x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 },
    { x: 2, y: 5 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 },
    { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 8, y: 6 },
    { x: 9, y: 6 }, { x: 10, y: 6 }, { x: 11, y: 6 },
];

const SLOT_POINTS: readonly TowerDefensePoint[] = [
    { x: 1, y: 0 },
    { x: 2, y: 2 },
    { x: 4, y: 1 },
    { x: 5, y: 2 },
    { x: 7, y: 2 },
    { x: 8, y: 3 },
    { x: 10, y: 3 },
    { x: 10, y: 5 },
    { x: 8, y: 5 },
    { x: 6, y: 5 },
    { x: 4, y: 5 },
    { x: 1, y: 5 },
];

interface MutableTower {
    kind: TowerDefenseTowerKind;
    level: number;
    cooldown: number;
}

interface MutableSlot extends TowerDefensePoint {
    id: number;
    tower: MutableTower | null;
}

interface MutableEnemy {
    id: number;
    progress: number;
    hp: number;
    maxHp: number;
    speed: number;
    reward: number;
}

interface MutableShot {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    kind: TowerDefenseTowerKind;
    remaining: number;
}

export class TowerDefenseModel {
    readonly width = WIDTH;
    readonly height = HEIGHT;

    private slots: MutableSlot[] = [];
    private enemies: MutableEnemy[] = [];
    private shots: MutableShot[] = [];
    private currentGold = START_GOLD;
    private currentLives = START_LIVES;
    private currentScore = 0;
    private currentWave = 1;
    private currentPhase: 'building' | 'wave' | 'won' | 'lost' = 'building';
    private spawnedCount = 0;
    private waveEnemyCount = 0;
    private spawnElapsed = 0;
    private buildElapsed = BUILD_COUNTDOWN;
    private nextEnemyId = 1;

    constructor() {
        this.reset();
    }

    get phase(): 'building' | 'wave' | 'won' | 'lost' {
        return this.currentPhase;
    }

    reset(): void {
        this.slots = SLOT_POINTS.map((point, id): MutableSlot => ({
            id,
            x: point.x,
            y: point.y,
            tower: null,
        }));
        this.enemies = [];
        this.shots = [];
        this.currentGold = START_GOLD;
        this.currentLives = START_LIVES;
        this.currentScore = 0;
        this.currentWave = 1;
        this.currentPhase = 'building';
        this.spawnedCount = 0;
        this.waveEnemyCount = this.waveSize(this.currentWave);
        this.spawnElapsed = 0;
        this.buildElapsed = BUILD_COUNTDOWN;
        this.nextEnemyId = 1;
    }

    perform(action: TowerDefenseAction): boolean {
        if (this.currentPhase === 'won' || this.currentPhase === 'lost') {
            return false;
        }
        switch (action.kind) {
            case 'build':
                return this.build(action.slotId, action.towerKind);
            case 'upgrade':
                return this.upgrade(action.slotId);
            case 'start-wave':
                return this.startWave();
        }
    }

    step(deltaTime: number): boolean {
        if (this.currentPhase === 'won' || this.currentPhase === 'lost') {
            return false;
        }
        const dt = Math.max(0, Math.min(0.1, deltaTime));
        if (dt <= 0) {
            return false;
        }

        let changed = false;
        for (const shot of this.shots) {
            shot.remaining -= dt;
        }
        const previousShots = this.shots.length;
        this.shots = this.shots.filter((shot) => shot.remaining > 0);
        changed = previousShots !== this.shots.length;

        if (this.currentPhase === 'building') {
            const before = Math.ceil(this.buildElapsed);
            this.buildElapsed = Math.max(0, this.buildElapsed - dt);
            if (Math.ceil(this.buildElapsed) !== before) {
                changed = true;
            }
            if (this.buildElapsed <= 0) {
                changed = this.startWave() || changed;
            }
            return changed;
        }

        changed = this.spawnEnemies(dt) || changed;
        changed = this.moveEnemies(dt) || changed;
        if (this.currentPhase !== 'wave') {
            return true;
        }
        changed = this.fireTowers(dt) || changed;
        this.removeDefeatedEnemies();

        if (
            this.currentPhase === 'wave'
            && this.spawnedCount >= this.waveEnemyCount
            && this.enemies.length === 0
        ) {
            this.finishWave();
            changed = true;
        }
        return changed;
    }

    createObservation(): TowerDefenseObservation {
        return {
            width: WIDTH,
            height: HEIGHT,
            path: PATH.map((point) => ({ ...point })),
            slots: this.slots.map((slot): TowerDefenseSlotState => ({
                id: slot.id,
                x: slot.x,
                y: slot.y,
                tower: slot.tower ? this.copyTower(slot.tower) : null,
            })),
            enemies: this.enemies.map((enemy): TowerDefenseEnemyState => ({ ...enemy })),
            shots: this.shots.map((shot): TowerDefenseShotState => ({ ...shot })),
            gold: this.currentGold,
            lives: this.currentLives,
            score: this.currentScore,
            wave: this.currentWave,
            maxWaves: MAX_WAVES,
            spawned: this.spawnedCount,
            waveSize: this.waveEnemyCount,
            timeToNextWave: this.currentPhase === 'building' ? this.buildElapsed : 0,
            phase: this.currentPhase,
        };
    }

    static buildCost(kind: TowerDefenseTowerKind): number {
        return kind === 'dart' ? 65 : 95;
    }

    static upgradeCost(tower: TowerDefenseTowerState): number {
        const base = tower.kind === 'dart' ? 48 : 68;
        return base * tower.level;
    }

    static towerRange(kind: TowerDefenseTowerKind, level: number): number {
        const base = kind === 'dart' ? 1.9 : 2.2;
        const growth = kind === 'dart' ? 0.28 : 0.32;
        return base + (level - 1) * growth;
    }

    private build(slotId: number, kind: TowerDefenseTowerKind): boolean {
        const slot = this.slots.find((candidate) => candidate.id === slotId);
        const cost = TowerDefenseModel.buildCost(kind);
        if (!slot || slot.tower || this.currentGold < cost) {
            return false;
        }
        slot.tower = {
            kind,
            level: 1,
            cooldown: 0,
        };
        this.currentGold -= cost;
        return true;
    }

    private upgrade(slotId: number): boolean {
        const slot = this.slots.find((candidate) => candidate.id === slotId);
        if (!slot?.tower || slot.tower.level >= MAX_TOWER_LEVEL) {
            return false;
        }
        const cost = TowerDefenseModel.upgradeCost(slot.tower);
        if (this.currentGold < cost) {
            return false;
        }
        this.currentGold -= cost;
        slot.tower.level += 1;
        slot.tower.cooldown = Math.min(slot.tower.cooldown, 0.1);
        return true;
    }

    private startWave(): boolean {
        if (this.currentPhase !== 'building') {
            return false;
        }
        this.currentPhase = 'wave';
        this.spawnedCount = 0;
        this.waveEnemyCount = this.waveSize(this.currentWave);
        this.spawnElapsed = this.spawnInterval();
        this.buildElapsed = 0;
        return true;
    }

    private spawnEnemies(dt: number): boolean {
        if (this.spawnedCount >= this.waveEnemyCount) {
            return false;
        }
        this.spawnElapsed += dt;
        const interval = this.spawnInterval();
        let spawned = false;
        let guard = 0;
        while (
            this.spawnElapsed >= interval
            && this.spawnedCount < this.waveEnemyCount
            && guard < 3
        ) {
            this.spawnElapsed -= interval;
            this.spawnEnemy();
            spawned = true;
            guard += 1;
        }
        return spawned;
    }

    private spawnEnemy(): void {
        const index = this.spawnedCount;
        const heavy = this.currentWave >= 3 && index % 5 === 4;
        const swift = this.currentWave >= 2 && index % 4 === 2;
        const baseHp = 105 + this.currentWave * 40;
        const hp = heavy ? baseHp * 1.9 : swift ? baseHp * 0.88 : baseHp;
        const speed = heavy
            ? 0.62 + this.currentWave * 0.025
            : swift
                ? 1.08 + this.currentWave * 0.035
                : 0.82 + this.currentWave * 0.03;
        this.enemies.push({
            id: this.nextEnemyId,
            progress: 0,
            hp,
            maxHp: hp,
            speed,
            reward: heavy ? 26 : swift ? 16 : 19,
        });
        this.nextEnemyId += 1;
        this.spawnedCount += 1;
    }

    private moveEnemies(dt: number): boolean {
        if (this.enemies.length === 0) {
            return false;
        }
        let changed = false;
        const endProgress = PATH.length - 1;
        const survivors: MutableEnemy[] = [];
        for (const enemy of this.enemies) {
            enemy.progress += enemy.speed * dt;
            if (enemy.progress >= endProgress) {
                this.currentLives = Math.max(0, this.currentLives - 1);
                changed = true;
                if (this.currentLives === 0) {
                    this.currentPhase = 'lost';
                    this.enemies = [];
                    this.shots = [];
                    return true;
                }
                continue;
            }
            survivors.push(enemy);
            changed = true;
        }
        this.enemies = survivors;
        return changed;
    }

    private fireTowers(dt: number): boolean {
        let changed = false;
        for (const slot of this.slots) {
            const tower = slot.tower;
            if (!tower) {
                continue;
            }
            tower.cooldown = Math.max(0, tower.cooldown - dt);
            if (tower.cooldown > 0) {
                continue;
            }
            const range = TowerDefenseModel.towerRange(tower.kind, tower.level);
            const target = this.findTarget(slot, range);
            if (!target) {
                continue;
            }
            tower.cooldown = this.fireInterval(tower);
            const targetPoint = this.positionAt(target.progress);
            this.shots.push({
                fromX: slot.x,
                fromY: slot.y,
                toX: targetPoint.x,
                toY: targetPoint.y,
                kind: tower.kind,
                remaining: SHOT_DURATION,
            });
            if (tower.kind === 'dart') {
                target.hp -= 9 + tower.level * 7;
            } else {
                const damage = 18 + tower.level * 12;
                for (const enemy of this.enemies) {
                    const point = this.positionAt(enemy.progress);
                    const dx = point.x - targetPoint.x;
                    const dy = point.y - targetPoint.y;
                    if (dx * dx + dy * dy <= 0.82 * 0.82) {
                        enemy.hp -= damage;
                    }
                }
            }
            changed = true;
        }
        return changed;
    }

    private findTarget(slot: TowerDefensePoint, range: number): MutableEnemy | null {
        let target: MutableEnemy | null = null;
        const rangeSquared = range * range;
        for (const enemy of this.enemies) {
            if (enemy.hp <= 0) {
                continue;
            }
            const point = this.positionAt(enemy.progress);
            const dx = point.x - slot.x;
            const dy = point.y - slot.y;
            if (dx * dx + dy * dy > rangeSquared) {
                continue;
            }
            if (!target || enemy.progress > target.progress) {
                target = enemy;
            }
        }
        return target;
    }

    private removeDefeatedEnemies(): void {
        const survivors: MutableEnemy[] = [];
        for (const enemy of this.enemies) {
            if (enemy.hp > 0) {
                survivors.push(enemy);
                continue;
            }
            this.currentGold += enemy.reward;
            this.currentScore += enemy.reward * 10;
        }
        this.enemies = survivors;
    }

    private finishWave(): void {
        if (this.currentWave >= MAX_WAVES) {
            this.currentPhase = 'won';
            this.shots = [];
            return;
        }
        this.currentWave += 1;
        this.currentPhase = 'building';
        this.buildElapsed = BUILD_COUNTDOWN;
        this.spawnElapsed = 0;
        this.spawnedCount = 0;
        this.waveEnemyCount = this.waveSize(this.currentWave);
        this.currentGold += 35 + this.currentWave * 5;
    }

    private waveSize(wave: number): number {
        return 6 + wave * 2;
    }

    private spawnInterval(): number {
        return Math.max(0.38, 0.82 - this.currentWave * 0.045);
    }

    private fireInterval(tower: MutableTower): number {
        const base = tower.kind === 'dart' ? 0.68 : 1.32;
        const reduction = tower.kind === 'dart' ? 0.09 : 0.14;
        const minimum = tower.kind === 'dart' ? 0.42 : 0.9;
        return Math.max(minimum, base - (tower.level - 1) * reduction);
    }

    private positionAt(progress: number): TowerDefensePoint {
        const maxIndex = PATH.length - 1;
        const clamped = Math.max(0, Math.min(maxIndex, progress));
        const index = Math.min(maxIndex - 1, Math.floor(clamped));
        const local = clamped - index;
        const first = PATH[index];
        const second = PATH[Math.min(maxIndex, index + 1)];
        return {
            x: first.x + (second.x - first.x) * local,
            y: first.y + (second.y - first.y) * local,
        };
    }

    private copyTower(tower: MutableTower): TowerDefenseTowerState {
        return {
            kind: tower.kind,
            level: tower.level,
            cooldown: tower.cooldown,
        };
    }
}
