import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { ConnectFourView } from './ConnectFourView';
import { ConnectFourViewModel } from './ConnectFourViewModel';

export class ConnectFourModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'ConnectFourModuleRoot';

    private viewModel: ConnectFourViewModel | null = null;
    private view: ConnectFourView | null = null;

    protected onMount(): void {
        this.viewModel = new ConnectFourViewModel();
        const viewModel = this.viewModel;
        this.view = new ConnectFourView(this.requireRoot(), {
            drop: (column) => {
                viewModel.dropFromHuman(column);
                this.renderCurrentState();
            },
            moveFocus: (offset) => {
                viewModel.moveFocusFromHuman(offset);
                this.renderCurrentState();
            },
            dropFocused: () => {
                viewModel.dropFocusedFromHuman();
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

    private requireViewModel(): ConnectFourViewModel {
        if (!this.viewModel) {
            throw new Error('Connect Four ViewModel is unavailable');
        }
        return this.viewModel;
    }

    private requireView(): ConnectFourView {
        if (!this.view) {
            throw new Error('Connect Four View is unavailable');
        }
        return this.view;
    }
}
