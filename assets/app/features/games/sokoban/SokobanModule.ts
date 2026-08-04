import type { Node } from 'cc';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ViewModelGameModule } from '../../../templates/ViewModelGameModule';
import { SokobanView } from './SokobanView';
import { SokobanViewModel } from './SokobanViewModel';
import type { SokobanViewState } from './SokobanTypes';

export class SokobanModule extends ViewModelGameModule<
    SokobanViewState,
    SokobanViewModel,
    SokobanView
> {
    protected readonly rootName = 'SokobanModuleRoot';

    protected createViewModel(): SokobanViewModel {
        return new SokobanViewModel();
    }

    protected createView(root: Node, viewModel: SokobanViewModel): SokobanView {
        return new SokobanView(root, {
            move: (direction) => {
                viewModel.moveFromHuman(direction);
                this.renderCurrentState();
            },
            undo: () => {
                viewModel.undoFromHuman();
                this.renderCurrentState();
            },
            restart: () => {
                viewModel.restartFromHuman();
                this.renderCurrentState();
            },
            previousLevel: () => {
                viewModel.previousLevelFromHuman();
                this.renderCurrentState();
            },
            nextLevel: () => {
                viewModel.nextLevelFromHuman();
                this.renderCurrentState();
            },
        });
    }

    protected layoutGameView(
        viewport: ViewportSnapshot,
        viewModel: SokobanViewModel,
        view: SokobanView,
    ): void {
        view.layout(viewport, viewModel.width, viewModel.height);
    }
}
