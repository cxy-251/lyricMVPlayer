import type { Node } from 'cc';
import { ViewModelGameModule } from '../../../templates/ViewModelGameModule';
import { Game2048View } from './Game2048View';
import { Game2048ViewModel } from './Game2048ViewModel';
import type { Game2048ViewState } from './Game2048Types';

export class Game2048Module extends ViewModelGameModule<
    Game2048ViewState,
    Game2048ViewModel,
    Game2048View
> {
    protected readonly rootName = 'Game2048ModuleRoot';

    protected createViewModel(): Game2048ViewModel {
        return new Game2048ViewModel();
    }

    protected createView(root: Node, viewModel: Game2048ViewModel): Game2048View {
        return new Game2048View(root, {
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
