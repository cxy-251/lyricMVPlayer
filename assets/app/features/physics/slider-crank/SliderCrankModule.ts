import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { SliderCrankView } from './SliderCrankView';
import {
    SLIDER_CRANK_PARAMETER_SCHEMA,
    SliderCrankViewModel,
} from './SliderCrankViewModel';

const MINIMUM_RENDER_INTERVAL_MS = 14;

export class SliderCrankModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'SliderCrankModuleRoot';

    private viewModel: SliderCrankViewModel | null = null;
    private view: SliderCrankView | null = null;
    private lastRenderAt = 0;

    protected onMount(): void {
        const context = this.requireContext();
        this.viewModel = new SliderCrankViewModel(
            context.storage,
            {
                reportError: (error) => context.reportError(error),
            },
        );
        this.view = new SliderCrankView(
            this.requireRoot(),
            SLIDER_CRANK_PARAMETER_SCHEMA,
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
        if (!this.viewModel || !this.view) return;
        const now = Date.now();
        if (!force && now - this.lastRenderAt < MINIMUM_RENDER_INTERVAL_MS) return;
        this.lastRenderAt = now;
        this.view.render(this.viewModel.createViewState());
    }

    private requireViewModel(): SliderCrankViewModel {
        if (!this.viewModel) {
            throw new Error('Slider-crank ViewModel is unavailable');
        }
        return this.viewModel;
    }

    private requireView(): SliderCrankView {
        if (!this.view) {
            throw new Error('Slider-crank view is unavailable');
        }
        return this.view;
    }
}
