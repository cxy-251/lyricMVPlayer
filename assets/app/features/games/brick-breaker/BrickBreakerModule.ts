import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { BrickBreakerView } from './BrickBreakerView';
import { BrickBreakerViewModel } from './BrickBreakerViewModel';

export class BrickBreakerModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'BrickBreakerModuleRoot';

    private viewModel: BrickBreakerViewModel | null = null;
    private view: BrickBreakerView | null = null;

    protected onMount(): void {
        this.viewModel = new BrickBreakerViewModel();
        const viewModel = this.viewModel;
        this.view = new BrickBreakerView(this.requireRoot(), {
            humanAxisChanged: (axis) => viewModel.humanAxisChanged(axis),
            humanTargetChanged: (normalizedX) => viewModel.humanTargetChanged(normalizedX),
            humanPointerReleased: () => viewModel.humanPointerReleased(),
            launch: () => {
                viewModel.launchFromHuman();
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
        const viewModel = this.viewModel;
        const view = this.view;
        if (!viewModel || !view) {
            return;
        }
        view.render(viewModel.createViewState());
    }

    private requireViewModel(): BrickBreakerViewModel {
        if (!this.viewModel) {
            throw new Error('Brick Breaker ViewModel is unavailable');
        }
        return this.viewModel;
    }

    private requireView(): BrickBreakerView {
        if (!this.view) {
            throw new Error('Brick Breaker View is unavailable');
        }
        return this.view;
    }
}
