import type { Node } from 'cc';
import type {
    Pausable,
    Resettable,
    Updatable,
} from '../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../services/ViewportService';
import { ResponsiveModule } from './ResponsiveModule';

export interface GameViewModel<TState> {
    update(deltaTime: number): boolean;
    pause(): void;
    resume(): void;
    reset(): void;
    createViewState(): TState;
    dispose?(): void;
}

export interface GameView<TState> {
    render(state: TState): void;
    destroy(): void;
}

interface DefaultLayoutGameView {
    layout(viewport: ViewportSnapshot): void;
}

export abstract class ViewModelGameModule<
    TState,
    TViewModel extends GameViewModel<TState>,
    TView extends GameView<TState>,
> extends ResponsiveModule implements Updatable, Pausable, Resettable {
    private viewModel: TViewModel | null = null;
    private view: TView | null = null;

    protected abstract createViewModel(): TViewModel;

    protected abstract createView(root: Node, viewModel: TViewModel): TView;

    protected onMount(): void {
        const viewModel = this.createViewModel();
        this.viewModel = viewModel;
        this.view = this.createView(this.requireRoot(), viewModel);
    }

    protected onUnmount(): void {
        const view = this.view;
        const viewModel = this.viewModel;
        this.view = null;
        this.viewModel = null;

        try {
            view?.destroy();
        } finally {
            viewModel?.dispose?.();
        }
    }

    update(deltaTime: number): void {
        if (this.viewModel?.update(deltaTime)) {
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
        this.requireGameViewModel().reset();
        this.renderCurrentState();
    }

    protected render(viewport: ViewportSnapshot): void {
        const viewModel = this.requireGameViewModel();
        const view = this.requireGameView();
        this.layoutGameView(viewport, viewModel, view);
        this.renderCurrentState();
    }

    protected layoutGameView(
        viewport: ViewportSnapshot,
        _viewModel: TViewModel,
        view: TView,
    ): void {
        const layout = (view as TView & Partial<DefaultLayoutGameView>).layout;
        if (!layout) {
            throw new Error(`${this.rootName} View has no default layout method`);
        }
        layout.call(view, viewport);
    }

    protected requireGameViewModel(): TViewModel {
        if (!this.viewModel) {
            throw new Error(`${this.rootName} ViewModel is unavailable`);
        }
        return this.viewModel;
    }

    protected requireGameView(): TView {
        if (!this.view) {
            throw new Error(`${this.rootName} View is unavailable`);
        }
        return this.view;
    }

    protected renderCurrentState(): void {
        const viewModel = this.viewModel;
        const view = this.view;
        if (!viewModel || !view) {
            return;
        }
        view.render(viewModel.createViewState());
    }
}
