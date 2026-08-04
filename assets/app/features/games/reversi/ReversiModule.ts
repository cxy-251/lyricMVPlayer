import type { Node } from 'cc';
import { ViewModelGameModule } from '../../../templates/ViewModelGameModule';
import { ReversiView } from './ReversiView';
import { ReversiViewModel } from './ReversiViewModel';
import type { ReversiViewState } from './ReversiTypes';

export class ReversiModule extends ViewModelGameModule<
    ReversiViewState,
    ReversiViewModel,
    ReversiView
> {
    protected readonly rootName = 'ReversiModuleRoot';

    protected createViewModel(): ReversiViewModel {
        return new ReversiViewModel();
    }

    protected createView(root: Node, viewModel: ReversiViewModel): ReversiView {
        return new ReversiView(root, {
            place: (row, column) => {
                viewModel.placeFromHuman(row, column);
                this.renderCurrentState();
            },
            moveFocus: (rowOffset, columnOffset) => {
                viewModel.moveFocusFromHuman(rowOffset, columnOffset);
                this.renderCurrentState();
            },
            placeFocused: () => {
                viewModel.placeFocusedFromHuman();
                this.renderCurrentState();
            },
            restart: () => {
                viewModel.restartFromHuman();
                this.renderCurrentState();
            },
        });
    }
}
