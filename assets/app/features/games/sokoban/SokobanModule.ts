import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { SokobanView } from './SokobanView';
import { SokobanViewModel } from './SokobanViewModel';

export class SokobanModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'SokobanModuleRoot';

    private viewModel: SokobanViewModel | null = null;
    private view: SokobanView | null = null;

    protected onMount(): void {
        this.viewModel = new SokobanViewModel();
        const viewModel = this.viewModel;
        this.view = new SokobanView(this.requireRoot(), {
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

    protected onUnmount(): void {
        this.view?.destroy();
        this.view = null;
        this.viewModel?.dispose();
        this.viewModel = null;
    }

    update(dt: number): void {
        if (this.viewModel?.update(dt)) {
            this.renderCurrentState();
        }
    }

    pause(): void {
        this.viewModel?.pause();
        this.renderCurrentState();
    }

    resume(): void {
        this.viewModel?.resume();
        this.renderCurrentState();
    }

    reset(): void {
        this.requireViewModel().reset();
        this.renderCurrentState();
    }

    protected render(viewport: ViewportSnapshot): void {
        const viewModel = this.requireViewModel();
        this.requireView().layout(
            viewport,
            viewModel.width,
            viewModel.height,
        );
        this.renderCurrentState();
    }

    private renderCurrentState(): void {
        const viewModel = this.viewModel;
        const view = this.view;
        if (!viewModel || !view) {
            return;
        }
        view.render(viewModel.createViewState());
    }

    private requireViewModel(): SokobanViewModel {
        if (!this.viewModel) {
            throw new Error('Sokoban ViewModel is unavailable');
        }
        return this.viewModel;
    }

    private requireView(): SokobanView {
        if (!this.view) {
            throw new Error('Sokoban View is unavailable');
        }
        return this.view;
    }
}
