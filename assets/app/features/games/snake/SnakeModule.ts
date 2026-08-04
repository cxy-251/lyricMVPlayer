import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { SnakeView } from './SnakeView';
import { SnakeViewModel } from './SnakeViewModel';

export class SnakeModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'SnakeModuleRoot';

    private viewModel: SnakeViewModel | null = null;
    private view: SnakeView | null = null;

    protected onMount(): void {
        this.viewModel = new SnakeViewModel();
        const viewModel = this.viewModel;
        this.view = new SnakeView(this.requireRoot(), {
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
        this.requireView().layout(viewport);
        this.renderCurrentState();
    }

    private renderCurrentState(): void {
        if (this.viewModel && this.view) {
            this.view.render(this.viewModel.createViewState());
        }
    }

    private requireViewModel(): SnakeViewModel {
        if (!this.viewModel) {
            throw new Error('Snake ViewModel is unavailable');
        }
        return this.viewModel;
    }

    private requireView(): SnakeView {
        if (!this.view) {
            throw new Error('Snake View is unavailable');
        }
        return this.view;
    }
}
