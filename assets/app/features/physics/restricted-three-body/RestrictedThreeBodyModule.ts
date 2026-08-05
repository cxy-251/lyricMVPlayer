import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { RestrictedThreeBodyView } from './RestrictedThreeBodyView';
import {
    RESTRICTED_THREE_BODY_PARAMETER_SCHEMA,
    RestrictedThreeBodyViewModel,
} from './RestrictedThreeBodyViewModel';

export class RestrictedThreeBodyModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'RestrictedThreeBodyModuleRoot';

    private viewModel: RestrictedThreeBodyViewModel | null = null;
    private view: RestrictedThreeBodyView | null = null;

    protected onMount(): void {
        const context = this.requireContext();
        this.viewModel = new RestrictedThreeBodyViewModel(
            context.storage,
            {
                stateChanged: () => this.renderCurrentState(),
                reportError: (error) => context.reportError(error),
            },
        );
        this.view = new RestrictedThreeBodyView(
            this.requireRoot(),
            RESTRICTED_THREE_BODY_PARAMETER_SCHEMA,
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

    private requireViewModel(): RestrictedThreeBodyViewModel {
        if (!this.viewModel) {
            throw new Error('Restricted three-body ViewModel is unavailable');
        }
        return this.viewModel;
    }

    private requireView(): RestrictedThreeBodyView {
        if (!this.view) {
            throw new Error('Restricted three-body View is unavailable');
        }
        return this.view;
    }
}
