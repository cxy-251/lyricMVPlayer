import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { MassSpringDamperView } from './MassSpringDamperView';
import {
    MASS_SPRING_DAMPER_PARAMETER_SCHEMA,
    MassSpringDamperViewModel,
} from './MassSpringDamperViewModel';

export class MassSpringDamperModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'MassSpringDamperModuleRoot';

    private viewModel: MassSpringDamperViewModel | null = null;
    private view: MassSpringDamperView | null = null;

    protected onMount(): void {
        const context = this.requireContext();
        this.viewModel = new MassSpringDamperViewModel(
            context.storage,
            {
                stateChanged: () => this.renderCurrentState(),
                reportError: (error) => context.reportError(error),
            },
        );
        this.view = new MassSpringDamperView(
            this.requireRoot(),
            MASS_SPRING_DAMPER_PARAMETER_SCHEMA,
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
        view.render(viewModel.createViewState());
    }

    private requireViewModel(): MassSpringDamperViewModel {
        if (!this.viewModel) {
            throw new Error('Mass-spring-damper ViewModel is unavailable');
        }
        return this.viewModel;
    }

    private requireView(): MassSpringDamperView {
        if (!this.view) {
            throw new Error('Mass-spring-damper View is unavailable');
        }
        return this.view;
    }
}
