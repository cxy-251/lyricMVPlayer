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
import { BomberMazeInputController } from './BomberMazeInputController';
import type {
    BomberMazeCellKind,
    BomberMazeViewActions,
    BomberMazeViewState,
} from './BomberMazeTypes';

const SOFT_WALL = new Color(118, 90, 61, 255);
const FLOOR_A = new Color(35, 41, 39, 255);
const FLOOR_B = new Color(39, 46, 43, 255);
const ENEMY = new Color(184, 99, 103, 255);
const RANGE_POWERUP = new Color(211, 153, 78, 255);
const CAPACITY_POWERUP = new Color(109, 158, 184, 255);
const EXPLOSION_CORE = new Color(244, 202, 100, 255);
const EXPLOSION_EDGE = new Color(209, 104, 78, 255);

export class BomberMazeView {
    private readonly input: BomberMazeInputController;
    private graphics: Graphics | null = null;
    private statusLabel: Label | null = null;
    private statsLabel: Label | null = null;
    private hintLabel: Label | null = null;
    private boardWidth = 1;
    private boardHeight = 1;

    constructor(
        private readonly root: Node,
        private readonly actions: BomberMazeViewActions,
    ) {
        this.input = new BomberMazeInputController(root, actions);
    }

    layout(viewport: ViewportSnapshot): void {
        clearNode(this.root);
        fillNode(this.root, viewport.width, viewport.height, palette.background);
        this.graphics = null;
        this.statusLabel = null;
        this.statsLabel = null;
        this.hintLabel = null;

        const compact = viewport.breakpoint === 'compact';
        const safeWidth = viewport.width - viewport.safeInsets.left - viewport.safeInsets.right;
        const safeTop = viewport.height / 2 - viewport.safeInsets.top;
        const safeBottom = -viewport.height / 2 + viewport.safeInsets.bottom;
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const contentTop = safeTop - (compact ? 66 : 74);
        const hudHeight = compact ? 60 : 68;
        const controlsHeight = compact ? 126 : 84;
        const footerHeight = 26;
        const availableHeight = Math.max(
            100,
            contentTop - safeBottom - hudHeight - controlsHeight - footerHeight,
        );
        const availableWidth = Math.max(100, safeWidth - (compact ? 18 : 42));
        const cell = Math.max(
            8,
            Math.floor(Math.min(availableWidth / 13, availableHeight / 11)),
        );
        this.boardWidth = cell * 13;
        this.boardHeight = cell * 11;
        const boardTop = contentTop - hudHeight;
        const boardCenterY = boardTop - this.boardHeight / 2;

        this.statusLabel = createLabel(
            this.root,
            '',
            Math.min(520, safeWidth - 20),
            compact ? 22 : 26,
            compact ? 13 : 15,
            palette.text,
            centerX,
            contentTop - 12,
            HorizontalTextAlignment.CENTER,
        ).getComponent(Label);
        this.statsLabel = createLabel(
            this.root,
            '',
            Math.min(700, safeWidth - 20),
            22,
            compact ? 8 : 10,
            palette.muted,
            centerX,
            contentTop - (compact ? 38 : 44),
        ).getComponent(Label);

        const board = createUiNode(
            this.root,
            'BomberMazeBoard',
            this.boardWidth,
            this.boardHeight,
            centerX,
            boardCenterY,
        );
        this.graphics = board.addComponent(Graphics);

        const controlsY = boardCenterY - this.boardHeight / 2 - (compact ? 62 : 43);
        const buttonWidth = compact ? 66 : 76;
        const buttonHeight = compact ? 30 : 34;
        createButton(this.root, {
            name: 'BomberUp',
            text: 'UP',
            width: buttonWidth,
            height: buttonHeight,
            x: centerX,
            y: controlsY + (compact ? 40 : 0),
            fontSize: 10,
            variant: 'secondary',
            onPress: () => this.actions.move('up'),
        });
        createButton(this.root, {
            name: 'BomberLeft',
            text: 'LEFT',
            width: buttonWidth,
            height: buttonHeight,
            x: centerX - buttonWidth - 6,
            y: controlsY,
            fontSize: 10,
            variant: 'secondary',
            onPress: () => this.actions.move('left'),
        });
        createButton(this.root, {
            name: 'BomberDown',
            text: 'DOWN',
            width: buttonWidth,
            height: buttonHeight,
            x: centerX,
            y: controlsY,
            fontSize: 10,
            variant: 'secondary',
            onPress: () => this.actions.move('down'),
        });
        createButton(this.root, {
            name: 'BomberRight',
            text: 'RIGHT',
            width: buttonWidth,
            height: buttonHeight,
            x: centerX + buttonWidth + 6,
            y: controlsY,
            fontSize: 10,
            variant: 'secondary',
            onPress: () => this.actions.move('right'),
        });
        createButton(this.root, {
            name: 'BomberBomb',
            text: 'BOMB',
            width: compact ? 82 : 94,
            height: buttonHeight,
            x: centerX - (compact ? 48 : 56),
            y: controlsY - (compact ? 40 : 42),
            fontSize: 10,
            variant: 'danger',
            onPress: () => this.actions.placeBomb(),
        });
        createButton(this.root, {
            name: 'BomberNew',
            text: 'NEW',
            width: compact ? 82 : 94,
            height: buttonHeight,
            x: centerX + (compact ? 48 : 56),
            y: controlsY - (compact ? 40 : 42),
            fontSize: 10,
            variant: 'secondary',
            onPress: () => this.actions.restart(),
        });

        this.hintLabel = createLabel(
            this.root,
            '',
            Math.min(680, safeWidth - 20),
            22,
            compact ? 8 : 10,
            palette.muted,
            centerX,
            safeBottom + 12,
        ).getComponent(Label);
    }

