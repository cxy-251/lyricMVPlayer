import type { Node } from 'cc';
import { ViewModelGameModule } from '../../../templates/ViewModelGameModule';
import { MazeChaseView } from './MazeChaseView';
import { MazeChaseViewModel } from './MazeChaseViewModel';
import type { MazeChaseViewState } from './MazeChaseTypes';

export class MazeChaseModule extends ViewModelGameModule<
    MazeChaseViewState,
    MazeChaseViewModel,
    MazeChaseView
> {
    protected readonly rootName = 'MazeChaseModuleRoot';

    protected createViewModel(): MazeChaseViewModel {
        return new MazeChaseViewModel();
    }

    protected createView(root: Node, viewModel: MazeChaseViewModel): MazeChaseView {
        return new MazeChaseView(root, {
            setDirection: (direction) => {
                viewModel.setDirectionFromHuman(direction);
                this.renderCurrentState();
            },
            restart: () => {
                viewModel.restartFromHuman();
                this.renderCurrentState();
            },
        });
    }
}
