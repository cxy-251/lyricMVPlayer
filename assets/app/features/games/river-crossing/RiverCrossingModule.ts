import type { Node } from 'cc';
import { ViewModelGameModule } from '../../../templates/ViewModelGameModule';
import { RiverCrossingView } from './RiverCrossingView';
import { RiverCrossingViewModel } from './RiverCrossingViewModel';
import type { RiverCrossingViewState } from './RiverCrossingTypes';

export class RiverCrossingModule extends ViewModelGameModule<
    RiverCrossingViewState,
    RiverCrossingViewModel,
    RiverCrossingView
> {
    protected readonly rootName = 'RiverCrossingModuleRoot';

    protected createViewModel(): RiverCrossingViewModel {
        return new RiverCrossingViewModel();
    }

    protected createView(root: Node, viewModel: RiverCrossingViewModel): RiverCrossingView {
        return new RiverCrossingView(root, {
            move: (direction) => {
                viewModel.moveFromHuman(direction);
                this.renderCurrentState();
            },
            restart: () => {
                viewModel.restartFromHuman();
                this.renderCurrentState();
            },
        });
    }
}