    render(state: BomberMazeViewState): void {
        const graphics = this.graphics;
        if (!graphics) {
            return;
        }
        if (this.statusLabel) {
            this.statusLabel.string = state.status;
        }
        if (this.statsLabel) {
            this.statsLabel.string = state.stats;
        }
        if (this.hintLabel) {
            this.hintLabel.string = state.hint;
        }

        const cell = this.boardWidth / state.width;
        graphics.clear();
        for (let y = 0; y < state.height; y += 1) {
            for (let x = 0; x < state.width; x += 1) {
                const kind = state.cells[y * state.width + x];
                this.drawCell(graphics, kind, x, y, cell);
            }
        }

        for (const powerup of state.powerups) {
            const center = this.center(powerup.x, powerup.y, cell);
            graphics.fillColor = powerup.kind === 'range'
                ? RANGE_POWERUP
                : CAPACITY_POWERUP;
            graphics.circle(center.x, center.y, cell * 0.25);
            graphics.fill();
            graphics.strokeColor = palette.primaryText;
            graphics.lineWidth = Math.max(1, cell * 0.06);
            if (powerup.kind === 'range') {
                graphics.moveTo(center.x - cell * 0.12, center.y);
                graphics.lineTo(center.x + cell * 0.12, center.y);
                graphics.moveTo(center.x, center.y - cell * 0.12);
                graphics.lineTo(center.x, center.y + cell * 0.12);
            } else {
                graphics.circle(center.x, center.y, cell * 0.1);
            }
            graphics.stroke();
        }

        for (const bomb of state.bombs) {
            const center = this.center(bomb.x, bomb.y, cell);
            graphics.fillColor = palette.surfaceStrong;
            graphics.circle(center.x, center.y, cell * 0.29);
            graphics.fill();
            graphics.strokeColor = bomb.fuse < 0.65 ? palette.danger : palette.warning;
            graphics.lineWidth = Math.max(1, cell * 0.06);
            graphics.moveTo(center.x + cell * 0.12, center.y + cell * 0.2);
            graphics.lineTo(center.x + cell * 0.25, center.y + cell * 0.34);
            graphics.stroke();
        }

        for (const explosion of state.explosions) {
            const center = this.center(explosion.x, explosion.y, cell);
            graphics.fillColor = EXPLOSION_EDGE;
            graphics.roundRect(
                center.x - cell * 0.42,
                center.y - cell * 0.42,
                cell * 0.84,
                cell * 0.84,
                cell * 0.18,
            );
            graphics.fill();
            graphics.fillColor = EXPLOSION_CORE;
            graphics.circle(center.x, center.y, cell * 0.24);
            graphics.fill();
        }

        for (const enemy of state.enemies) {
            const center = this.center(enemy.x, enemy.y, cell);
            graphics.fillColor = ENEMY;
            graphics.roundRect(
                center.x - cell * 0.3,
                center.y - cell * 0.28,
                cell * 0.6,
                cell * 0.56,
                cell * 0.16,
            );
            graphics.fill();
            graphics.fillColor = palette.primaryText;
            graphics.circle(center.x - cell * 0.11, center.y + cell * 0.07, cell * 0.045);
            graphics.circle(center.x + cell * 0.11, center.y + cell * 0.07, cell * 0.045);
            graphics.fill();
        }

        const player = this.center(state.player.x, state.player.y, cell);
        graphics.fillColor = state.invulnerable ? palette.warning : palette.accent;
        graphics.circle(player.x, player.y, cell * 0.31);
        graphics.fill();
        graphics.fillColor = palette.primaryText;
        graphics.circle(player.x - cell * 0.1, player.y + cell * 0.07, cell * 0.04);
        graphics.circle(player.x + cell * 0.1, player.y + cell * 0.07, cell * 0.04);
        graphics.fill();
    }

