import {
    Color,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Node,
} from 'cc';
import {
    ParameterPanel,
    type ParameterPanelLayout,
} from '../../../parameters/ParameterPanel';
import type { ParameterSchema } from '../../../parameters/ParameterSchema';
import type {
    ViewportBreakpoint,
    ViewportSnapshot,
} from '../../../services/ViewportService';
import { LabTabBar } from '../../../ui/LabTabBar';
import {
    clearNode,
    createLabel,
    createUiNode,
    fillNode,
    palette,
    strokeNode,
} from '../../../ui/UiFactory';
import type {
    MechanicalLinkageKind,
    MechanicalLinkageSample,
    MechanismPoint,
    SliderCrankViewState,
} from './SliderCrankTypes';
import {
    MECHANICAL_LINKAGE_TABS,
    type SliderCrankViewModel,
} from './SliderCrankViewModel';

const CONTENT_GAP = 14;
const SIDE_INFO_HEIGHT = 162;
const INPUT_COLOR = new Color(92, 151, 211, 255);
const COUPLER_COLOR = new Color(210, 167, 96, 255);
const OUTPUT_COLOR = new Color(126, 190, 166, 255);
const VELOCITY_COLOR = new Color(126, 190, 166, 235);
const ACCELERATION_COLOR = new Color(224, 151, 72, 235);
const POSITION_COLOR = new Color(231, 235, 227, 220);
const TRACE_COLOR = new Color(164, 181, 205, 130);
const GHOST_COLOR = new Color(180, 188, 181, 80);
const SHADOW_COLOR = new Color(16, 20, 27, 180);
const TAU = Math.PI * 2;

interface MechanismTransform {
    readonly scale: number;
    point(point: MechanismPoint): MechanismPoint;
}

interface WorldBounds {
    readonly minimumX: number;
    readonly maximumX: number;
    readonly minimumY: number;
    readonly maximumY: number;
}

export interface SliderCrankViewActions {
    mechanismChanged(mechanism: MechanicalLinkageKind): void;
    parameterChanged(key: string): void;
    reportError(error: unknown): void;
}

export class SliderCrankView {
    private parameterPanel: ParameterPanel | null = null;
    private tabBar: LabTabBar<MechanicalLinkageKind> | null = null;
    private parameterPanelParent: Node | null = null;
    private parameterPanelLayout: ParameterPanelLayout | null = null;
    private mechanismGraphics: Graphics | null = null;
    private curveGraphics: Graphics | null = null;
    private overlayGraphics: Graphics | null = null;
    private diagnosticsLabel: Label | null = null;
    private modelLabel: Label | null = null;
    private plotWidth = 1;
    private plotHeight = 1;

    constructor(
        private readonly root: Node,
        private readonly parameterSchema: ParameterSchema,
        private readonly viewModel: SliderCrankViewModel,
        private readonly actions: SliderCrankViewActions,
    ) {}

    layout(viewport: ViewportSnapshot): void {
        this.parameterPanel?.destroy();
        this.tabBar?.destroy();
        this.parameterPanel = null;
        this.tabBar = null;
        this.parameterPanelParent = null;
        this.parameterPanelLayout = null;
        this.mechanismGraphics = null;
        this.curveGraphics = null;
        this.overlayGraphics = null;
        this.diagnosticsLabel = null;
        this.modelLabel = null;
        clearNode(this.root);
        this.root.setPosition(0, 0, 0);
        fillNode(this.root, viewport.width, viewport.height, palette.background);

        const compact = viewport.breakpoint === 'compact';
        const safeWidth = Math.max(
            1,
            viewport.width - viewport.safeInsets.left - viewport.safeInsets.right,
        );
        const contentWidth = Math.max(
            1,
            Math.min(1320, safeWidth - (compact ? 32 : 72)),
        );
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const contentTop = viewport.height / 2
            - viewport.safeInsets.top
            - (compact ? 70 : 78);
        const contentBottom = -viewport.height / 2
            + viewport.safeInsets.bottom
            + 12;
        const contentHeight = Math.max(1, contentTop - contentBottom);
        const centerY = (contentTop + contentBottom) / 2;
        const sideInspector = viewport.orientation === 'landscape'
            && safeWidth >= 940
            && contentHeight >= 620;

        if (sideInspector) {
            this.layoutSideBySide(
                centerX,
                centerY,
                contentWidth,
                contentHeight,
                viewport.breakpoint,
            );
        } else {
            this.layoutStacked(
                centerX,
                contentTop,
                contentBottom,
                contentWidth,
                contentHeight,
                viewport.breakpoint,
            );
        }
        this.rebuildParameterPanel();
    }

    render(state: SliderCrankViewState): void {
        if (!this.mechanismGraphics || !this.curveGraphics || !this.overlayGraphics) {
            return;
        }
        this.renderTabs(state.mechanism);
        this.drawMechanism(state);
        this.drawCurves(state);
        if (this.diagnosticsLabel) this.diagnosticsLabel.string = state.diagnosticsText;
        if (this.modelLabel) this.modelLabel.string = state.modelSummary;
    }

    refreshParameterPanel(): void {
        this.rebuildParameterPanel();
    }

    destroy(): void {
        this.parameterPanel?.destroy();
        this.tabBar?.destroy();
        this.parameterPanel = null;
        this.tabBar = null;
        clearNode(this.root);
    }

    private layoutSideBySide(
        centerX: number,
        centerY: number,
        contentWidth: number,
        contentHeight: number,
        breakpoint: ViewportBreakpoint,
    ): void {
        const inspectorWidth = Math.min(380, Math.max(330, contentWidth * 0.29));
        this.plotWidth = Math.max(1, contentWidth - inspectorWidth - CONTENT_GAP);
        this.plotHeight = contentHeight;
        const leftEdge = centerX - contentWidth / 2;
        const plot = this.createPlot(leftEdge + this.plotWidth / 2, centerY);
        const inspector = this.createInspector(
            inspectorWidth,
            contentHeight,
            leftEdge + this.plotWidth + CONTENT_GAP + inspectorWidth / 2,
            centerY,
            false,
            SIDE_INFO_HEIGHT,
        );
        const parameterHeight = Math.max(
            1,
            contentHeight - SIDE_INFO_HEIGHT - CONTENT_GAP - 8,
        );
        this.parameterPanelParent = inspector;
        this.parameterPanelLayout = {
            width: inspectorWidth - 16,
            height: parameterHeight,
            x: 0,
            y: -contentHeight / 2 + 8 + parameterHeight / 2,
            breakpoint: 'compact',
        };
        this.createGraphicsLayers(plot);
        this.createTabs(plot);
        this.createOverlays(plot, breakpoint === 'compact');
    }

