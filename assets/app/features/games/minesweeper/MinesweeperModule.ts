import type { Node } from 'cc';
import { ViewModelGameModule } from '../../../templates/ViewModelGameModule';
import { MinesweeperView } from './MinesweeperView';
import { MinesweeperViewModel } from './MinesweeperViewModel';
import type { MinesweeperViewState } from './MinesweeperTypes';

export class MinesweeperModule extends ViewModelGameModule<
    MinesweeperViewState,
    MinesweeperViewModel,
    MinesweeperView
> {
    protected readonly rootName = 'MinesweeperModuleRoot';

    protected createViewModel(): MinesweeperViewModel {
        return new MinesweeperViewModel();
    }

    protected createView(root: Node, viewModel: MinesweeperViewModel): MinesweeperView {
        return new MinesweeperView(
            root,
            viewModel.rows,
            viewModel.columns,
            {
                primaryCell: (row, column) => {
                    viewModel.primaryCell(row, column);
                    this.renderCurrentState();
                },
                secondaryCell: (row, column) => {
                    viewModel.secondaryCell(row, column);
                    this.renderCurrentState();
                },
                primaryFocused: () => {
                    viewModel.primaryFocused();
                    this.renderCurrentState();
                },
                secondaryFocused: () => {
                    viewModel.secondaryFocused();
                    this.renderCurrentState();
                },
                moveFocus: (rowOffset, columnOffset) => {
                    viewModel.moveFocus(rowOffset, columnOffset);
                    this.renderCurrentState();
                },
                restart: () => {
                    viewModel.restartFromHuman();
                    this.renderCurrentState();
                },
                toggleFlagMode: () => {
                    viewModel.toggleFlagMode();
                    this.renderCurrentState();
                },
            },
        );
    }
}
