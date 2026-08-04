import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { TetrisView } from './TetrisView';
import { TetrisViewModel } from './TetrisViewModel';

export class TetrisModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'TetrisModuleRoot';

    private viewModel: TetrisViewModel | null = null;
    private view: TetrisView | null = null;

    protected onMount(): void {
        this.viewModel = new TetrisViewModel();
        const viewModel = this.viewModel;
        this.view = new TetrisView(this.requireRoot(), {
            moveOnce: (direction) => {
                viewModel.moveOnceFromHuman(direction);
                this.renderCurrentState();
            },
            setHorizontal: (direction) => {
                viewModel.setHorizontalFromHuman(direction);
                this.renderCurrentState();
            },
            setSoftDrop: (active) => {
                viewModel.setSoftDropFromHuman(active);
                this.renderCurrentState();
            },
            softDropOnce: () => {
                viewModel.softDropOnceFromHuman();
                this.renderCurrentState();
            },
            rotateClockwise: () => {
                viewModel.rotateClockwiseFromHuman();
                this.renderCurrentState();
            },
            rotateCounterClockwise: () => {
                viewModel.rotateCounterClockwiseFromHuman();
                this.renderCurrentState();
            },
            hardDrop: () => {
                viewModel.hardDropFromHuman();
                this.renderCurrentState();
            },
            hold: () => {
                viewModel.holdFromHuman();
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
        const viewModel = this.viewModel;
        const view = this.view;
        if (!viewModel || !view) {
            return;
        }
        view.render(viewModel.createViewState());
    }

    private requireViewModel(): TetrisViewModel {
        if (!this.viewModel) {
            throw new Error('Tetris ViewModel is unavailable');
        }
        return this.viewModel;
    }

    private requireView(): TetrisView {
        if (!this.view) {
            throw new Error('Tetris View is unavailable');
        }
        return this.view;
    }
}
