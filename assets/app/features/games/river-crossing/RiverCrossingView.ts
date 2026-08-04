import {
    Color,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Node,
} from 'cc';
import type { ViewportSnapshot } from '../../../services/ViewportService';
import {
    clearNode,
    createButton,
    createLabel,
    createUiNode,
    fillNode,
    palette,
} from '../../../ui/UiFactory';
import { RiverCrossingInputController } from './RiverCrossingInputController';
import type {
    RiverCrossingViewActions,
    RiverCrossingViewState,
    RiverLaneKind,
} from './RiverCrossingTypes';

const LANE_COLORS: Record<RiverLaneKind, Color> = {
    safe: new Color(46, 66, 53, 255),
    road: new Color(42, 45, 44, 255),
    river: new Color(39, 63, 76, 255),
    goal: new Color(68, 78, 54, 255),
};

export class RiverCrossingView {
    private readonly input: RiverCrossingInputController;
    private graphics: Graphics | null = null;
    private statusLabel: Label | null = null;
    private statsLabel: Label | null = null;
    private hintLabel: Label | null = null;
    private boardWidth = 1;
    private boardHeight = 1;

    constructor(
        private readonly root: Node,
        private readonly actions: RiverCrossingViewActions,
    ) {
        this.input = new RiverCrossingInputController(root, actions);
    }

    layout(viewport: ViewportSnapshot): void {
        clearNode(this.root);
        fillNode(this.root, viewport.width, viewport.height, palette.background);
        const compact = viewport.breakpoint === 'compact';
        const safeWidth = viewport.width - viewport.safeInsets.left - viewport.safeInsets.right;
        const safeTop = viewport.height / 2 - viewport.safeInsets.top;
        const safeBottom = -viewport.height / 2 + viewport.safeInsets.bottom;
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const contentTop = safeTop - (compact ? 66 : 74);
        const hudHeight = compact ? 58 : 66;
        const controlsHeight = compact ? 116 : 78;
        const footerHeight = 24;
        const availableHeight = contentTop - safeBottom - hudHeight - controlsHeight - footerHeight;
        const availableWidth = safeWidth - (compact ? 18 : 40);
        const cell = Math.max(9, Math.floor(Math.min(availableWidth / 11, availableHeight / 12)));
        this.boardWidth = cell * 11;
        this.boardHeight = cell * 12;
        const boardTop = contentTop - hudHeight;
        const boardCenterY = boardTop - this.boardHeight / 2;

        const statusNode = createLabel(
            this.root, '', Math.min(440, safeWidth - 20), compact ? 22 : 26,
            compact ? 13 : 15, palette.text, centerX, contentTop - 12,
            HorizontalTextAlignment.CENTER,
        );
        this.statusLabel = statusNode.getComponent(Label);
        const statsNode = createLabel(
            this.root, '', Math.min(540, safeWidth - 20), 20,
            compact ? 9 : 11, palette.muted, centerX,
            contentTop - (compact ? 36 : 42),
        );
        this.statsLabel = statsNode.getComponent(Label);

        const board = createUiNode(
            this.root, 'RiverCrossingBoard', this.boardWidth, this.boardHeight,
            centerX, boardCenterY,
        );
        this.graphics = board.addComponent(Graphics);

        const controlsY = boardCenterY - this.boardHeight / 2 - (compact ? 58 : 42);
        const buttonWidth = compact ? 68 : 76;
        const buttonHeight = compact ? 30 : 34;
        createButton(this.root, {
            name: 'RiverUp', text: 'UP', width: buttonWidth, height: buttonHeight,
            x: centerX, y: controlsY + (compact ? 38 : 0), fontSize: 10,
            variant: 'secondary', onPress: () => actions.move('up'),
        });
        createButton(this.root, {
            name: 'RiverLeft', text: 'LEFT', width: buttonWidth, height: buttonHeight,
            x: centerX - buttonWidth - 6, y: controlsY, fontSize: 10,
            variant: 'secondary', onPress: () => actions.move('left'),
        });
        createButton(this.root, {
            name: 'RiverDown', text: 'DOWN', width: buttonWidth, height: buttonHeight,
            x: centerX, y: controlsY, fontSize: 10,
            variant: 'secondary', onPress: () => actions.move('down'),
        });
        createButton(this.root, {
            name: 'RiverRight', text: 'RIGHT', width: buttonWidth, height: buttonHeight,
            x: centerX + buttonWidth + 6, y: controlsY, fontSize: 10,
            variant: 'secondary', onPress: () => actions.move('right'),
        });
        createButton(this.root, {
            name: 'RiverNew', text: 'NEW', width: buttonWidth, height: buttonHeight,
            x: centerX, y: controlsY - (compact ? 38 : 0), fontSize: 10,
            variant: 'secondary', onPress: () => actions.restart(),
        });
        const hintNode = createLabel(
            this.root, '', Math.min(600, safeWidth - 20), 20,
            compact ? 8 : 10, palette.muted, centerX, safeBottom + 12,
        );
        this.hintLabel = hintNode.getComponent(Label);
    }

    render(state: RiverCrossingViewState): void {
        if (!this.graphics) {
            return;
        }
        if (this.statusLabel) {
            this.statusLabel.string = state.status;
        }
        if (this.statsLabel) {
            this.statsLabel.string = `SCORE ${state.score}   LIVES ${state.lives}   CROSSINGS ${state.crossings}/${state.targetCrossings}`;
        }
        if (this.hintLabel) {
            this.hintLabel.string = state.hint;
        }
        const graphics = this.graphics;
        const cell = this.boardWidth / state.width;
        graphics.clear();
        for (const lane of state.lanes) {
            const bottom = -this.boardHeight / 2 + lane.row * cell;
            graphics.fillColor = LANE_COLORS[lane.kind];
            graphics.fillRect(-this.boardWidth / 2, bottom, this.boardWidth, cell);
            graphics.strokeColor = palette.border;
            graphics.lineWidth = 1;
            graphics.moveTo(-this.boardWidth / 2, bottom);
            graphics.lineTo(this.boardWidth / 2, bottom);
            graphics.stroke();
            for (const object of lane.objects) {
                const centerX = -this.boardWidth / 2 + (object.x + 0.5) * cell;
                const width = object.width * cell;
                if (lane.kind === 'road') {
                    graphics.fillColor = lane.speed > 0 ? palette.danger : palette.warning;
                    graphics.roundRect(centerX - width / 2, bottom + cell * 0.2, width, cell * 0.6, cell * 0.12);
                    graphics.fill();
                    graphics.fillColor = palette.primaryText;
                    graphics.fillRect(centerX - width * 0.22, bottom + cell * 0.58, width * 0.44, cell * 0.08);
                } else {
                    graphics.fillColor = new Color(112, 88, 57, 255);
                    graphics.roundRect(centerX - width / 2, bottom + cell * 0.2, width, cell * 0.6, cell * 0.28);
                    graphics.fill();
                }
            }
        }
        const playerX = -this.boardWidth / 2 + (state.player.x + 0.5) * cell;
        const playerY = -this.boardHeight / 2 + (state.player.y + 0.5) * cell;
        const radius = cell * 0.32;
        graphics.fillColor = palette.accent;
        graphics.moveTo(playerX, playerY + radius);
        graphics.lineTo(playerX + radius, playerY);
        graphics.lineTo(playerX, playerY - radius);
        graphics.lineTo(playerX - radius, playerY);
        graphics.close();
        graphics.fill();
    }

    destroy(): void {
        this.input.destroy();
        this.graphics = null;
        clearNode(this.root);
    }
}
