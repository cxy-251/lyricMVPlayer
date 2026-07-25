/**
 * Cursor Space domain boundary used by the ViewModel.
 *
 * The current gameplay implementation is composed internally as:
 * Combat → Dynamic Wall → Closed Wall → Aggressive Enemy → Fleet Handling.
 * Those implementation layers remain hidden behind the public CursorSpaceModel.
 */
export { CursorSpaceAutopilot } from '../CursorSpaceAutopilot';
export { CursorSpaceModel } from '../CursorSpaceModel';
