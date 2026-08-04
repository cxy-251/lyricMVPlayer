import type { Node } from 'cc';
import { ViewModelGameModule } from '../../../templates/ViewModelGameModule';
import { ConnectFourView } from './ConnectFourView';
import { ConnectFourViewModel } from './ConnectFourViewModel';
import type { ConnectFourViewState } from './ConnectFourTypes';

export class ConnectFourModule extends ViewModelGameModule<
    ConnectFourViewState,
    ConnectFourViewModel,
    ConnectFourView
> {
    protected readonly rootName = 'ConnectFourModuleRoot';

    protected createViewModel(): ConnectFourViewModel {
        return new ConnectFourViewModel();
    }

    protected createView(root: Node, viewModel: ConnectFourViewModel): ConnectFourView {
        return new ConnectFourView(root, {
            drop: (column) => {
                viewModel.dropFromHuman(column);
                this.renderCurrentState();
            },
            moveFocus: (offset) => {
                viewModel.moveFocusFromHuman(offset);
                this.renderCurrentState();
            },
            dropFocused: () => {
                viewModel.dropFocusedFromHuman();
                this.renderCurrentState();
            },
            restart: () => {
                viewModel.restartFromHuman();
                this.renderCurrentState();
            },
        });
    }
}
