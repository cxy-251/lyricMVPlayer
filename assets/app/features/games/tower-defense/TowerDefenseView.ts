import {
    Color,
    EventMouse,
    EventTouch,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Node,
    UITransform,
    Vec3,
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
import { TowerDefenseModel } from './TowerDefenseModel';
import type {
    TowerDefenseBoardLayout,
    TowerDefensePoint,
    TowerDefenseViewActions,
    TowerDefenseViewState,
} from './TowerDefenseTypes';

const PATH_COLOR = new Color(78, 88, 83, 255);
const PATH_EDGE = new Color(112, 124, 117, 255);
const DART_COLOR = new Color(116, 169, 143, 255);
const CANNON_COLOR = new Color(198, 143, 88, 255);
const ENEMY_COLOR = new Color(190, 102, 102, 255);
const ENEMY_HEAVY = new Color(150, 91, 126, 255);

export class TowerDefenseView {
    private graphics: Graphics | null = null;
    private statusLabel: Label | null = null;
    private statsLabel: Label | null = null;
    private hintLabel: Label | null = null;
    private boardLayout: TowerDefenseBoardLayout | null = null;
    private latestState: TowerDefenseViewState | null = null;
    private readonly screenPoint = new Vec3();

    constructor(
        private readonly root: Node,
        private readonly actions: TowerDefenseViewActions,
    ) {
        root.on(Node.EventType.MOUSE_DOWN, this.handleMouseDown, this);
        root.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    }

    layout(viewport: ViewportSnapshot): void {
        clearNode(this.root);
        fillNode(this.root, viewport.width, viewport.height, palette.background);
        this.graphics = null;
        this.statusLabel = null;
        this.statsLabel = null;
        this.hintLabel = null;

        const compact = viewport.breakpoint === 'compact';
        const safeWidth = Math.max(
            2,
            viewport.width - viewport.safeInsets.left - viewport.safeInsets.right,
        );
        const safeTop = viewport.height / 2 - viewport.safeInsets.top;
        const safeBottom = -viewport.height / 2 + viewport.safeInsets.bottom;
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const contentTop = safeTop - (compact ? 64 : 72);
        const contentBottom = safeBottom + (compact ? 142 : 116);
        const hudHeight = compact ? 72 : 82;
        const boardAreaHeight = Math.max(1, contentTop - contentBottom - hudHeight);
        const cellSize = Math.max(1, Math.floor(Math.min(
            Math.max(1, safeWidth - (compact ? 18 : 36)) / 12,
            boardAreaHeight / 8,
        )));
        const boardWidth = cellSize * 12;
        const boardHeight = cellSize * 8;
        const boardTop = contentTop - hudHeight;
        const boardBottom = boardTop - boardHeight;
        const boardCenterY = (boardTop + boardBottom) / 2;

        this.boardLayout = {
            left: centerX - boardWidth / 2,
            bottom: boardBottom,
            width: boardWidth,
            height: boardHeight,
            cellSize,
        };

        this.statusLabel = createLabel(
            this.root,
            '',
            Math.max(1, Math.min(safeWidth - 24, 620)),
            compact ? 22 : 28,
            compact ? 13 : 16,
            palette.text,
            centerX,
            contentTop - (compact ? 13 : 16),
            HorizontalTextAlignment.CENTER,
        ).getComponent(Label);
        this.statsLabel = createLabel(
            this.root,
            '',
            Math.max(1, Math.min(safeWidth - 24, 720)),
            compact ? 18 : 22,
            compact ? 9 : 11,
            palette.muted,
            centerX,
            contentTop - (compact ? 39 : 46),
        ).getComponent(Label);
        this.hintLabel = createLabel(
            this.root,
            '',
            Math.max(1, Math.min(safeWidth - 24, 760)),
            compact ? 18 : 22,
            compact ? 9 : 10,
            palette.muted,
            centerX,
            boardBottom - (compact ? 16 : 20),
        ).getComponent(Label);

        const boardNode = createUiNode(
            this.root,
            'TowerDefenseBoard',
            boardWidth,
            boardHeight,
            centerX,
            boardCenterY,
        );
        this.graphics = boardNode.addComponent(Graphics);

        const columns = compact ? 3 : 6;
        const gap = compact ? 6 : 8;
        const buttonWidth = Math.max(
            44,
            Math.min(
                compact ? 92 : 84,
                (safeWidth - gap * (columns - 1) - 24) / columns,
            ),
        );
        const totalWidth = buttonWidth * columns + gap * (columns - 1);
        const startX = centerX - totalWidth / 2 + buttonWidth / 2;
        const controlsY = safeBottom + (compact ? 83 : 82);
        const rowGap = compact ? 40 : 0;
        const buttonSpecs: Array<{
            name: string;
            text: string;
            onPress: () => void;
            variant?: 'primary' | 'secondary';
        }> = [
            {
                name: 'TowerDefenseDart',
                text: 'DART',
                onPress: () => this.actions.selectKind('dart'),
                variant: 'secondary',
            },
            {
                name: 'TowerDefenseCannon',
                text: 'CANNON',
                onPress: () => this.actions.selectKind('cannon'),
                variant: 'secondary',
            },
            {
                name: 'TowerDefenseBuild',
                text: 'BUILD',
                onPress: () => this.actions.buildSelected(),
                variant: 'primary',
            },
            {
                name: 'TowerDefenseUpgrade',
                text: 'UP',
                onPress: () => this.actions.upgradeSelected(),
                variant: 'secondary',
            },
            {
                name: 'TowerDefenseWave',
                text: 'WAVE',
                onPress: () => this.actions.startWave(),
                variant: 'secondary',
            },
            {
                name: 'TowerDefenseNew',
                text: 'NEW',
                onPress: () => this.actions.restart(),
                variant: 'secondary',
            },
        ];
        buttonSpecs.forEach((spec, index) => {
            const row = compact ? Math.floor(index / columns) : 0;
            const column = compact ? index % columns : index;
            createButton(this.root, {
                name: spec.name,
                text: spec.text,
                width: buttonWidth,
                height: compact ? 34 : 38,
                x: startX + column * (buttonWidth + gap),
                y: controlsY - row * rowGap,
                fontSize: compact ? 9 : 10,
                variant: spec.variant,
                onPress: spec.onPress,
            });
        });

        if (this.latestState) {
            this.render(this.latestState);
        }
    }

    render(state: TowerDefenseViewState): void {
        this.latestState = state;
        const graphics = this.graphics;
        const layout = this.boardLayout;
        if (!graphics || !layout) {
            return;
        }

        graphics.clear();
        graphics.fillColor = palette.backgroundRaised;
        graphics.fillRect(
            -layout.width / 2,
            -layout.height / 2,
            layout.width,
            layout.height,
        );

        const cell = layout.cellSize;
        for (const point of state.path) {
            const center = this.boardPoint(point, layout);
            graphics.fillColor = PATH_COLOR;
            graphics.roundRect(
                center.x - cell * 0.47,
                center.y - cell * 0.47,
                cell * 0.94,
                cell * 0.94,
                cell * 0.16,
            );
            graphics.fill();
            graphics.strokeColor = PATH_EDGE;
            graphics.lineWidth = 1;
            graphics.roundRect(
                center.x - cell * 0.47,
                center.y - cell * 0.47,
                cell * 0.94,
                cell * 0.94,
                cell * 0.16,
            );
            graphics.stroke();
        }

        const selected = state.slots.find((slot) => slot.id === state.selectedSlotId);
        if (selected) {
            const center = this.boardPoint(selected, layout);
            const range = selected.tower
                ? TowerDefenseModel.towerRange(selected.tower.kind, selected.tower.level)
                : TowerDefenseModel.towerRange(state.selectedKind, 1);
            graphics.strokeColor = state.controller === 'human' ? palette.accent : palette.subtle;
            graphics.lineWidth = 1.5;
            graphics.circle(center.x, center.y, range * cell);
            graphics.stroke();
        }

        for (const slot of state.slots) {
            const center = this.boardPoint(slot, layout);
            const selectedSlot = slot.id === state.selectedSlotId;
            graphics.fillColor = slot.tower
                ? slot.tower.kind === 'dart' ? DART_COLOR : CANNON_COLOR
                : palette.surfaceStrong;
            graphics.circle(center.x, center.y, cell * (slot.tower ? 0.3 : 0.2));
            graphics.fill();
            graphics.strokeColor = selectedSlot ? palette.accent : palette.borderStrong;
            graphics.lineWidth = selectedSlot ? 2.5 : 1.2;
            graphics.circle(center.x, center.y, cell * (slot.tower ? 0.34 : 0.25));
            graphics.stroke();

            if (slot.tower) {
                graphics.strokeColor = palette.primaryText;
                graphics.lineWidth = Math.max(1.5, cell * 0.07);
                if (slot.tower.kind === 'dart') {
                    graphics.moveTo(center.x - cell * 0.16, center.y);
                    graphics.lineTo(center.x + cell * 0.2, center.y);
                } else {
                    graphics.moveTo(center.x, center.y - cell * 0.15);
                    graphics.lineTo(center.x, center.y + cell * 0.2);
                }
                graphics.stroke();
                for (let level = 0; level < slot.tower.level; level += 1) {
                    graphics.fillColor = palette.primaryText;
                    graphics.circle(
                        center.x + (level - (slot.tower.level - 1) / 2) * cell * 0.11,
                        center.y - cell * 0.22,
                        Math.max(1.2, cell * 0.035),
                    );
                    graphics.fill();
                }
            }
        }

        for (const shot of state.shots) {
            const from = this.boardPoint({ x: shot.fromX, y: shot.fromY }, layout);
            const to = this.boardPoint({ x: shot.toX, y: shot.toY }, layout);
            graphics.strokeColor = shot.kind === 'dart' ? DART_COLOR : CANNON_COLOR;
            graphics.lineWidth = shot.kind === 'dart' ? 2 : 4;
            graphics.moveTo(from.x, from.y);
            graphics.lineTo(to.x, to.y);
            graphics.stroke();
        }

        for (const enemy of state.enemies) {
            const point = this.positionAt(state.path, enemy.progress);
            const center = this.boardPoint(point, layout);
            const ratio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
            const heavy = enemy.maxHp > 150;
            graphics.fillColor = heavy ? ENEMY_HEAVY : ENEMY_COLOR;
            graphics.roundRect(
                center.x - cell * 0.25,
                center.y - cell * 0.22,
                cell * 0.5,
                cell * 0.44,
                cell * 0.12,
            );
            graphics.fill();
            graphics.fillColor = palette.borderStrong;
            graphics.fillRect(
                center.x - cell * 0.28,
                center.y + cell * 0.27,
                cell * 0.56,
                Math.max(2, cell * 0.07),
            );
            graphics.fillColor = palette.accent;
            graphics.fillRect(
                center.x - cell * 0.28,
                center.y + cell * 0.27,
                cell * 0.56 * ratio,
                Math.max(2, cell * 0.07),
            );
        }

        const entrance = this.boardPoint(state.path[0], layout);
        const exit = this.boardPoint(state.path[state.path.length - 1], layout);
        graphics.fillColor = palette.accent;
        graphics.circle(entrance.x, entrance.y, cell * 0.15);
        graphics.fill();
        graphics.fillColor = palette.danger;
        graphics.circle(exit.x, exit.y, cell * 0.17);
        graphics.fill();

        if (this.statusLabel) {
            this.statusLabel.string = state.status;
            this.statusLabel.color = state.phase === 'lost'
                ? palette.danger
                : state.phase === 'won'
                    ? palette.accent
                    : palette.text;
        }
        if (this.statsLabel) {
            this.statsLabel.string = state.stats;
        }
        if (this.hintLabel) {
            this.hintLabel.string = state.hint;
        }
    }

    destroy(): void {
        this.root.off(Node.EventType.MOUSE_DOWN, this.handleMouseDown, this);
        this.root.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
        this.latestState = null;
        clearNode(this.root);
    }

    private readonly handleMouseDown = (event: EventMouse): void => {
        if (event.getButton() === EventMouse.BUTTON_RIGHT) {
            return;
        }
        const location = event.getUILocation();
        this.selectAt(location.x, location.y);
    };

    private readonly handleTouchEnd = (event: EventTouch): void => {
        const location = event.getUILocation();
        this.selectAt(location.x, location.y);
    };

    private selectAt(screenX: number, screenY: number): void {
        const layout = this.boardLayout;
        const state = this.latestState;
        const transform = this.root.getComponent(UITransform);
        if (!layout || !state || !transform) {
            return;
        }
        this.screenPoint.set(screenX, screenY, 0);
        const local = transform.convertToNodeSpaceAR(this.screenPoint);
        if (
            local.x < layout.left
            || local.x > layout.left + layout.width
            || local.y < layout.bottom
            || local.y > layout.bottom + layout.height
        ) {
            return;
        }

        const boardX = (local.x - layout.left) / layout.cellSize - 0.5;
        const boardY = (local.y - layout.bottom) / layout.cellSize - 0.5;
        let bestId = -1;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const slot of state.slots) {
            const dx = slot.x - boardX;
            const dy = slot.y - boardY;
            const distance = dx * dx + dy * dy;
            if (distance < bestDistance) {
                bestDistance = distance;
                bestId = slot.id;
            }
        }
        if (bestId >= 0 && bestDistance <= 0.75 * 0.75) {
            this.actions.selectSlot(bestId);
        }
    }

    private boardPoint(
        point: TowerDefensePoint,
        layout: TowerDefenseBoardLayout,
    ): TowerDefensePoint {
        return {
            x: -layout.width / 2 + (point.x + 0.5) * layout.cellSize,
            y: -layout.height / 2 + (point.y + 0.5) * layout.cellSize,
        };
    }

    private positionAt(
        path: readonly TowerDefensePoint[],
        progress: number,
    ): TowerDefensePoint {
        const maxIndex = path.length - 1;
        const clamped = Math.max(0, Math.min(maxIndex, progress));
        const index = Math.min(maxIndex - 1, Math.floor(clamped));
        const local = clamped - index;
        const first = path[index];
        const second = path[Math.min(maxIndex, index + 1)];
        return {
            x: first.x + (second.x - first.x) * local,
            y: first.y + (second.y - first.y) * local,
        };
    }
}