    private layoutStacked(
        centerX: number,
        contentTop: number,
        contentBottom: number,
        contentWidth: number,
        contentHeight: number,
        breakpoint: ViewportBreakpoint,
    ): void {
        const panelBreakpoint: ViewportBreakpoint = breakpoint === 'wide'
            ? 'medium'
            : breakpoint;
        const parameterHeight = ParameterPanel.measureHeight(
            this.parameterSchema.length,
            contentWidth,
            panelBreakpoint,
        );
        const infoHeight = contentWidth >= 620 ? 126 : 162;
        const inspectorHeight = infoHeight + CONTENT_GAP + parameterHeight;
        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(300, contentHeight - inspectorHeight - CONTENT_GAP);
        const plot = this.createPlot(
            centerX,
            contentTop - this.plotHeight / 2,
        );
        const inspector = this.createInspector(
            contentWidth,
            inspectorHeight,
            centerX,
            contentBottom + inspectorHeight / 2,
            true,
            infoHeight,
        );
        this.parameterPanelParent = inspector;
        this.parameterPanelLayout = {
            width: contentWidth,
            x: 0,
            y: -inspectorHeight / 2 + parameterHeight / 2,
            breakpoint: panelBreakpoint,
        };
        this.createGraphicsLayers(plot);
        this.createTabs(plot);
        this.createOverlays(plot, breakpoint === 'compact');
    }

    private createPlot(x: number, y: number): Node {
        const plot = createUiNode(
            this.root,
            'MechanicalLinkagesPlot',
            this.plotWidth,
            this.plotHeight,
            x,
            y,
        );
        const radius = Math.min(10, this.plotWidth / 2, this.plotHeight / 2);
        fillNode(plot, this.plotWidth, this.plotHeight, palette.surface, radius);
        strokeNode(plot, this.plotWidth, this.plotHeight, palette.border, radius, 1);
        return plot;
    }

    private createGraphicsLayers(plot: Node): void {
        this.mechanismGraphics = this.createGraphics(plot, 'MechanicalLinkage');
        this.curveGraphics = this.createGraphics(plot, 'MechanicalCurves');
        this.overlayGraphics = this.createGraphics(plot, 'MechanicalOverlay');
    }

    private createTabs(plot: Node): void {
        this.tabBar = new LabTabBar(
            plot,
            MECHANICAL_LINKAGE_TABS,
            (mechanism) => this.actions.mechanismChanged(mechanism),
        );
    }

    private createInspector(
        width: number,
        height: number,
        x: number,
        y: number,
        horizontal: boolean,
        infoHeight: number,
    ): Node {
        const inspector = createUiNode(
            this.root,
            'MechanicalLinkagesInspector',
            width,
            height,
            x,
            y,
        );
        const card = createUiNode(
            inspector,
            'MechanicalLinkagesInfoCard',
            width,
            infoHeight,
            0,
            height / 2 - infoHeight / 2,
        );
        fillNode(card, width, infoHeight, palette.surfaceSoft, 9);
        strokeNode(card, width, infoHeight, palette.border, 9, 1);
        createLabel(
            card,
            'MECHANICAL LINKAGES · EIGHT KINEMATIC SYSTEMS',
            Math.max(1, width - 24),
            22,
            horizontal ? 9 : 10,
            palette.subtle,
            0,
            infoHeight / 2 - 17,
            HorizontalTextAlignment.LEFT,
        );
        const mechanisms = [
            'reciprocating: slider–crank · Scotch yoke · quick return',
            'linkages: four-bar · cam follower',
            'intermittent: Geneva · ratchet',
            'variable ratio: conjugate elliptic gears',
        ].join('\n');
        const explanation = [
            'use the top tabs to switch mechanisms',
            'blue: input · amber: coupler · green: output',
            'curves show output, velocity and acceleration',
        ].join('\n');
        if (horizontal && width >= 650) {
            this.createMultilineLabel(
                card,
                mechanisms,
                width * 0.55,
                infoHeight - 34,
                9,
                palette.primaryText,
                -width * 0.22,
                -7,
                15,
            );
            this.createMultilineLabel(
                card,
                explanation,
                width * 0.39,
                infoHeight - 34,
                9,
                palette.muted,
                width * 0.29,
                -7,
                15,
            );
        } else {
            this.createMultilineLabel(
                card,
                mechanisms,
                Math.max(1, width - 24),
                68,
                9,
                palette.primaryText,
                0,
                infoHeight / 2 - 62,
                15,
            );
            this.createMultilineLabel(
                card,
                explanation,
                Math.max(1, width - 24),
                Math.max(1, infoHeight - 92),
                9,
                palette.muted,
                0,
                -infoHeight / 2 + Math.max(1, infoHeight - 92) / 2 + 5,
                14,
            );
        }
        return inspector;
    }

    private createOverlays(plot: Node, compact: boolean): void {
        const statusWidth = Math.min(720, Math.max(1, this.plotWidth - 28));
        const statusHeight = compact ? 54 : 60;
        const status = createUiNode(
            plot,
            'MechanicalLinkagesStatus',
            statusWidth,
            statusHeight,
            -this.plotWidth / 2 + statusWidth / 2 + 14,
            -this.plotHeight / 2 + statusHeight / 2 + 14,
        );
        fillNode(status, statusWidth, statusHeight, palette.backgroundRaised, 7);
        strokeNode(status, statusWidth, statusHeight, palette.border, 7, 1);
        this.modelLabel = createLabel(
            status,
            '',
            statusWidth - 18,
            22,
            compact ? 8 : 10,
            palette.primaryText,
            0,
            13,
            HorizontalTextAlignment.LEFT,
        ).getComponent(Label);
        this.diagnosticsLabel = createLabel(
            status,
            '',
            statusWidth - 18,
            22,
            compact ? 8 : 9,
            palette.muted,
            0,
            -13,
            HorizontalTextAlignment.LEFT,
        ).getComponent(Label);
        if (this.modelLabel) this.modelLabel.enableWrapText = false;
        if (this.diagnosticsLabel) this.diagnosticsLabel.enableWrapText = false;
    }

