import type { Node } from 'cc';
import { ViewModelGameModule } from '../../../templates/ViewModelGameModule';
import { CursorSpaceView } from './CursorSpaceView';
import { CursorSpaceViewModel } from './CursorSpaceViewModel';
import type { CursorSpaceViewState } from './CursorSpaceViewTypes';

export class CursorSpaceModule extends ViewModelGameModule<
    CursorSpaceViewState,
    CursorSpaceViewModel,
    CursorSpaceView
> {
    protected readonly rootName = 'CursorSpaceModuleRoot';

    protected createViewModel(): CursorSpaceViewModel {
        return new CursorSpaceViewModel();
    }

    protected createView(root: Node, viewModel: CursorSpaceViewModel): CursorSpaceView {
        return new CursorSpaceView(
            root,
            viewModel.renderCapacity,
            {
                boundsChanged: (bounds) => viewModel.setBounds(bounds),
                humanTargetChanged: (x, y) => {
                    viewModel.activateHumanControl(x, y);
                },
                pointerReleased: () => viewModel.activateAutopilot(),
            },
        );
    }

    pause(): void {
        this.requireGameViewModel().pause();
    }

    resume(): void {
        this.requireGameViewModel().resume();
    }
}
