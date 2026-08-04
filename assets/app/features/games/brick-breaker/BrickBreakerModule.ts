import type { Node } from 'cc';
import { ViewModelGameModule } from '../../../templates/ViewModelGameModule';
import { BrickBreakerView } from './BrickBreakerView';
import { BrickBreakerViewModel } from './BrickBreakerViewModel';
import type { BrickBreakerViewState } from './BrickBreakerTypes';

export class BrickBreakerModule extends ViewModelGameModule<
    BrickBreakerViewState,
    BrickBreakerViewModel,
    BrickBreakerView
> {
    protected readonly rootName = 'BrickBreakerModuleRoot';

    protected createViewModel(): BrickBreakerViewModel {
        return new BrickBreakerViewModel();
    }

    protected createView(root: Node, viewModel: BrickBreakerViewModel): BrickBreakerView {
        return new BrickBreakerView(root, {
            humanAxisChanged: (axis) => viewModel.humanAxisChanged(axis),
            humanTargetChanged: (normalizedX) => viewModel.humanTargetChanged(normalizedX),
            humanPointerReleased: () => viewModel.humanPointerReleased(),
            launch: () => {
                viewModel.launchFromHuman();
                this.renderCurrentState();
            },
            restart: () => {
                viewModel.restartFromHuman();
                this.renderCurrentState();
            },
        });
    }
}
