// Keep one active gameplay facade at the public module boundary. The aggressive
// model already caps survival threat below the combat fire-suppression threshold,
// so the former Relentless facade duplicated the same runtime method patch.
export {
    CursorSpaceModel,
    type CursorSpaceWall,
} from './CursorSpaceAggressiveEnemyModel';
