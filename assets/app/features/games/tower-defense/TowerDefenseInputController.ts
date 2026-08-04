import {
    EventKeyboard,
    KeyCode,
} from 'cc';
import { inputRouter } from '../../../services/InputRouter';
import type {
    TowerDefenseDirection,
    TowerDefenseTowerKind,
} from './TowerDefenseTypes';

export interface TowerDefenseInputActions {
    readonly moveSelection: (direction: TowerDefenseDirection) => void;
    readonly selectKind: (kind: TowerDefenseTowerKind) => void;
    readonly build: () => void;
    readonly upgrade: () => void;
    readonly startWave: () => void;
    readonly restart: () => void;
}

export class TowerDefenseInputController {
    private readonly unbindKeyboard: () => void;

    constructor(private readonly actions: TowerDefenseInputActions) {
        this.unbindKeyboard = inputRouter.bind({
            priority: 100,
            onKeyDown: this.handleKeyDown,
        });
    }

    destroy(): void {
        this.unbindKeyboard();
    }

    private readonly handleKeyDown = (event: EventKeyboard): boolean => {
        switch (event.keyCode) {
            case KeyCode.ARROW_UP:
            case KeyCode.KEY_W:
                this.actions.moveSelection('up');
                return true;
            case KeyCode.ARROW_DOWN:
            case KeyCode.KEY_S:
                this.actions.moveSelection('down');
                return true;
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                this.actions.moveSelection('left');
                return true;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this.actions.moveSelection('right');
                return true;
            case KeyCode.KEY_Q:
                this.actions.selectKind('dart');
                return true;
            case KeyCode.KEY_E:
                this.actions.selectKind('cannon');
                return true;
            case KeyCode.ENTER:
                this.actions.build();
                return true;
            case KeyCode.KEY_U:
                this.actions.upgrade();
                return true;
            case KeyCode.KEY_F:
                this.actions.startWave();
                return true;
            case KeyCode.KEY_R:
                this.actions.restart();
                return true;
            default:
                return false;
        }
    };
}
