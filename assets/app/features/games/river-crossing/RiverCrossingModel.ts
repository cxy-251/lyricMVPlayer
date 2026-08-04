import type {
    RiverCrossingDirection,
    RiverCrossingObservation,
    RiverCrossingPhase,
    RiverLaneKind,
    RiverLaneState,
} from './RiverCrossingTypes';

const WIDTH = 11;
const HEIGHT = 12;
const TARGET_CROSSINGS = 5;

interface MutableObject {
    x: number;
    width: number;
}

interface MutableLane {
    row: number;
    kind: RiverLaneKind;
    speed: number;
    objects: MutableObject[];
}

const LANE_DEFINITIONS: ReadonlyArray<{
    kind: RiverLaneKind;
    speed?: number;
    width?: number;
    positions?: readonly number[];
}> = [
    { kind: 'safe' },
    { kind: 'road', speed: 1.8, width: 1.25, positions: [0, 4, 8] },
    { kind: 'road', speed: -2.25, width: 1.1, positions: [1.5, 5.5, 9.5] },
    { kind: 'road', speed: 1.45, width: 1.75, positions: [0.5, 5, 9.5] },
    { kind: 'road', speed: -2.65, width: 0.95, positions: [0, 3.5, 7, 10.5] },
    { kind: 'safe' },
    { kind: 'river', speed: 1.15, width: 2.5, positions: [0, 4.5, 9] },
    { kind: 'river', speed: -1.45, width: 3.1, positions: [1.5, 7, 11.5] },
    { kind: 'river', speed: 1.75, width: 1.9, positions: [0, 3.5, 7, 10.5] },
    { kind: 'river', speed: -1.05, width: 3.4, positions: [0.5, 6, 11.5] },
    { kind: 'safe' },
    { kind: 'goal' },
];

export class RiverCrossingModel {
    readonly width = WIDTH;
    readonly height = HEIGHT;
    readonly targetCrossings = TARGET_CROSSINGS;

    private lanes: MutableLane[] = [];
    private player = { x: Math.floor(WIDTH / 2), y: 0 };
    private currentPhase: RiverCrossingPhase = 'playing';
    private currentScore = 0;
    private currentLives = 3;
    private completedCrossings = 0;

    constructor() {
        this.reset();
    }

    get phase(): RiverCrossingPhase {
        return this.currentPhase;
    }

    get score(): number {
        return this.currentScore;
    }

    get lives(): number {
        return this.currentLives;
    }

    get crossings(): number {
        return this.completedCrossings;
    }

    reset(): void {
        this.lanes = LANE_DEFINITIONS.map((definition, row) => ({
            row,
            kind: definition.kind,
            speed: definition.speed ?? 0,
            objects: (definition.positions ?? []).map((x) => ({
                x,
                width: definition.width ?? 1,
            })),
        }));
        this.currentPhase = 'playing';
        this.currentScore = 0;
        this.currentLives = 3;
        this.completedCrossings = 0;
        this.resetPlayer();
    }

    move(direction: RiverCrossingDirection): boolean {
        if (this.currentPhase !== 'playing') {
            return false;
        }
        const next = { ...this.player };
        if (direction === 'up') {
            next.y += 1;
        } else if (direction === 'down') {
            next.y -= 1;
        } else if (direction === 'left') {
            next.x -= 1;
        } else {
            next.x += 1;
        }
        if (next.y < 0 || next.y >= HEIGHT || next.x < 0 || next.x > WIDTH - 1) {
            return false;
        }
        this.player = next;
        this.currentScore += direction === 'up' ? 2 : 1;
        this.resolveCurrentLane();
        return true;
    }

    step(deltaTime: number): boolean {
        if (this.currentPhase !== 'playing') {
            return false;
        }
        const dt = Math.max(0, Math.min(0.1, deltaTime));
        for (const lane of this.lanes) {
            if (lane.speed === 0) {
                continue;
            }
            for (const object of lane.objects) {
                object.x = this.wrapX(object.x + lane.speed * dt, object.width);
            }
        }
        const lane = this.lanes[this.player.y];
        if (lane.kind === 'river') {
            const support = this.supportAt(lane, this.player.x);
            if (support) {
                this.player.x += lane.speed * dt;
            }
        }
        this.resolveCurrentLane();
        return true;
    }

    createObservation(): RiverCrossingObservation {
        return {
            width: WIDTH,
            height: HEIGHT,
            player: { ...this.player },
            lanes: this.lanes.map((lane): RiverLaneState => ({
                row: lane.row,
                kind: lane.kind,
                speed: lane.speed,
                objects: lane.objects.map((object) => ({ ...object })),
            })),
            phase: this.currentPhase,
        };
    }

    private resolveCurrentLane(): void {
        if (this.currentPhase !== 'playing') {
            return;
        }
        if (this.player.x < -0.35 || this.player.x > WIDTH - 0.65) {
            this.loseLife();
            return;
        }
        const lane = this.lanes[this.player.y];
        if (lane.kind === 'road') {
            if (this.supportAt(lane, this.player.x)) {
                this.loseLife();
            }
        } else if (lane.kind === 'river') {
            if (!this.supportAt(lane, this.player.x)) {
                this.loseLife();
            }
        } else if (lane.kind === 'goal') {
            this.completedCrossings += 1;
            this.currentScore += 250;
            if (this.completedCrossings >= TARGET_CROSSINGS) {
                this.currentPhase = 'won';
            } else {
                this.resetPlayer();
            }
        }
    }

    private supportAt(lane: MutableLane, x: number): MutableObject | null {
        return lane.objects.find((object) => (
            Math.abs(object.x - x) <= object.width / 2 + 0.32
        )) ?? null;
    }

    private loseLife(): void {
        this.currentLives -= 1;
        if (this.currentLives <= 0) {
            this.currentPhase = 'lost';
        } else {
            this.resetPlayer();
        }
    }

    private resetPlayer(): void {
        this.player = { x: Math.floor(WIDTH / 2), y: 0 };
    }

    private wrapX(x: number, objectWidth: number): number {
        const minimum = -objectWidth / 2 - 1;
        const maximum = WIDTH - 1 + objectWidth / 2 + 1;
        const span = maximum - minimum;
        let value = x;
        while (value > maximum) {
            value -= span;
        }
        while (value < minimum) {
            value += span;
        }
        return value;
    }
}