    private renderTabs(active: MechanicalLinkageKind): void {
        const width = Math.max(1, this.plotWidth - 24);
        const height = LabTabBar.measureHeight(MECHANICAL_LINKAGE_TABS.length, width);
        this.tabBar?.render(
            width,
            this.plotHeight / 2 - height / 2 - 10,
            active,
        );
    }

    private tabHeight(): number {
        return LabTabBar.measureHeight(
            MECHANICAL_LINKAGE_TABS.length,
            Math.max(1, this.plotWidth - 24),
        );
    }

    private drawMechanism(state: SliderCrankViewState): void {
        const graphics = this.mechanismGraphics;
        if (!graphics) return;
        graphics.clear();
        const transform = this.createMechanismTransform(state);
        if (state.showTrace) this.drawTrace(graphics, state, transform);
        switch (state.sample.mechanism) {
            case 'four-bar':
                this.drawFourBar(graphics, state, transform);
                break;
            case 'geneva':
                this.drawGeneva(graphics, state, transform);
                break;
            case 'scotch-yoke':
                this.drawScotchYoke(graphics, state, transform);
                break;
            case 'quick-return':
                this.drawQuickReturn(graphics, state, transform);
                break;
            case 'ratchet':
                this.drawRatchet(graphics, state, transform);
                break;
            case 'cam-follower':
                this.drawCamFollower(graphics, state, transform);
                break;
            case 'elliptic-gears':
                this.drawEllipticGears(graphics, state, transform);
                break;
            default:
                this.drawSliderCrank(graphics, state, transform);
                break;
        }
    }

    private createMechanismTransform(
        state: SliderCrankViewState,
    ): MechanismTransform {
        const bounds = this.worldBounds(state.sample);
        const chartHeight = state.showPlot
            ? Math.min(174, Math.max(110, this.plotHeight * 0.25))
            : 0;
        const top = this.plotHeight / 2 - this.tabHeight() - 18;
        const bottom = -this.plotHeight / 2 + 78
            + (state.showPlot ? chartHeight + 14 : 0);
        const left = -this.plotWidth / 2 + 36;
        const right = this.plotWidth / 2 - 36;
        const width = Math.max(1e-6, bounds.maximumX - bounds.minimumX);
        const height = Math.max(1e-6, bounds.maximumY - bounds.minimumY);
        const scale = Math.max(
            1,
            Math.min((right - left) / width, (top - bottom) / height),
        );
        const worldCenterX = (bounds.minimumX + bounds.maximumX) / 2;
        const worldCenterY = (bounds.minimumY + bounds.maximumY) / 2;
        const screenCenterX = (left + right) / 2;
        const screenCenterY = (bottom + top) / 2;
        return {
            scale,
            point: (point) => ({
                x: screenCenterX + (point.x - worldCenterX) * scale,
                y: screenCenterY + (point.y - worldCenterY) * scale,
            }),
        };
    }

    private worldBounds(sample: MechanicalLinkageSample): WorldBounds {
        switch (sample.mechanism) {
            case 'four-bar': {
                const link = Math.max(
                    sample.inputLength,
                    sample.couplerLength,
                    sample.outputLength,
                );
                return {
                    minimumX: -sample.inputLength * 1.1,
                    maximumX: sample.groundLength + sample.outputLength * 1.1,
                    minimumY: -link * 0.8,
                    maximumY: link * 1.35,
                };
            }
            case 'geneva': {
                const radius = Math.max(sample.driverRadius, sample.wheelRadius);
                return {
                    minimumX: -radius * 1.35,
                    maximumX: sample.centerDistance + sample.wheelRadius * 1.35,
                    minimumY: -radius * 1.35,
                    maximumY: radius * 1.35,
                };
            }
            case 'scotch-yoke':
                return {
                    minimumX: -sample.crankRadius * 2.1,
                    maximumX: sample.crankRadius * 2.1,
                    minimumY: -sample.slotHalfHeight * 1.4,
                    maximumY: sample.slotHalfHeight * 1.4,
                };
            case 'quick-return':
                return {
                    minimumX: -sample.crankRadius * 1.4,
                    maximumX: sample.pivotDistance
                        + sample.leverLength
                        + sample.connectingRodLength * 1.1,
                    minimumY: -sample.leverLength * 1.05,
                    maximumY: sample.leverLength * 1.05,
                };
            case 'ratchet':
                return {
                    minimumX: -sample.wheelRadius * 1.4,
                    maximumX: sample.wheelCenter.x + sample.wheelRadius * 1.4,
                    minimumY: -sample.wheelRadius * 1.45,
                    maximumY: sample.wheelRadius * 1.45,
                };
            case 'cam-follower':
                return {
                    minimumX: -(sample.baseRadius + sample.lift) * 1.25,
                    maximumX: (sample.baseRadius + sample.lift) * 1.25,
                    minimumY: -(sample.baseRadius + sample.lift) * 1.2,
                    maximumY: sample.baseRadius + sample.lift * 2.2,
                };
            case 'elliptic-gears':
                return {
                    minimumX: -sample.semiMajor * 1.35,
                    maximumX: sample.outputCenter.x + sample.semiMajor * 1.35,
                    minimumY: -sample.semiMajor * 1.35,
                    maximumY: sample.semiMajor * 1.35,
                };
            default:
                return {
                    minimumX: -sample.crankRadius * 1.35,
                    maximumX: sample.rodLength + sample.crankRadius * 2.1,
                    minimumY: -sample.crankRadius * 1.55,
                    maximumY: sample.crankRadius * 1.55,
                };
        }
    }

