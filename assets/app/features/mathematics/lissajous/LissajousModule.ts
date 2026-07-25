import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { LissajousView } from './LissajousView';
import {
    LISSAJOUS_PARAMETER_SCHEMA,
    LissajousViewModel,
} from './LissajousViewModel';

export class LissajousModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'LissajousModuleRoot';

    private viewModel: LissajousViewModel | null = null;
    private view: LissajousView | null = null;

    protected onMount(): void {
        const context = this.requireContext();
        this.viewModel = new LissajousViewModel(context.storage);
        this.view = new LissajousView(
            this.requireRoot(),
            LISSAJOUS_PARAMETER_SCHEMA,
            this.viewModel,
            {
                parameterChanged: () => this.renderCurrentState(),
                cyclePreset: (direction) => {
                    this.requireViewModel().cyclePreset(direction);
                    this.requireView().refreshParameterPanel();
                    this.renderCurrentState();
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
    }

    update(dt: number): void {
        if (this.viewModel?.update(dt)) {
            this.renderCurrentState();
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
        this.renderCurrentState();
    }

    protected render(viewport: ViewportSnapshot): void {
        const view = this.requireView();
        view.layout(viewport);
        this.renderCurrentState();
    }

    private renderCurrentState(): void {
        const viewModel = this.viewModel;
        const view = this.view;
        if (!viewModel || !view) {
            return;
        }

        view.render(viewModel.createViewState(view.requestedRendering));
    }

    private requireViewModel(): LissajousViewModel {
        if (!this.viewModel) {
            throw new Error('Lissajous ViewModel is unavailable');
        }

        return this.viewModel;
    }

    private requireView(): LissajousView {
        if (!this.view) {
            throw new Error('Lissajous View is unavailable');
        }

        return this.view;
    }
}
