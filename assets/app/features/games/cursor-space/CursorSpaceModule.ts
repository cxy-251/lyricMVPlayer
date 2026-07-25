import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { CursorSpaceView } from './CursorSpaceView';
import { CursorSpaceViewModel } from './CursorSpaceViewModel';

export class CursorSpaceModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'CursorSpaceModuleRoot';

    private viewModel: CursorSpaceViewModel | null = null;
    private view: CursorSpaceView | null = null;

    protected onMount(): void {
        this.viewModel = new CursorSpaceViewModel();
        this.view = new CursorSpaceView(
            this.requireRoot(),
            this.viewModel.renderCapacity,
            {
                boundsChanged: (bounds) => this.requireViewModel().setBounds(bounds),
                humanTargetChanged: (x, y) => {
                    this.requireViewModel().activateHumanControl(x, y);
                },
                pointerReleased: () => this.requireViewModel().activateAutopilot(),
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
        this.requireViewModel().reset();
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

    private requireViewModel(): CursorSpaceViewModel {
        if (!this.viewModel) {
            throw new Error('Cursor Space ViewModel is unavailable');
        }
        return this.viewModel;
    }

    private requireView(): CursorSpaceView {
        if (!this.view) {
            throw new Error('Cursor Space View is unavailable');
        }
        return this.view;
    }
}