    private drawTrace(
        graphics: Graphics,
        state: SliderCrankViewState,
        transform: MechanismTransform,
    ): void {
        if (state.cycleSamples.length < 2) return;
        graphics.strokeColor = TRACE_COLOR;
        graphics.lineWidth = 1.2;
        state.cycleSamples.forEach((sample, index) => {
            const point = transform.point(sample.tracePoint);
            if (index === 0) graphics.moveTo(point.x, point.y);
            else graphics.lineTo(point.x, point.y);
        });
        graphics.stroke();
    }

    private drawSliderCrank(
        graphics: Graphics,
        state: SliderCrankViewState,
        transform: MechanismTransform,
    ): void {
        const sample = state.sample;
        if (sample.mechanism !== 'slider-crank') return;
        const center = transform.point(sample.crankCenter);
        const crankPin = transform.point(sample.crankPin);
        const sliderPin = transform.point(sample.sliderPin);
        const radius = sample.crankRadius * transform.scale;
        const pistonWidth = Math.max(28, radius * 0.72);
        const pistonHeight = Math.max(24, radius * 0.72);
        const cylinderStart = transform.point({
            x: sample.rodLength - sample.crankRadius * 1.35,
            y: 0,
        }).x;
        const cylinderEnd = transform.point({
            x: sample.rodLength + sample.crankRadius * 2,
            y: 0,
        }).x;

        graphics.strokeColor = GHOST_COLOR;
        graphics.lineWidth = 1;
        for (const worldX of [
            sample.rodLength - sample.crankRadius,
            sample.rodLength + sample.crankRadius,
        ]) {
            const x = transform.point({ x: worldX, y: 0 }).x;
            graphics.moveTo(x, sliderPin.y - pistonHeight * 0.72);
            graphics.lineTo(x, sliderPin.y + pistonHeight * 0.72);
        }
        graphics.stroke();
        this.drawGuide(graphics, cylinderStart, cylinderEnd, sliderPin.y, pistonHeight);
        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1.2;
        graphics.circle(center.x, center.y, radius);
        graphics.stroke();
        this.drawLink(graphics, center, crankPin, INPUT_COLOR, radius * 0.08);
        this.drawLink(graphics, crankPin, sliderPin, COUPLER_COLOR, radius * 0.10);
        this.drawSlider(graphics, sliderPin, pistonWidth, pistonHeight);
        this.drawJoint(graphics, center, Math.max(6, radius * 0.11));
        this.drawJoint(graphics, crankPin, Math.max(5, radius * 0.09));
        this.drawJoint(graphics, sliderPin, Math.max(5, radius * 0.085));
        this.drawLinearKinematics(
            graphics,
            state,
            sliderPin,
            { x: 1, y: 0 },
            pistonHeight * 0.92,
            sample.outputVelocity,
            sample.outputAcceleration,
        );
    }

    private drawFourBar(
        graphics: Graphics,
        state: SliderCrankViewState,
        transform: MechanismTransform,
    ): void {
        const sample = state.sample;
        if (sample.mechanism !== 'four-bar') return;
        const fixedInput = transform.point(sample.fixedInput);
        const fixedOutput = transform.point(sample.fixedOutput);
        const crankPin = transform.point(sample.crankPin);
        const couplerPin = transform.point(sample.couplerPin);
        const couplerPoint = transform.point(sample.couplerPoint);
        const baseWidth = Math.max(6, sample.inputLength * transform.scale * 0.08);
        this.drawLink(graphics, fixedInput, fixedOutput, palette.borderStrong, baseWidth * 0.8);
        this.drawLink(graphics, fixedInput, crankPin, INPUT_COLOR, baseWidth);
        this.drawLink(graphics, crankPin, couplerPin, COUPLER_COLOR, baseWidth);
        this.drawLink(graphics, fixedOutput, couplerPin, OUTPUT_COLOR, baseWidth);
        this.drawJoint(graphics, fixedInput, Math.max(6, baseWidth * 1.05));
        this.drawJoint(graphics, fixedOutput, Math.max(6, baseWidth * 1.05));
        this.drawJoint(graphics, crankPin, Math.max(5, baseWidth * 0.9));
        this.drawJoint(graphics, couplerPin, Math.max(5, baseWidth * 0.9));
        graphics.fillColor = palette.accent;
        graphics.circle(couplerPoint.x, couplerPoint.y, Math.max(3.5, baseWidth * 0.55));
        graphics.fill();
        if (state.showKinematics) {
            const rocker = {
                x: couplerPin.x - fixedOutput.x,
                y: couplerPin.y - fixedOutput.y,
            };
            const length = Math.max(1e-6, Math.hypot(rocker.x, rocker.y));
            const tangent = { x: -rocker.y / length, y: rocker.x / length };
            this.drawLinearArrow(
                graphics,
                couplerPin,
                sample.outputVelocity / state.maximumVelocity,
                tangent,
                0,
                VELOCITY_COLOR,
            );
            this.drawLinearArrow(
                graphics,
                couplerPin,
                sample.outputAcceleration / state.maximumAcceleration,
                tangent,
                -12,
                ACCELERATION_COLOR,
            );
        }
    }

