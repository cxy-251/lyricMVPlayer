import { CursorSpaceAutopilot } from './ai/CursorSpaceAutopilot';
import { cursorSpaceEscortWorldPosition } from './domain/CursorSpaceFormation';
import {
    CursorSpaceModel as CursorSpaceDomainModel,
    type CursorSpaceWall,
} from './domain/CursorSpaceModel';
import type { CursorSpaceBounds } from './domain/CursorSpaceTypes';

export interface CursorSpaceEscortPoseTarget {
    active: boolean;
    x: number;
    y: number;
    rotation: number;
}

/**
 * Feature boundary exposed to the ViewModel. The composed gameplay model stays
 * inside domain/, including its legacy escort-rotation adapter.
 */
export class CursorSpaceModel extends CursorSpaceDomainModel {
    writeEscortPose(index: number, target: CursorSpaceEscortPoseTarget): void {
        const escortIndex = Math.floor(index);
        const player = this.player;
        if (
            !player.alive
            || escortIndex < 0
            || escortIndex >= player.escortCount
        ) {
            target.active = false;
            target.x = player.position.x;
            target.y = player.position.y;
            target.rotation = player.rotation;
            return;
        }

        const position = cursorSpaceEscortWorldPosition(player, escortIndex);
        target.active = true;
        target.x = position.x;
        target.y = position.y;
        target.rotation = player.rotation;
    }
}

export { CursorSpaceAutopilot };
export type { CursorSpaceBounds, CursorSpaceWall };
