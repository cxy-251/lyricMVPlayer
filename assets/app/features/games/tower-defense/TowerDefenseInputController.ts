import {
    EventKeyboard,
    input,
    Input,
    KeyCode,
} from 'cc';
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
    constructor(private readonly actions: TowerDefenseInputActions) {
        input.on(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
    }

    destroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.handleKeyDown, this);
    }

    private readonly handleKeyDown = (event: EventKeyboard): void => {
        switch (event.keyCode) {
            case KeyCode.ARROW_UP:
            case KeyCode.KEY_W:
                this.actions.moveSelection('up');
                break;
            case KeyCode.ARROW_DOWN:
            case KeyCode.KEY_S:
                this.actions.moveSelection('down');
                break;
            case KeyCode.ARROW_LEFT:
            case KeyCode.KEY_A:
                this.actions.moveSelection('left');
                break;
            case KeyCode.ARROW_RIGHT:
            case KeyCode.KEY_D:
                this.actions.moveSelection('right');
                break;
            case KeyCode.KEY_Q:
                this.actions.selectKind('dart');
                break;
            case KeyCode.KEY_E:
                this.actions.selectKind('cannon');
                break;
            case KeyCode.ENTER:
                this.actions.build();
                break;
            case KeyCode.KEY_U:
                this.actions.upgrade();
                break;
            case KeyCode.KEY_F:
                this.actions.startWave();
                break;
            case KeyCode.KEY_R:
                this.actions.restart();
                break;
            default:
                break;
        }
    };
}