    private drawGeneva(
        graphics: Graphics,
        state: SliderCrankViewState,
        transform: MechanismTransform,
    ): void {
        const sample = state.sample;
        if (sample.mechanism !== 'geneva') return;
        const driverCenter = transform.point(sample.driverCenter);
        const wheelCenter = transform.point(sample.wheelCenter);
        const driverPin = transform.point(sample.driverPin);
        const driverRadius = sample.driverRadius * transform.scale;
        const wheelRadius = sample.wheelRadius * transform.scale;
        const slotStep = TAU / sample.slotCount;
        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1.5;
        graphics.circle(driverCenter.x, driverCenter.y, driverRadius * 1.05);
        graphics.stroke();
        this.drawLink(
            graphics,
            driverCenter,
            driverPin,
            INPUT_COLOR,
            Math.max(5, driverRadius * 0.09),
        );
        graphics.fillColor = new Color(62, 76, 90, 235);
        graphics.circle(wheelCenter.x, wheelCenter.y, wheelRadius);
        graphics.fill();
        graphics.strokeColor = OUTPUT_COLOR;
        graphics.lineWidth = 2.2;
        graphics.circle(wheelCenter.x, wheelCenter.y, wheelRadius);
        graphics.stroke();
        const relativePinAngle = Math.atan2(
            sample.driverPin.y - sample.wheelCenter.y,
            sample.driverPin.x - sample.wheelCenter.x,
        );
        let activeSlot = 0;
        let activeDifference = Number.POSITIVE_INFINITY;
        for (let slot = 0; slot < sample.slotCount; slot += 1) {
            const angle = sample.output + slot * slotStep;
            const difference = Math.abs(this.angleDifference(relativePinAngle, angle));
            if (difference < activeDifference) {
                activeDifference = difference;
                activeSlot = slot;
            }
        }
        for (let slot = 0; slot < sample.slotCount; slot += 1) {
            const angle = sample.output + slot * slotStep;
            const inner = {
                x: wheelCenter.x + Math.cos(angle) * wheelRadius * 0.22,
                y: wheelCenter.y + Math.sin(angle) * wheelRadius * 0.22,
            };
            const outer = {
                x: wheelCenter.x + Math.cos(angle) * wheelRadius * 0.92,
                y: wheelCenter.y + Math.sin(angle) * wheelRadius * 0.92,
            };
            graphics.strokeColor = sample.engaged && slot === activeSlot
                ? palette.accent
                : palette.backgroundRaised;
            graphics.lineWidth = sample.engaged && slot === activeSlot ? 4 : 2.4;
            graphics.moveTo(inner.x, inner.y);
            graphics.lineTo(outer.x, outer.y);
            graphics.stroke();
        }
        this.drawJoint(graphics, driverCenter, Math.max(6, driverRadius * 0.11));
        this.drawJoint(graphics, wheelCenter, Math.max(7, wheelRadius * 0.10));
        graphics.fillColor = sample.engaged ? palette.accent : COUPLER_COLOR;
        graphics.circle(driverPin.x, driverPin.y, Math.max(5, driverRadius * 0.10));
        graphics.fill();
        this.drawAngularKinematics(
            graphics,
            state,
            wheelCenter,
            wheelRadius,
            sample.outputVelocity,
            sample.outputAcceleration,
        );
    }

    private drawScotchYoke(
        graphics: Graphics,
        state: SliderCrankViewState,
        transform: MechanismTransform,
    ): void {
        const sample = state.sample;
        if (sample.mechanism !== 'scotch-yoke') return;
        const center = transform.point(sample.crankCenter);
        const crankPin = transform.point(sample.crankPin);
        const sliderPin = transform.point(sample.sliderPin);
        const radius = sample.crankRadius * transform.scale;
        const slotHalf = sample.slotHalfHeight * transform.scale;
        const yokeWidth = Math.max(42, radius * 0.72);
        const yokeHeight = slotHalf * 2.18;
        this.drawGuide(
            graphics,
            center.x - radius * 2,
            center.x + radius * 2,
            sliderPin.y,
            Math.max(24, radius * 0.55),
        );
        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1.4;
        graphics.circle(center.x, center.y, radius);
        graphics.stroke();
        this.drawLink(graphics, center, crankPin, INPUT_COLOR, radius * 0.09);
        graphics.fillColor = new Color(56, 78, 71, 235);
        graphics.rect(
            sliderPin.x - yokeWidth / 2,
            sliderPin.y - yokeHeight / 2,
            yokeWidth,
            yokeHeight,
        );
        graphics.fill();
        graphics.strokeColor = OUTPUT_COLOR;
        graphics.lineWidth = 2;
        graphics.rect(
            sliderPin.x - yokeWidth / 2,
            sliderPin.y - yokeHeight / 2,
            yokeWidth,
            yokeHeight,
        );
        graphics.stroke();
        graphics.strokeColor = palette.backgroundRaised;
        graphics.lineWidth = Math.max(8, radius * 0.14);
        graphics.moveTo(sliderPin.x, sliderPin.y - slotHalf);
        graphics.lineTo(sliderPin.x, sliderPin.y + slotHalf);
        graphics.stroke();
        this.drawJoint(graphics, center, Math.max(6, radius * 0.11));
        graphics.fillColor = COUPLER_COLOR;
        graphics.circle(crankPin.x, crankPin.y, Math.max(5, radius * 0.10));
        graphics.fill();
        this.drawLinearKinematics(
            graphics,
            state,
            sliderPin,
            { x: 1, y: 0 },
            yokeHeight * 0.58,
            sample.outputVelocity,
            sample.outputAcceleration,
        );
    }

    private drawQuickReturn(
        graphics: Graphics,
        state: SliderCrankViewState,
        transform: MechanismTransform,
    ): void {
        const sample = state.sample;
        if (sample.mechanism !== 'quick-return') return;
        const driver = transform.point(sample.driverCenter);
        const pivot = transform.point(sample.leverPivot);
        const crankPin = transform.point(sample.crankPin);
        const leverPoint = transform.point(sample.leverPoint);
        const slider = transform.point(sample.sliderPin);
        const radius = sample.crankRadius * transform.scale;
        const sliderHeight = Math.max(24, radius * 0.58);
        this.drawGuide(
            graphics,
            leverPoint.x,
            slider.x + sample.connectingRodLength * transform.scale * 0.42,
            slider.y,
            sliderHeight,
        );
        this.drawLink(graphics, driver, pivot, palette.borderStrong, 5);
        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1.2;
        graphics.circle(driver.x, driver.y, radius);
        graphics.stroke();
        this.drawLink(graphics, driver, crankPin, INPUT_COLOR, radius * 0.09);
        this.drawLink(graphics, pivot, leverPoint, COUPLER_COLOR, radius * 0.11);
        graphics.strokeColor = palette.backgroundRaised;
        graphics.lineWidth = Math.max(8, radius * 0.17);
        graphics.moveTo(pivot.x, pivot.y);
        graphics.lineTo(leverPoint.x, leverPoint.y);
        graphics.stroke();
        graphics.fillColor = INPUT_COLOR;
        graphics.circle(crankPin.x, crankPin.y, Math.max(5, radius * 0.10));
        graphics.fill();
        this.drawLink(graphics, leverPoint, slider, OUTPUT_COLOR, radius * 0.09);
        this.drawSlider(graphics, slider, Math.max(30, radius * 0.72), sliderHeight);
        this.drawJoint(graphics, driver, Math.max(6, radius * 0.11));
        this.drawJoint(graphics, pivot, Math.max(7, radius * 0.12));
        this.drawJoint(graphics, leverPoint, Math.max(5, radius * 0.09));
        this.drawLinearKinematics(
            graphics,
            state,
            slider,
            { x: 1, y: 0 },
            sliderHeight * 0.9,
            sample.outputVelocity,
            sample.outputAcceleration,
        );
    }

