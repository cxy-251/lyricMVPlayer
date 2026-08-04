import type {
    Pausable,
    Resettable,
    Updatable,
} from '../../../contracts/InteractiveModule';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import { ResponsiveModule } from '../../../templates/ResponsiveModule';
import { TowerDefenseInputController } from './TowerDefenseInputController';
import { TowerDefenseView } from './TowerDefenseView';
import { TowerDefenseViewModel } from './TowerDefenseViewModel';

export class TowerDefenseModule extends ResponsiveModule implements Updatable, Pausable, Resettable {
    protected readonly rootName = 'TowerDefenseModuleRoot';

    private viewModel: TowerDefenseViewModel | null = null;
    private view: TowerDefenseView | null = null;
    private input: TowerDefenseInputController | null = null;

    protected onMount(): void {
        this.viewModel = new TowerDefenseViewModel();
        const viewModel = this.viewModel;
        this.view = new TowerDefenseView(this.requireRoot(), {
            selectSlot: (slotId) => {
                viewModel.selectSlotFromHuman(slotId);
                this.renderCurrentState();
            },
            moveSelection: (direction) => {
                viewModel.moveSelectionFromHuman(direction);
                this.renderCurrentState();
            },
            selectKind: (kind) => {
                viewModel.selectKindFromHuman(kind);
                this.renderCurrentState();
            },
            buildSelected: () => {
                viewModel.buildSelectedFromHuman();
                this.renderCurrentState();
            },
            upgradeSelected: () => {
                viewModel.upgradeSelectedFromHuman();
                this.renderCurrentState();
            },
            startWave: () => {
                viewModel.startWaveFromHuman();
                this.renderCurrentState();
            },
            restart: () => {
                viewModel.restartFromHuman();
                this.renderCurrentState();
            },
        });
        this.input = new TowerDefenseInputController({
            moveSelection: (direction) => {
                viewModel.moveSelectionFromHuman(direction);
                this.renderCurrentState();
            },
            selectKind: (kind) => {
                viewModel.selectKindFromHuman(kind);
                this.renderCurrentState();
            },
            build: () => {
                viewModel.buildSelectedFromHuman();
                this.renderCurrentState();
            },
            upgrade: () => {
                viewModel.upgradeSelectedFromHuman();
                this.renderCurrentState();
            },
            startWave: () => {
                viewModel.startWaveFromHuman();
                this.renderCurrentState();
            },
            restart: () => {
                viewModel.restartFromHuman();
                this.renderCurrentState();
            },
        });
    }

    protected onUnmount(): void {
        this.input?.destroy();
        this.input = null;
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
