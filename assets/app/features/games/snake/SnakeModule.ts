import type { Node } from 'cc';
import { ViewModelGameModule } from '../../../templates/ViewModelGameModule';
import { SnakeView } from './SnakeView';
import { SnakeViewModel } from './SnakeViewModel';
import type { SnakeViewState } from './SnakeTypes';

export class SnakeModule extends ViewModelGameModule<
    SnakeViewState,
    SnakeViewModel,
    SnakeView
> {
    protected readonly rootName = 'SnakeModuleRoot';

    protected createViewModel(): SnakeViewModel {
        return new SnakeViewModel();
    }

    protected createView(root: Node, viewModel: SnakeViewModel): SnakeView {
        return new SnakeView(root, {
            direction: (direction) => {
                viewModel.directionFromHuman(direction);
                this.renderCurrentState();
            },
            restart: () => {
                viewModel.restartFromHuman();
                this.renderCurrentState();
            },
        });
    }
}
