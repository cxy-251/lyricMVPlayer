import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { BomberMazeView } from './BomberMazeView';
import { BomberMazeViewModel } from './BomberMazeViewModel';

export class BomberMazeModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'BomberMazeModuleRoot';
    private viewModel: BomberMazeViewModel | null = null;
    private view: BomberMazeView | null = null;

    protected onMount(): void {
        this.viewModel = new BomberMazeViewModel();
        const viewModel = this.viewModel;
        this.view = new BomberMazeView(this.requireRoot(), {
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
        this.viewModel?.reset();
        this.renderCurrentState();
    }

    protected render(viewport: ViewportSnapshot): void {
        this.view?.layout(viewport);
        this.renderCurrentState();
    }

    private renderCurrentState(): void {
        if (this.view && this.viewModel) {
            this.view.render(this.viewModel.createViewState());
        }
    }
}
