export type Game2048Direction = 'up' | 'down' | 'left' | 'right';
export type Game2048Phase = 'playing' | 'paused' | 'lost';
export type Game2048ControllerMode = 'human' | 'autopilot';
export type Game2048RuleSet = 'classic' | 'chain' | 'corner';

export interface Game2048Observation {
    readonly board: readonly (readonly number[])[];
    readonly phase: 'playing' | 'lost';
}

export interface Game2048ViewState extends Omit<Game2048Observation, 'phase'> {
    readonly phase: Game2048Phase;
    readonly controller: Game2048ControllerMode;
    readonly score: number;
    readonly bestScore: number;
    readonly maximumTile: number;
    readonly chain: number;
    readonly bestChain: number;
    readonly targetTile: number;
    readonly ruleSet: Game2048RuleSet;
    readonly eventText: string;
    readonly status: string;
    readonly hint: string;
}

export interface Game2048ViewActions {
    move(direction: Game2048Direction): void;
    restart(): void;
}
