import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { ReversiView } from './ReversiView';
import { ReversiViewModel } from './ReversiViewModel';

export class ReversiModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'ReversiModuleRoot';

    private viewModel: ReversiViewModel | null = null;
    private view: ReversiView | null = null;

    protected onMount(): void {
        this.viewModel = new ReversiViewModel();
        const viewModel = this.viewModel;
        this.view = new ReversiView(this.requireRoot(), {
            place: (row, column) => {
                viewModel.placeFromHuman(row, column);
                this.renderCurrentState();
            },
            moveFocus: (rowOffset, columnOffset) => {
                viewModel.moveFocusFromHuman(rowOffset, columnOffset);
                this.renderCurrentState();
            },
            placeFocused: () => {
                viewModel.placeFocusedFromHuman();
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

    private requireViewModel(): ReversiViewModel {
        if (!this.viewModel) {
            throw new Error('Reversi ViewModel is unavailable');
        }
        return this.viewModel;
    }

    private requireView(): ReversiView {
        if (!this.view) {
            throw new Error('Reversi View is unavailable');
        }
        return this.view;
    }
}
