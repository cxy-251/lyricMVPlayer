import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { DoublePendulumView } from './DoublePendulumView';
import {
    DOUBLE_PENDULUM_PARAMETER_SCHEMA,
    DoublePendulumViewModel,
} from './DoublePendulumViewModel';

const MINIMUM_RENDER_INTERVAL_MS = 14;

export class DoublePendulumModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'DoublePendulumModuleRoot';

    private viewModel: DoublePendulumViewModel | null = null;
    private view: DoublePendulumView | null = null;
    private lastRenderAt = 0;

    protected onMount(): void {
        const context = this.requireContext();
        this.viewModel = new DoublePendulumViewModel(
            context.storage,
            {
                stateChanged: () => this.renderCurrentState(true),
                reportError: (error) => context.reportError(error),
            },
        );
        this.view = new DoublePendulumView(
            this.requireRoot(),
            DOUBLE_PENDULUM_PARAMETER_SCHEMA,
            this.viewModel,
            {
                parameterChanged: (key) => {
                    if (this.requireViewModel().parameterChanged(key)) {
                        this.renderCurrentState(true);
                    }
                },
                reportError: (error) => context.reportError(error),
            },
        );
    }

    protected onUnmount(): void {
        this.view?.destroy();
        this.view = null;
        this.viewModel?.dispose();
        this.viewModel = null;
        this.lastRenderAt = 0;
    }

    update(dt: number): void {
        if (this.viewModel?.update(dt)) {
            this.renderCurrentState(false);
        }
    }

    pause(): void {
        this.viewModel?.pause();
    }

    resume(): void {
        this.viewModel?.resume();
    }

    reset(): void {
        const viewModel = this.requireViewModel();
        const view = this.requireView();
        viewModel.reset();
        view.refreshParameterPanel();
        this.renderCurrentState(true);
    }

    protected render(viewport: ViewportSnapshot): void {
        const view = this.requireView();
        view.layout(viewport);
        this.renderCurrentState(true);
    }

    private renderCurrentState(force: boolean): void {
        const viewModel = this.viewModel;
        const view = this.view;
        if (!viewModel || !view) {
            return;
        }
        const now = Date.now();
        if (!force && now - this.lastRenderAt < MINIMUM_RENDER_INTERVAL_MS) {
            return;
        }
        this.lastRenderAt = now;
        view.render(viewModel.createViewState());
    }

    private requireViewModel(): DoublePendulumViewModel {
        if (!this.viewModel) {
            throw new Error('Double pendulum ViewModel is unavailable');
        }
        return this.viewModel;
    }

    private requireView(): DoublePendulumView {
        if (!this.view) {
            throw new Error('Double pendulum View is unavailable');
        }
        return this.view;
    }
}
