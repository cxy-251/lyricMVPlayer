import type { Node } from 'cc';
import { ViewModelGameModule } from '../../../templates/ViewModelGameModule';
import { TetrisView } from './TetrisView';
import { TetrisViewModel } from './TetrisViewModel';
import type { TetrisViewState } from './TetrisTypes';

export class TetrisModule extends ViewModelGameModule<
    TetrisViewState,
    TetrisViewModel,
    TetrisView
> {
    protected readonly rootName = 'TetrisModuleRoot';

    protected createViewModel(): TetrisViewModel {
        return new TetrisViewModel();
    }

    protected createView(root: Node, viewModel: TetrisViewModel): TetrisView {
        return new TetrisView(root, {
            moveOnce: (direction) => {
                viewModel.moveOnceFromHuman(direction);
                this.renderCurrentState();
            },
            setHorizontal: (direction) => {
                viewModel.setHorizontalFromHuman(direction);
                this.renderCurrentState();
            },
            setSoftDrop: (active) => {
                viewModel.setSoftDropFromHuman(active);
                this.renderCurrentState();
            },
            softDropOnce: () => {
                viewModel.softDropOnceFromHuman();
                this.renderCurrentState();
            },
            rotateClockwise: () => {
                viewModel.rotateClockwiseFromHuman();
                this.renderCurrentState();
            },
            rotateCounterClockwise: () => {
                viewModel.rotateCounterClockwiseFromHuman();
                this.renderCurrentState();
            },
            hardDrop: () => {
                viewModel.hardDropFromHuman();
                this.renderCurrentState();
            },
            hold: () => {
                viewModel.holdFromHuman();
                this.renderCurrentState();
            },
            restart: () => {
                viewModel.restartFromHuman();
                this.renderCurrentState();
            },
        });
    }
}
