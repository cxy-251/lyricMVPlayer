import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { RollingBodyRaceView } from './RollingBodyRaceView';
import {
    ROLLING_BODY_RACE_PARAMETER_SCHEMA,
    RollingBodyRaceViewModel,
} from './RollingBodyRaceViewModel';

export class RollingBodyRaceModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'RollingBodyRaceModuleRoot';

    private viewModel: RollingBodyRaceViewModel | null = null;
    private view: RollingBodyRaceView | null = null;

    protected onMount(): void {
        const context = this.requireContext();
        this.viewModel = new RollingBodyRaceViewModel(
            context.storage,
            {
                stateChanged: () => this.renderCurrentState(),
                reportError: (error) => context.reportError(error),
            },
        );
        this.view = new RollingBodyRaceView(
            this.requireRoot(),
            ROLLING_BODY_RACE_PARAMETER_SCHEMA,
            this.viewModel,
            {
                parameterChanged: (key) => {
                    if (this.requireViewModel().parameterChanged(key)) {
                        this.renderCurrentState();
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
        this.requireView().layout(viewport);
        this.renderCurrentState();
    }

    private renderCurrentState(): void {
        if (this.viewModel && this.view) {
            this.view.render(this.viewModel.createViewState());
        }
    }

    private requireViewModel(): RollingBodyRaceViewModel {
        if (!this.viewModel) {
            throw new Error('Rolling body race ViewModel is unavailable');
        }
        return this.viewModel;
    }

    private requireView(): RollingBodyRaceView {
        if (!this.view) {
            throw new Error('Rolling body race View is unavailable');
        }
        return this.view;
    }
}
