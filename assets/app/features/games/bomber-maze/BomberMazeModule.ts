import type { Node } from 'cc';
import { ViewModelGameModule } from '../../../templates/ViewModelGameModule';
import { BomberMazeView } from './BomberMazeView';
import { BomberMazeViewModel } from './BomberMazeViewModel';
import type { BomberMazeViewState } from './BomberMazeTypes';

export class BomberMazeModule extends ViewModelGameModule<
    BomberMazeViewState,
    BomberMazeViewModel,
    BomberMazeView
> {
    protected readonly rootName = 'BomberMazeModuleRoot';

    protected createViewModel(): BomberMazeViewModel {
        return new BomberMazeViewModel();
    }

    protected createView(root: Node, viewModel: BomberMazeViewModel): BomberMazeView {
        return new BomberMazeView(root, {
            move: (direction) => {
                viewModel.moveFromHuman(direction);
                this.renderCurrentState();
            },
            placeBomb: () => {
                viewModel.placeBombFromHuman();
                this.renderCurrentState();
            },
            restart: () => {
                viewModel.restartFromHuman();
                this.renderCurrentState();
            },
        });
    }
}
