import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { MinesweeperView } from './MinesweeperView';
import { MinesweeperViewModel } from './MinesweeperViewModel';

export class MinesweeperModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'MinesweeperModuleRoot';

    private viewModel: MinesweeperViewModel | null = null;
    private view: MinesweeperView | null = null;

    protected onMount(): void {
        this.viewModel = new MinesweeperViewModel();
        const viewModel = this.viewModel;
        this.view = new MinesweeperView(
            this.requireRoot(),
            viewModel.rows,
            viewModel.columns,
            {
                primaryCell: (row, column) => {
                    viewModel.primaryCell(row, column);
                    this.renderCurrentState();
                },
                secondaryCell: (row, column) => {
                    viewModel.secondaryCell(row, column);
                    this.renderCurrentState();
                },
                primaryFocused: () => {
                    viewModel.primaryFocused();
                    this.renderCurrentState();
                },
                secondaryFocused: () => {
                    viewModel.secondaryFocused();
                    this.renderCurrentState();
                },
                moveFocus: (rowOffset, columnOffset) => {
                    viewModel.moveFocus(rowOffset, columnOffset);
                    this.renderCurrentState();
                },
                restart: () => {
                    viewModel.restartFromHuman();
                    this.renderCurrentState();
                },
                toggleFlagMode: () => {
                    viewModel.toggleFlagMode();
                    this.renderCurrentState();
                },
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
        const viewModel = this.viewModel;
        const view = this.view;
        if (!viewModel || !view) {
            return;
        }
        view.render(viewModel.createViewState());
    }

    private requireViewModel(): MinesweeperViewModel {
        if (!this.viewModel) {
            throw new Error('Minesweeper ViewModel is unavailable');
        }
        return this.viewModel;
    }

    private requireView(): MinesweeperView {
        if (!this.view) {
            throw new Error('Minesweeper View is unavailable');
        }
        return this.view;
    }
}
