export type BlockStackerPhase = 'playing' | 'paused' | 'lost';
export type BlockStackerControllerMode = 'human' | 'autopilot';

export interface BlockStackerBlockState {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly level: number;
    readonly perfect: boolean;
}

export interface BlockStackerMovingBlockState {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly direction: -1 | 1;
    readonly speed: number;
    readonly level: number;
}

export interface BlockStackerFragmentState {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly rotation: number;
}

export interface BlockStackerDropResult {
    readonly changed: boolean;
    readonly lost: boolean;
    readonly perfect: boolean;
}

export interface BlockStackerObservation {
    readonly phase: 'playing' | 'lost';
    readonly movingX: number;
    readonly movingWidth: number;
    readonly direction: -1 | 1;
    readonly speed: number;
    readonly supportX: number;
    readonly supportWidth: number;
    readonly level: number;
}

export interface BlockStackerPlayfieldLayout {
    readonly left: number;
    readonly bottom: number;
    readonly width: number;
    readonly height: number;
}

export interface BlockStackerViewState {
    readonly phase: BlockStackerPhase;
    readonly controller: BlockStackerControllerMode;
    readonly blocks: readonly BlockStackerBlockState[];
    readonly movingBlock: BlockStackerMovingBlockState | null;
    readonly fragments: readonly BlockStackerFragmentState[];
    readonly cameraY: number;
    readonly worldHalfWidth: number;
    readonly blockHeight: number;
    readonly status: string;
    readonly scoreText: string;
    readonly hint: string;
}
