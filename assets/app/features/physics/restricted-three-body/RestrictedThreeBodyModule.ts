import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { PlanarThreeBodyView } from './RestrictedThreeBodyView';
import {
    PLANAR_THREE_BODY_PARAMETER_SCHEMA,
    PlanarThreeBodyViewModel,
} from './RestrictedThreeBodyViewModel';

const MINIMUM_RENDER_INTERVAL_MS = 14;

export class RestrictedThreeBodyModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'PlanarThreeBodyModuleRoot';

    private viewModel: PlanarThreeBodyViewModel | null = null;
    private view: PlanarThreeBodyView | null = null;
    private lastRenderAt = 0;

    protected onMount(): void {
        const context = this.requireContext();
        this.viewModel = new PlanarThreeBodyViewModel(
            context.storage,
            {
                stateChanged: () => this.renderCurrentState(true),
                reportError: (error) => context.reportError(error),
            },
        );
        this.view = new PlanarThreeBodyView(
            this.requireRoot(),
            PLANAR_THREE_BODY_PARAMETER_SCHEMA,
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
        this.requireView().layout(viewport);
        this.renderCurrentState(true);
    }

    private renderCurrentState(force: boolean): void {
        if (!this.viewModel || !this.view) {
            return;
        }
        const now = Date.now();
        if (!force && now - this.lastRenderAt < MINIMUM_RENDER_INTERVAL_MS) {
            return;
        }
        this.lastRenderAt = now;
        this.view.render(this.viewModel.createViewState());
    }

    private requireViewModel(): PlanarThreeBodyViewModel {
        if (!this.viewModel) {
            throw new Error('Planar three-body ViewModel is unavailable');
        }
        return this.viewModel;
    }

    private requireView(): PlanarThreeBodyView {
        if (!this.view) {
            throw new Error('Planar three-body View is unavailable');
        }
        return this.view;
    }
}