    private drawRatchet(
        graphics: Graphics,
        state: SliderCrankViewState,
        transform: MechanismTransform,
    ): void {
        const sample = state.sample;
        if (sample.mechanism !== 'ratchet') return;
        const driver = transform.point(sample.driverCenter);
        const wheel = transform.point(sample.wheelCenter);
        const crankPin = transform.point(sample.crankPin);
        const pawlTip = transform.point(sample.pawlTip);
        const radius = sample.wheelRadius * transform.scale;
        const crankRadius = Math.hypot(
            crankPin.x - driver.x,
            crankPin.y - driver.y,
        );
        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1.3;
        graphics.circle(driver.x, driver.y, crankRadius);
        graphics.stroke();
        this.drawLink(graphics, driver, crankPin, INPUT_COLOR, crankRadius * 0.09);
        graphics.fillColor = new Color(60, 75, 70, 240);
        graphics.circle(wheel.x, wheel.y, radius * 0.88);
        graphics.fill();
        const toothStep = TAU / sample.toothCount;
        graphics.strokeColor = OUTPUT_COLOR;
        graphics.lineWidth = 2;
        for (let tooth = 0; tooth < sample.toothCount; tooth += 1) {
            const angle = sample.output + tooth * toothStep;
            graphics.moveTo(
                wheel.x + Math.cos(angle) * radius * 0.78,
                wheel.y + Math.sin(angle) * radius * 0.78,
            );
            graphics.lineTo(
                wheel.x + Math.cos(angle) * radius,
                wheel.y + Math.sin(angle) * radius,
            );
        }
        graphics.circle(wheel.x, wheel.y, radius * 0.78);
        graphics.stroke();
        this.drawLink(
            graphics,
            crankPin,
            pawlTip,
            sample.engaged ? COUPLER_COLOR : palette.muted,
            Math.max(5, radius * 0.08),
        );
        this.drawJoint(graphics, driver, Math.max(6, crankRadius * 0.11));
        this.drawJoint(graphics, wheel, Math.max(7, radius * 0.10));
        graphics.fillColor = sample.engaged ? palette.accent : palette.muted;
        graphics.circle(pawlTip.x, pawlTip.y, Math.max(4, radius * 0.07));
        graphics.fill();
        this.drawAngularKinematics(
            graphics,
            state,
            wheel,
            radius,
            sample.outputVelocity,
            sample.outputAcceleration,
        );
    }

    private drawCamFollower(
        graphics: Graphics,
        state: SliderCrankViewState,
        transform: MechanismTransform,
    ): void {
        const sample = state.sample;
        if (sample.mechanism !== 'cam-follower') return;
        const center = transform.point(sample.camCenter);
        const follower = transform.point(sample.followerPoint);
        const profile = sample.profile.map((point) => transform.point(point));
        if (profile.length > 1) {
            graphics.fillColor = new Color(55, 75, 88, 240);
            graphics.moveTo(profile[0].x, profile[0].y);
            for (let index = 1; index < profile.length; index += 1) {
                graphics.lineTo(profile[index].x, profile[index].y);
            }
            graphics.close();
            graphics.fill();
            graphics.strokeColor = INPUT_COLOR;
            graphics.lineWidth = 2.2;
            graphics.moveTo(profile[0].x, profile[0].y);
            for (let index = 1; index < profile.length; index += 1) {
                graphics.lineTo(profile[index].x, profile[index].y);
            }
            graphics.close();
            graphics.stroke();
        }
        const rollerRadius = Math.max(8, sample.baseRadius * transform.scale * 0.15);
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 2;
        graphics.moveTo(follower.x - rollerRadius * 1.7, follower.y);
        graphics.lineTo(follower.x - rollerRadius * 1.7, follower.y + rollerRadius * 3.2);
        graphics.moveTo(follower.x + rollerRadius * 1.7, follower.y);
        graphics.lineTo(follower.x + rollerRadius * 1.7, follower.y + rollerRadius * 3.2);
        graphics.stroke();
        graphics.fillColor = OUTPUT_COLOR;
        graphics.circle(follower.x, follower.y, rollerRadius);
        graphics.fill();
        this.drawLink(
            graphics,
            follower,
            { x: follower.x, y: follower.y + rollerRadius * 2.8 },
            OUTPUT_COLOR,
            rollerRadius * 0.55,
        );
        this.drawJoint(graphics, center, Math.max(7, sample.baseRadius * transform.scale * 0.10));
        this.drawLinearKinematics(
            graphics,
            state,
            follower,
            { x: 0, y: 1 },
            rollerRadius * 2,
            sample.outputVelocity,
            sample.outputAcceleration,
        );
    }

    private drawEllipticGears(
        graphics: Graphics,
        state: SliderCrankViewState,
        transform: MechanismTransform,
    ): void {
        const sample = state.sample;
        if (sample.mechanism !== 'elliptic-gears') return;
        const inputCenter = transform.point(sample.inputCenter);
        const outputCenter = transform.point(sample.outputCenter);
        const a = sample.semiMajor * transform.scale;
        const b = sample.semiMinor * transform.scale;
        this.drawRotatedEllipse(
            graphics,
            inputCenter,
            a,
            b,
            sample.inputAngle,
            INPUT_COLOR,
        );
        this.drawRotatedEllipse(
            graphics,
            outputCenter,
            a,
            b,
            sample.output,
            OUTPUT_COLOR,
        );
        graphics.strokeColor = GHOST_COLOR;
        graphics.lineWidth = 1;
        graphics.moveTo(inputCenter.x, inputCenter.y);
        graphics.lineTo(outputCenter.x, outputCenter.y);
        graphics.stroke();
        const contact = {
            x: inputCenter.x + sample.inputPitchRadius * transform.scale,
            y: inputCenter.y,
        };
        graphics.fillColor = COUPLER_COLOR;
        graphics.circle(contact.x, contact.y, Math.max(4, a * 0.045));
        graphics.fill();
        this.drawJoint(graphics, inputCenter, Math.max(7, a * 0.075));
        this.drawJoint(graphics, outputCenter, Math.max(7, a * 0.075));
        this.drawAngularKinematics(
            graphics,
            state,
            outputCenter,
            a,
            sample.outputVelocity,
            sample.outputAcceleration,
        );
    }

