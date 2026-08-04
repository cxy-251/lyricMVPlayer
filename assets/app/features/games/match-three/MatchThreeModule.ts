import type { Node } from 'cc';
import { ViewModelGameModule } from '../../../templates/ViewModelGameModule';
import { MatchThreeView } from './MatchThreeView';
import { MatchThreeViewModel } from './MatchThreeViewModel';
import type { MatchThreeViewState } from './MatchThreeTypes';

export class MatchThreeModule extends ViewModelGameModule<
    MatchThreeViewState,
    MatchThreeViewModel,
    MatchThreeView
> {
    protected readonly rootName = 'MatchThreeModuleRoot';

    protected createViewModel(): MatchThreeViewModel {
        return new MatchThreeViewModel();
    }

    protected createView(root: Node, viewModel: MatchThreeViewModel): MatchThreeView {
        return new MatchThreeView(root, {
            selectCell: (row, column) => {
                viewModel.selectCellFromHuman(row, column);
                this.renderCurrentState();
            },
            swapCell: (row, column, direction) => {
                viewModel.swapCellFromHuman(row, column, direction);
                this.renderCurrentState();
            },
            moveFocus: (rowDelta, columnDelta) => {
                viewModel.moveFocusFromHuman(rowDelta, columnDelta);
                this.renderCurrentState();
            },
            activateFocused: () => {
                viewModel.activateFocusedFromHuman();
                this.renderCurrentState();
            },
            restart: () => {
                viewModel.restartFromHuman();
                this.renderCurrentState();
            },
        });
    }
}
