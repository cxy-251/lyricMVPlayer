export type TowerDefenseTowerKind = 'dart' | 'cannon';
export type TowerDefensePhase = 'building' | 'wave' | 'won' | 'lost';
export type TowerDefenseControllerMode = 'human' | 'autopilot';
export type TowerDefenseDirection = 'up' | 'down' | 'left' | 'right';
export type TowerDefenseWaveTrait = 'balanced' | 'swarm' | 'armored' | 'rush';

export interface TowerDefensePoint {
    readonly x: number;
    readonly y: number;
}

export interface TowerDefenseTowerState {
    readonly kind: TowerDefenseTowerKind;
    readonly level: number;
    readonly cooldown: number;
}

export interface TowerDefenseSlotState extends TowerDefensePoint {
    readonly id: number;
    readonly tower: TowerDefenseTowerState | null;
}

export interface TowerDefenseEnemyState {
    readonly id: number;
    readonly progress: number;
    readonly hp: number;
    readonly maxHp: number;
    readonly speed: number;
    readonly reward: number;
}

export interface TowerDefenseShotState {
    readonly fromX: number;
    readonly fromY: number;
    readonly toX: number;
    readonly toY: number;
    readonly kind: TowerDefenseTowerKind;
    readonly remaining: number;
}

export type TowerDefenseAction =
    | {
        readonly kind: 'build';
        readonly slotId: number;
        readonly towerKind: TowerDefenseTowerKind;
    }
    | {
        readonly kind: 'upgrade';
        readonly slotId: number;
    }
    | {
        readonly kind: 'start-wave';
    };

export interface TowerDefenseObservation {
    readonly width: number;
    readonly height: number;
    readonly routeName: string;
    readonly waveTrait: TowerDefenseWaveTrait;
    readonly perfectBonus: number;
    readonly path: readonly TowerDefensePoint[];
    readonly slots: readonly TowerDefenseSlotState[];
    readonly enemies: readonly TowerDefenseEnemyState[];
    readonly shots: readonly TowerDefenseShotState[];
    readonly gold: number;
    readonly lives: number;
    readonly score: number;
    readonly wave: number;
    readonly maxWaves: number;
    readonly spawned: number;
    readonly waveSize: number;
    readonly timeToNextWave: number;
    readonly phase: TowerDefensePhase;
}

export interface TowerDefenseViewState extends Omit<TowerDefenseObservation, 'phase'> {
    readonly phase: TowerDefensePhase | 'paused';
    readonly controller: TowerDefenseControllerMode;
    readonly selectedSlotId: number;
    readonly selectedKind: TowerDefenseTowerKind;
    readonly status: string;
    readonly stats: string;
    readonly hint: string;
}

export interface TowerDefenseViewActions {
    readonly selectSlot: (slotId: number) => void;
    readonly moveSelection: (direction: TowerDefenseDirection) => void;
    readonly selectKind: (kind: TowerDefenseTowerKind) => void;
    readonly buildSelected: () => void;
    readonly upgradeSelected: () => void;
    readonly startWave: () => void;
    readonly restart: () => void;
}

export interface TowerDefenseBoardLayout {
    readonly left: number;
    readonly bottom: number;
    readonly width: number;
    readonly height: number;
    readonly cellSize: number;
}
