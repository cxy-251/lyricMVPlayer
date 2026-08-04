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
import { MazeChaseInputController } from './MazeChaseInputController';
import type {
    MazeChaseDirection,
    MazeChaseEnemyKind,
    MazeChaseViewActions,
    MazeChaseViewState,
} from './MazeChaseTypes';

const ENEMY_COLORS: Record<MazeChaseEnemyKind, Color> = {
    chaser: new Color(190, 104, 104, 255),
    ambusher: new Color(181, 149, 95, 255),
    patroller: new Color(111, 145, 170, 255),
};

export class MazeChaseView {
    private readonly input: MazeChaseInputController;
    private boardGraphics: Graphics | null = null;
    private statusLabel: Label | null = null;
    private statsLabel: Label | null = null;
    private hintLabel: Label | null = null;
    private boardWidth = 1;
    private boardHeight = 1;

    constructor(
        private readonly root: Node,
        private readonly actions: MazeChaseViewActions,
    ) {
        this.input = new MazeChaseInputController(root, actions);
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
        const cell = Math.max(8, Math.floor(Math.min(availableWidth / 17, availableHeight / 13)));
        this.boardWidth = cell * 17;
        this.boardHeight = cell * 13;
        const boardTop = contentTop - hudHeight;
        const boardCenterY = boardTop - this.boardHeight / 2;

        const statusNode = createLabel(
            this.root,
            '',
            Math.min(420, safeWidth - 20),
            compact ? 22 : 26,
            compact ? 13 : 15,
            palette.text,
            centerX,
            contentTop - 12,
            HorizontalTextAlignment.CENTER,
        );
        this.statusLabel = statusNode.getComponent(Label);
        const statsNode = createLabel(
            this.root,
            '',
            Math.min(520, safeWidth - 20),
            20,
            compact ? 9 : 11,
            palette.muted,
            centerX,
            contentTop - (compact ? 36 : 42),
        );
        this.statsLabel = statsNode.getComponent(Label);

        const board = createUiNode(
            this.root,
            'MazeChaseBoard',
            this.boardWidth,
            this.boardHeight,
            centerX,
            boardCenterY,
        );
        this.boardGraphics = board.addComponent(Graphics);

        const controlsY = boardCenterY - this.boardHeight / 2 - (compact ? 58 : 42);
        const buttonWidth = compact ? 68 : 76;
        const buttonHeight = compact ? 30 : 34;
        createButton(this.root, {
            name: 'MazeUp', text: 'UP', width: buttonWidth, height: buttonHeight,
            x: centerX, y: controlsY + (compact ? 38 : 0), fontSize: 10,
            variant: 'secondary', onPress: () => actions.setDirection('up'),
        });
        createButton(this.root, {
            name: 'MazeLeft', text: 'LEFT', width: buttonWidth, height: buttonHeight,
            x: centerX - (buttonWidth + 6), y: controlsY, fontSize: 10,
            variant: 'secondary', onPress: () => actions.setDirection('left'),
        });
        createButton(this.root, {
            name: 'MazeDown', text: 'DOWN', width: buttonWidth, height: buttonHeight,
            x: centerX, y: controlsY, fontSize: 10,
            variant: 'secondary', onPress: () => actions.setDirection('down'),
        });
        createButton(this.root, {
            name: 'MazeRight', text: 'RIGHT', width: buttonWidth, height: buttonHeight,
            x: centerX + (buttonWidth + 6), y: controlsY, fontSize: 10,
            variant: 'secondary', onPress: () => actions.setDirection('right'),
        });
        createButton(this.root, {
            name: 'MazeNew', text: 'NEW', width: buttonWidth, height: buttonHeight,
            x: centerX, y: controlsY - (compact ? 38 : 0), fontSize: 10,
            variant: 'secondary', onPress: () => actions.restart(),
        });

        const hintNode = createLabel(
            this.root,
            '',
            Math.min(600, safeWidth - 20),
            20,
            compact ? 8 : 10,
            palette.muted,
            centerX,
            safeBottom + 12,
        );
        this.hintLabel = hintNode.getComponent(Label);
    }

    render(state: MazeChaseViewState): void {
        if (!this.boardGraphics) {
            return;
        }
        this.statusLabel && (this.statusLabel.string = state.status);
        this.statsLabel && (this.statsLabel.string = `SCORE ${state.score}   LIVES ${state.lives}   ENERGY ${state.remainingPellets}`);
        this.hintLabel && (this.hintLabel.string = state.hint);
        const graphics = this.boardGraphics;
        const cell = this.boardWidth / state.width;
        graphics.clear();
        graphics.fillColor = palette.backgroundRaised;
        graphics.fillRect(-this.boardWidth / 2, -this.boardHeight / 2, this.boardWidth, this.boardHeight);
        for (let y = 0; y < state.height; y += 1) {
            for (let x = 0; x < state.width; x += 1) {
                const index = y * state.width + x;
                const left = -this.boardWidth / 2 + x * cell;
                const bottom = -this.boardHeight / 2 + y * cell;
                if (state.walls[index]) {
                    graphics.fillColor = palette.surfaceStrong;
                    graphics.fillRect(left + 1, bottom + 1, cell - 2, cell - 2);
                } else if (state.pellets[index]) {
                    graphics.fillColor = palette.warning;
                    graphics.circle(left + cell / 2, bottom + cell / 2, Math.max(1.5, cell * 0.1));
                    graphics.fill();
                }
            }
        }
        this.drawPlayer(graphics, state.player.x, state.player.y, state.direction, cell);
        for (const enemy of state.enemies) {
            const left = -this.boardWidth / 2 + enemy.x * cell + cell * 0.16;
            const bottom = -this.boardHeight / 2 + enemy.y * cell + cell * 0.16;
            graphics.fillColor = ENEMY_COLORS[enemy.kind];
            graphics.roundRect(left, bottom, cell * 0.68, cell * 0.68, cell * 0.15);
            graphics.fill();
            graphics.fillColor = palette.primaryText;
            graphics.circle(left + cell * 0.25, bottom + cell * 0.42, Math.max(1, cell * 0.055));
            graphics.circle(left + cell * 0.45, bottom + cell * 0.42, Math.max(1, cell * 0.055));
            graphics.fill();
        }
    }

    destroy(): void {
        this.input.destroy();
        this.boardGraphics = null;
        clearNode(this.root);
    }

    private drawPlayer(
        graphics: Graphics,
        x: number,
        y: number,
        direction: MazeChaseDirection,
        cell: number,
    ): void {
        const centerX = -this.boardWidth / 2 + (x + 0.5) * cell;
        const centerY = -this.boardHeight / 2 + (y + 0.5) * cell;
        const angle = direction === 'right'
            ? 0
            : direction === 'up'
                ? Math.PI / 2
                : direction === 'left'
                    ? Math.PI
                    : -Math.PI / 2;
        const radius = cell * 0.34;
        const points = [
            [radius, 0],
            [-radius * 0.7, radius * 0.7],
            [-radius * 0.45, 0],
            [-radius * 0.7, -radius * 0.7],
        ];
        graphics.fillColor = palette.accent;
        for (let index = 0; index < points.length; index += 1) {
            const [localX, localY] = points[index];
            const px = centerX + localX * Math.cos(angle) - localY * Math.sin(angle);
            const py = centerY + localX * Math.sin(angle) + localY * Math.cos(angle);
            if (index === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        }
        graphics.close();
        graphics.fill();
    }
}
