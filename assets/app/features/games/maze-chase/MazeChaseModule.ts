import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { MazeChaseView } from './MazeChaseView';
import { MazeChaseViewModel } from './MazeChaseViewModel';

export class MazeChaseModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'MazeChaseModuleRoot';
    private viewModel: MazeChaseViewModel | null = null;
    private view: MazeChaseView | null = null;

    protected onMount(): void {
        this.viewModel = new MazeChaseViewModel();
        const viewModel = this.viewModel;
        this.view = new MazeChaseView(this.requireRoot(), {
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