    private drawRotatedEllipse(
        graphics: Graphics,
        center: MechanismPoint,
        semiMajor: number,
        semiMinor: number,
        rotation: number,
        color: Color,
    ): void {
        const segments = 72;
        const cosine = Math.cos(rotation);
        const sine = Math.sin(rotation);
        graphics.fillColor = new Color(color.r, color.g, color.b, 68);
        for (let index = 0; index <= segments; index += 1) {
            const angle = TAU * index / segments;
            const localX = Math.cos(angle) * semiMajor;
            const localY = Math.sin(angle) * semiMinor;
            const point = {
                x: center.x + localX * cosine - localY * sine,
                y: center.y + localX * sine + localY * cosine,
            };
            if (index === 0) graphics.moveTo(point.x, point.y);
            else graphics.lineTo(point.x, point.y);
        }
        graphics.close();
        graphics.fill();
        graphics.strokeColor = color;
        graphics.lineWidth = 2.2;
        for (let index = 0; index <= segments; index += 1) {
            const angle = TAU * index / segments;
            const localX = Math.cos(angle) * semiMajor;
            const localY = Math.sin(angle) * semiMinor;
            const point = {
                x: center.x + localX * cosine - localY * sine,
                y: center.y + localX * sine + localY * cosine,
            };
            if (index === 0) graphics.moveTo(point.x, point.y);
            else graphics.lineTo(point.x, point.y);
        }
        graphics.close();
        graphics.stroke();
    }

    private drawGuide(
        graphics: Graphics,
        startX: number,
        endX: number,
        y: number,
        height: number,
    ): void {
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 2;
        graphics.moveTo(startX, y + height * 0.68);
        graphics.lineTo(endX, y + height * 0.68);
        graphics.moveTo(startX, y - height * 0.68);
        graphics.lineTo(endX, y - height * 0.68);
        graphics.stroke();
    }

    private drawSlider(
        graphics: Graphics,
        pin: MechanismPoint,
        width: number,
        height: number,
    ): void {
        graphics.fillColor = OUTPUT_COLOR;
        graphics.rect(pin.x - width * 0.42, pin.y - height / 2, width, height);
        graphics.fill();
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 1.5;
        graphics.rect(pin.x - width * 0.42, pin.y - height / 2, width, height);
        graphics.stroke();
    }

    private drawLink(
        graphics: Graphics,
        start: MechanismPoint,
        end: MechanismPoint,
        color: Color,
        width: number,
    ): void {
        graphics.strokeColor = SHADOW_COLOR;
        graphics.lineWidth = Math.max(7, width + 5);
        graphics.moveTo(start.x, start.y);
        graphics.lineTo(end.x, end.y);
        graphics.stroke();
        graphics.strokeColor = color;
        graphics.lineWidth = Math.max(3, width);
        graphics.moveTo(start.x, start.y);
        graphics.lineTo(end.x, end.y);
        graphics.stroke();
    }

    private drawJoint(
        graphics: Graphics,
        point: MechanismPoint,
        radius: number,
    ): void {
        graphics.fillColor = palette.backgroundRaised;
        graphics.circle(point.x, point.y, radius);
        graphics.fill();
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 1.4;
        graphics.circle(point.x, point.y, radius);
        graphics.stroke();
    }

    private drawLinearKinematics(
        graphics: Graphics,
        state: SliderCrankViewState,
        origin: MechanismPoint,
        axis: MechanismPoint,
        offset: number,
        velocity: number,
        acceleration: number,
    ): void {
        if (!state.showKinematics) return;
        this.drawLinearArrow(
            graphics,
            origin,
            velocity / state.maximumVelocity,
            axis,
            offset,
            VELOCITY_COLOR,
        );
        this.drawLinearArrow(
            graphics,
            origin,
            acceleration / state.maximumAcceleration,
            axis,
            -offset,
            ACCELERATION_COLOR,
        );
    }

    private drawAngularKinematics(
        graphics: Graphics,
        state: SliderCrankViewState,
        center: MechanismPoint,
        radius: number,
        velocity: number,
        acceleration: number,
    ): void {
        if (!state.showKinematics) return;
        this.drawAngularArrow(
            graphics,
            center,
            radius * 1.12,
            velocity / state.maximumVelocity,
            VELOCITY_COLOR,
        );
        this.drawAngularArrow(
            graphics,
            center,
            radius * 1.27,
            acceleration / state.maximumAcceleration,
            ACCELERATION_COLOR,
        );
    }

    private drawLinearArrow(
        graphics: Graphics,
        origin: MechanismPoint,
        normalized: number,
        axis: MechanismPoint,
        normalOffset: number,
        color: Color,
    ): void {
        const magnitude = Math.abs(normalized);
        if (magnitude < 0.015) return;
        const sign = normalized < 0 ? -1 : 1;
        const normal = { x: -axis.y, y: axis.x };
        const start = {
            x: origin.x + normal.x * normalOffset,
            y: origin.y + normal.y * normalOffset,
        };
        const length = sign * (12 + 42 * Math.min(1, magnitude));
        const end = {
            x: start.x + axis.x * length,
            y: start.y + axis.y * length,
        };
        const head = 7;
        graphics.strokeColor = SHADOW_COLOR;
        graphics.lineWidth = 4;
        graphics.moveTo(start.x, start.y);
        graphics.lineTo(end.x, end.y);
        graphics.stroke();
        graphics.strokeColor = color;
        graphics.lineWidth = 2;
        graphics.moveTo(start.x, start.y);
        graphics.lineTo(end.x, end.y);
        graphics.lineTo(
            end.x - axis.x * sign * head + normal.x * head * 0.65,
            end.y - axis.y * sign * head + normal.y * head * 0.65,
        );
        graphics.moveTo(end.x, end.y);
        graphics.lineTo(
            end.x - axis.x * sign * head - normal.x * head * 0.65,
            end.y - axis.y * sign * head - normal.y * head * 0.65,
        );
        graphics.stroke();
    }

