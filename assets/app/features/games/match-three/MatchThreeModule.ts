import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { MatchThreeView } from './MatchThreeView';
import { MatchThreeViewModel } from './MatchThreeViewModel';

export class MatchThreeModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'MatchThreeModuleRoot';

    private viewModel: MatchThreeViewModel | null = null;
    private view: MatchThreeView | null = null;

    protected onMount(): void {
        this.viewModel = new MatchThreeViewModel();
        const viewModel = this.viewModel;
        this.view = new MatchThreeView(this.requireRoot(), {
            selectCell: (row, column) => {
                viewModel.selectCellFromHuman(row, column);
                this.renderCurrentState();
            },
            swapCell: (row, column, direction) => {
                viewModel.swapCellFromHuman(row, column, direction);
                this.renderCurrentState();
            },
            moveFocus: (rowDelta, columnDelta) => {
                viewModel.moveFocusFromHuman(rowDelta, columnDelta);
                this.renderCurrentState();
            },
            activateFocused: () => {
                viewModel.activateFocusedFromHuman();
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
        this.viewModel?.reset();
        this.renderCurrentState();
    }

    protected render(viewport: ViewportSnapshot): void {
        this.view?.layout(viewport);
        this.renderCurrentState();
    }

    private renderCurrentState(): void {
        if (this.view && this.viewModel) {
            this.view.render(this.viewModel.createViewState());
        }
    }
}
