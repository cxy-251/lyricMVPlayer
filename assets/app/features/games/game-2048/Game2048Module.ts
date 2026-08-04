import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { Game2048View } from './Game2048View';
import { Game2048ViewModel } from './Game2048ViewModel';

export class Game2048Module extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'Game2048ModuleRoot';

    private viewModel: Game2048ViewModel | null = null;
    private view: Game2048View | null = null;

    protected onMount(): void {
        this.viewModel = new Game2048ViewModel();
        const viewModel = this.viewModel;
        this.view = new Game2048View(this.requireRoot(), {
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

    private requireViewModel(): Game2048ViewModel {
        if (!this.viewModel) {
            throw new Error('2048 ViewModel is unavailable');
        }
        return this.viewModel;
    }

    private requireView(): Game2048View {
        if (!this.view) {
            throw new Error('2048 View is unavailable');
        }
        return this.view;
    }
}