    destroy(): void {
        this.input.destroy();
        this.graphics = null;
        clearNode(this.root);
    }

    private drawCell(
        graphics: Graphics,
        kind: BomberMazeCellKind,
        x: number,
        y: number,
        cell: number,
    ): void {
        const left = -this.boardWidth / 2 + x * cell;
        const bottom = -this.boardHeight / 2 + y * cell;
        graphics.fillColor = (x + y) % 2 === 0 ? FLOOR_A : FLOOR_B;
        graphics.fillRect(left, bottom, cell, cell);

        if (kind === 'hard-wall') {
            graphics.fillColor = palette.surfaceStrong;
            graphics.roundRect(
                left + cell * 0.06,
                bottom + cell * 0.06,
                cell * 0.88,
                cell * 0.88,
                cell * 0.12,
            );
            graphics.fill();
            graphics.strokeColor = palette.borderStrong;
            graphics.lineWidth = 1;
            graphics.rect(
                left + cell * 0.12,
                bottom + cell * 0.12,
                cell * 0.76,
                cell * 0.76,
            );
            graphics.stroke();
        } else if (kind === 'soft-wall') {
            graphics.fillColor = SOFT_WALL;
            graphics.roundRect(
                left + cell * 0.09,
                bottom + cell * 0.09,
                cell * 0.82,
                cell * 0.82,
                cell * 0.08,
            );
            graphics.fill();
            graphics.strokeColor = palette.warning;
            graphics.lineWidth = Math.max(1, cell * 0.045);
            graphics.moveTo(left + cell * 0.18, bottom + cell * 0.25);
            graphics.lineTo(left + cell * 0.82, bottom + cell * 0.75);
            graphics.moveTo(left + cell * 0.18, bottom + cell * 0.75);
            graphics.lineTo(left + cell * 0.82, bottom + cell * 0.25);
            graphics.stroke();
        }
    }

    private center(x: number, y: number, cell: number): { x: number; y: number } {
        return {
            x: -this.boardWidth / 2 + (x + 0.5) * cell,
            y: -this.boardHeight / 2 + (y + 0.5) * cell,
        };
    }
}
