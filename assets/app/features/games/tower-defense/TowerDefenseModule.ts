import type { Node } from 'cc';
import { ViewModelGameModule } from '../../../templates/ViewModelGameModule';
import { TowerDefenseView } from './TowerDefenseView';
import { TowerDefenseViewModel } from './TowerDefenseViewModel';
import type { TowerDefenseViewState } from './TowerDefenseTypes';

export class TowerDefenseModule extends ViewModelGameModule<
    TowerDefenseViewState,
    TowerDefenseViewModel,
    TowerDefenseView
> {
    protected readonly rootName = 'TowerDefenseModuleRoot';

    protected createViewModel(): TowerDefenseViewModel {
        return new TowerDefenseViewModel();
    }

    protected createView(
        root: Node,
        viewModel: TowerDefenseViewModel,
    ): TowerDefenseView {
        return new TowerDefenseView(root, {
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
    }
}
