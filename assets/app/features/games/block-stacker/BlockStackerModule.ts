import type { Node } from 'cc';
import { ViewModelGameModule } from '../../../templates/ViewModelGameModule';
import { BlockStackerView } from './BlockStackerView';
import { BlockStackerViewModel } from './BlockStackerViewModel';
import type { BlockStackerViewState } from './BlockStackerTypes';

export class BlockStackerModule extends ViewModelGameModule<
    BlockStackerViewState,
    BlockStackerViewModel,
    BlockStackerView
> {
    protected readonly rootName = 'BlockStackerModuleRoot';

    protected createViewModel(): BlockStackerViewModel {
        return new BlockStackerViewModel();
    }

    protected createView(
        root: Node,
        viewModel: BlockStackerViewModel,
    ): BlockStackerView {
        return new BlockStackerView(root, {
            drop: () => {
                viewModel.dropFromHuman();
                this.renderCurrentState();
            },
            restart: () => {
                viewModel.restartFromHuman();
                this.renderCurrentState();
            },
        });
    }
}
