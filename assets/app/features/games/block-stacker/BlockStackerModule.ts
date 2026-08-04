import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { BlockStackerView } from './BlockStackerView';
import { BlockStackerViewModel } from './BlockStackerViewModel';

export class BlockStackerModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'BlockStackerModuleRoot';

    private viewModel: BlockStackerViewModel | null = null;
    private view: BlockStackerView | null = null;

    protected onMount(): void {
        this.viewModel = new BlockStackerViewModel();
        const viewModel = this.viewModel;
        this.view = new BlockStackerView(this.requireRoot(), {
            drop: () => {
                viewModel.dropFromHuman();
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

    private requireViewModel(): BlockStackerViewModel {
        if (!this.viewModel) {
            throw new Error('Block Stacker ViewModel is unavailable');
        }
        return this.viewModel;
    }

    private requireView(): BlockStackerView {
        if (!this.view) {
            throw new Error('Block Stacker View is unavailable');
        }
        return this.view;
    }
}