    private drawAngularArrow(
        graphics: Graphics,
        center: MechanismPoint,
        radius: number,
        normalized: number,
        color: Color,
    ): void {
        const magnitude = Math.abs(normalized);
        if (magnitude < 0.015) return;
        const sign = normalized < 0 ? -1 : 1;
        const span = sign * (0.45 + 1.1 * Math.min(1, magnitude));
        const startAngle = sign > 0 ? -0.8 : 0.8;
        const segments = 18;
        graphics.strokeColor = color;
        graphics.lineWidth = 2;
        let end = { x: center.x, y: center.y };
        let tangent = { x: 1, y: 0 };
        for (let index = 0; index <= segments; index += 1) {
            const angle = startAngle + span * index / segments;
            const point = {
                x: center.x + Math.cos(angle) * radius,
                y: center.y + Math.sin(angle) * radius,
            };
            if (index === 0) graphics.moveTo(point.x, point.y);
            else graphics.lineTo(point.x, point.y);
            end = point;
            tangent = {
                x: -Math.sin(angle) * sign,
                y: Math.cos(angle) * sign,
            };
        }
        graphics.stroke();
        const normal = { x: -tangent.y, y: tangent.x };
        graphics.moveTo(end.x, end.y);
        graphics.lineTo(
            end.x - tangent.x * 7 + normal.x * 4,
            end.y - tangent.y * 7 + normal.y * 4,
        );
        graphics.moveTo(end.x, end.y);
        graphics.lineTo(
            end.x - tangent.x * 7 - normal.x * 4,
            end.y - tangent.y * 7 - normal.y * 4,
        );
        graphics.stroke();
    }

    private drawCurves(state: SliderCrankViewState): void {
        const graphics = this.curveGraphics;
        const overlay = this.overlayGraphics;
        if (!graphics || !overlay) return;
        graphics.clear();
        overlay.clear();
        if (!state.showPlot || state.cycleSamples.length < 2) return;
        const chartHeight = Math.min(174, Math.max(110, this.plotHeight * 0.25));
        const left = -this.plotWidth / 2 + 34;
        const right = this.plotWidth / 2 - 34;
        const bottom = -this.plotHeight / 2 + 76;
        const top = bottom + chartHeight;
        const middle = (top + bottom) / 2;
        overlay.strokeColor = palette.border;
        overlay.lineWidth = 1;
        overlay.rect(left, bottom, right - left, chartHeight);
        for (let index = 1; index < 4; index += 1) {
            const x = left + (right - left) * index / 4;
            overlay.moveTo(x, bottom);
            overlay.lineTo(x, top);
        }
        overlay.moveTo(left, middle);
        overlay.lineTo(right, middle);
        overlay.stroke();
        const outputRange = Math.max(1e-9, state.outputMaximum - state.outputMinimum);
        this.drawCurve(
            graphics,
            state,
            left,
            right,
            middle,
            chartHeight,
            POSITION_COLOR,
            (point) => (point.output - state.outputMinimum) / outputRange * 2 - 1,
        );
        this.drawCurve(
            graphics,
            state,
            left,
            right,
            middle,
            chartHeight,
            VELOCITY_COLOR,
            (point) => point.velocity / state.maximumVelocity,
        );
        this.drawCurve(
            graphics,
            state,
            left,
            right,
            middle,
            chartHeight,
            ACCELERATION_COLOR,
            (point) => point.acceleration / state.maximumAcceleration,
        );
        const cursor = left + (right - left) * state.sample.inputAngle / TAU;
        overlay.strokeColor = palette.accent;
        overlay.lineWidth = 1.5;
        overlay.moveTo(cursor, bottom);
        overlay.lineTo(cursor, top);
        overlay.stroke();
    }

    private drawCurve(
        graphics: Graphics,
        state: SliderCrankViewState,
        left: number,
        right: number,
        middle: number,
        chartHeight: number,
        color: Color,
        value: (point: SliderCrankViewState['cycleSamples'][number]) => number,
    ): void {
        graphics.strokeColor = color;
        graphics.lineWidth = 1.8;
        state.cycleSamples.forEach((point, index) => {
            const x = left + (right - left) * point.angle / TAU;
            const normalized = Math.max(-1, Math.min(1, value(point)));
            const y = middle + normalized * chartHeight * 0.42;
            if (index === 0) graphics.moveTo(x, y);
            else graphics.lineTo(x, y);
        });
        graphics.stroke();
    }

    private angleDifference(a: number, b: number): number {
        let difference = (a - b) % TAU;
        if (difference > Math.PI) difference -= TAU;
        if (difference < -Math.PI) difference += TAU;
        return difference;
    }

    private createGraphics(parent: Node, name: string): Graphics {
        return createUiNode(
            parent,
            name,
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);
    }

    private createMultilineLabel(
        parent: Node,
        text: string,
        width: number,
        height: number,
        fontSize: number,
        color: Color,
        x: number,
        y: number,
        lineHeight: number,
    ): void {
        const label = createLabel(
            parent,
            text,
            width,
            Math.max(1, height),
            fontSize,
            color,
            x,
            y,
            HorizontalTextAlignment.LEFT,
        ).getComponent(Label);
        if (label) {
            label.lineHeight = lineHeight;
            label.enableWrapText = true;
        }
    }

    private rebuildParameterPanel(): void {
        if (!this.parameterPanelParent || !this.parameterPanelLayout) return;
        this.parameterPanel?.destroy();
        this.parameterPanel = new ParameterPanel(
            this.parameterPanelParent,
            this.parameterSchema,
            this.viewModel,
            (key) => this.actions.parameterChanged(key),
            (error) => this.actions.reportError(error),
        );
        this.parameterPanel.render(this.parameterPanelLayout);
    }
}
