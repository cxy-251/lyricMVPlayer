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
const INFO_HEIGHT = 174;
const TAU = Math.PI * 2;
const INPUT_COLOR = new Color(92, 151, 211, 255);
const TRANSFER_COLOR = new Color(210, 167, 96, 255);
const OUTPUT_COLOR = new Color(126, 190, 166, 255);
const VELOCITY_COLOR = new Color(126, 190, 166, 235);
const ACCELERATION_COLOR = new Color(224, 151, 72, 235);
const POSITION_COLOR = new Color(231, 235, 227, 220);
const TRACE_COLOR = new Color(164, 181, 205, 120);
const SHADOW_COLOR = new Color(16, 20, 27, 190);
const GHOST_COLOR = new Color(180, 188, 181, 72);

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

interface MechanismPresentation {
    readonly title: string;
    readonly principle: string;
    readonly parts: string;
    readonly state: string;
}

export interface MechanicalLinkagesViewActions {
    mechanismChanged(mechanism: MechanicalLinkageKind): void;
    parameterChanged(key: string): void;
    reportError(error: unknown): void;
}

export class MechanicalLinkagesView {
    private parameterPanel: ParameterPanel | null = null;
    private tabBar: LabTabBar<MechanicalLinkageKind> | null = null;
    private parameterPanelParent: Node | null = null;
    private parameterPanelLayout: ParameterPanelLayout | null = null;
    private mechanismGraphics: Graphics | null = null;
    private curveGraphics: Graphics | null = null;
    private overlayGraphics: Graphics | null = null;
    private titleLabel: Label | null = null;
    private principleLabel: Label | null = null;
    private partsLabel: Label | null = null;
    private stateLabel: Label | null = null;
    private diagnosticsLabel: Label | null = null;
    private plotWidth = 1;
    private plotHeight = 1;

    constructor(
        private readonly root: Node,
        private readonly parameterSchema: ParameterSchema,
        private readonly viewModel: SliderCrankViewModel,
        private readonly actions: MechanicalLinkagesViewActions,
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
        this.titleLabel = null;
        this.principleLabel = null;
        this.partsLabel = null;
        this.stateLabel = null;
        this.diagnosticsLabel = null;
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
            Math.min(1320, safeWidth - (compact ? 28 : 68)),
        );
        const centerX = (viewport.safeInsets.left - viewport.safeInsets.right) / 2;
        const contentTop = viewport.height / 2
            - viewport.safeInsets.top
            - (compact ? 68 : 76);
        const contentBottom = -viewport.height / 2
            + viewport.safeInsets.bottom
            + 12;
        const contentHeight = Math.max(1, contentTop - contentBottom);
        const centerY = (contentTop + contentBottom) / 2;
        const sideInspector = viewport.orientation === 'landscape'
            && safeWidth >= 960
            && contentHeight >= 620;

        if (sideInspector) {
            this.layoutSideBySide(
                centerX,
                centerY,
                contentWidth,
                contentHeight,
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
        const presentation = this.presentation(state);
        if (this.titleLabel) this.titleLabel.string = presentation.title;
        if (this.principleLabel) this.principleLabel.string = presentation.principle;
        if (this.partsLabel) this.partsLabel.string = presentation.parts;
        if (this.stateLabel) this.stateLabel.string = presentation.state;
        if (this.diagnosticsLabel) this.diagnosticsLabel.string = state.diagnosticsText;
        this.drawMechanism(state);
        this.drawCurves(state);
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
    ): void {
        const inspectorWidth = Math.min(390, Math.max(344, contentWidth * 0.30));
        this.plotWidth = Math.max(1, contentWidth - inspectorWidth - CONTENT_GAP);
        this.plotHeight = contentHeight;
        const left = centerX - contentWidth / 2;
        const plot = this.createPlot(left + this.plotWidth / 2, centerY);
        const inspector = this.createInspector(
            inspectorWidth,
            contentHeight,
            left + this.plotWidth + CONTENT_GAP + inspectorWidth / 2,
            centerY,
            false,
        );
        const parameterHeight = Math.max(
            1,
            contentHeight - INFO_HEIGHT - CONTENT_GAP - 8,
        );
        this.parameterPanelParent = inspector;
        this.parameterPanelLayout = {
            width: inspectorWidth - 16,
            height: parameterHeight,
            x: 0,
            y: -contentHeight / 2 + 8 + parameterHeight / 2,
            breakpoint: 'compact',
        };
        this.createPlotLayers(plot);
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
        const infoHeight = contentWidth >= 620 ? 132 : INFO_HEIGHT;
        const inspectorHeight = infoHeight + CONTENT_GAP + parameterHeight;
        this.plotWidth = contentWidth;
        this.plotHeight = Math.max(320, contentHeight - inspectorHeight - CONTENT_GAP);
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
        );
        this.parameterPanelParent = inspector;
        this.parameterPanelLayout = {
            width: contentWidth,
            x: 0,
            y: -inspectorHeight / 2 + parameterHeight / 2,
            breakpoint: panelBreakpoint,
        };
        this.createPlotLayers(plot);
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
        fillNode(plot, this.plotWidth, this.plotHeight, palette.surface, 10);
        strokeNode(plot, this.plotWidth, this.plotHeight, palette.border, 10, 1);
        this.tabBar = new LabTabBar(
            plot,
            MECHANICAL_LINKAGE_TABS,
            (mechanism) => this.actions.mechanismChanged(mechanism),
        );
        return plot;
    }

    private createPlotLayers(plot: Node): void {
        this.mechanismGraphics = createUiNode(
            plot,
            'MechanicalDrawing',
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);
        this.curveGraphics = createUiNode(
            plot,
            'MechanicalCurves',
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);
        this.overlayGraphics = createUiNode(
            plot,
            'MechanicalOverlay',
            this.plotWidth,
            this.plotHeight,
        ).addComponent(Graphics);

        const tabHeight = this.tabHeight();
        this.titleLabel = createLabel(
            plot,
            '',
            Math.max(1, this.plotWidth - 32),
            30,
            this.plotWidth < 520 ? 14 : 18,
            palette.primaryText,
            0,
            this.plotHeight / 2 - tabHeight - 25,
            HorizontalTextAlignment.LEFT,
        ).getComponent(Label);
        this.principleLabel = createLabel(
            plot,
            '',
            Math.max(1, this.plotWidth - 32),
            24,
            this.plotWidth < 520 ? 9 : 11,
            palette.muted,
            0,
            this.plotHeight / 2 - tabHeight - 51,
            HorizontalTextAlignment.LEFT,
        ).getComponent(Label);
        this.partsLabel = createLabel(
            plot,
            '',
            Math.max(1, this.plotWidth - 32),
            22,
            this.plotWidth < 520 ? 8 : 10,
            palette.subtle,
            0,
            this.plotHeight / 2 - tabHeight - 74,
            HorizontalTextAlignment.LEFT,
        ).getComponent(Label);

        const statusWidth = Math.min(760, Math.max(1, this.plotWidth - 28));
        const status = createUiNode(
            plot,
            'MechanicalStatus',
            statusWidth,
            58,
            -this.plotWidth / 2 + statusWidth / 2 + 14,
            -this.plotHeight / 2 + 43,
        );
        fillNode(status, statusWidth, 58, palette.backgroundRaised, 7);
        strokeNode(status, statusWidth, 58, palette.border, 7, 1);
        this.stateLabel = createLabel(
            status,
            '',
            statusWidth - 18,
            22,
            this.plotWidth < 520 ? 9 : 11,
            palette.primaryText,
            0,
            13,
            HorizontalTextAlignment.LEFT,
        ).getComponent(Label);
        this.diagnosticsLabel = createLabel(
            status,
            '',
            statusWidth - 18,
            20,
            this.plotWidth < 520 ? 8 : 9,
            palette.muted,
            0,
            -13,
            HorizontalTextAlignment.LEFT,
        ).getComponent(Label);
        for (const label of [
            this.titleLabel,
            this.principleLabel,
            this.partsLabel,
            this.stateLabel,
            this.diagnosticsLabel,
        ]) {
            if (label) label.enableWrapText = false;
        }
    }

    private createInspector(
        width: number,
        height: number,
        x: number,
        y: number,
        horizontal: boolean,
    ): Node {
        const inspector = createUiNode(
            this.root,
            'MechanicalLinkagesInspector',
            width,
            height,
            x,
            y,
        );
        const infoHeight = horizontal && width >= 620 ? 132 : INFO_HEIGHT;
        const card = createUiNode(
            inspector,
            'MechanicalLinkagesGuide',
            width,
            infoHeight,
            0,
            height / 2 - infoHeight / 2,
        );
        fillNode(card, width, infoHeight, palette.surfaceSoft, 9);
        strokeNode(card, width, infoHeight, palette.border, 9, 1);
        createLabel(
            card,
            'HOW TO READ THE SCHEMATIC',
            width - 24,
            22,
            10,
            palette.primaryText,
            0,
            infoHeight / 2 - 18,
            HorizontalTextAlignment.LEFT,
        );
        const guide = [
            'BLUE  input member / driving shaft',
            'AMBER  transmission member or contact',
            'GREEN  constrained output member',
            'white curve: output · green: velocity · orange: acceleration',
        ].join('\n');
        this.createMultilineLabel(
            card,
            guide,
            width - 24,
            infoHeight - 42,
            9,
            palette.muted,
            0,
            -8,
            16,
        );
        return inspector;
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

    private presentation(state: SliderCrankViewState): MechanismPresentation {
        const sample = state.sample;
        switch (sample.mechanism) {
            case 'four-bar':
                return {
                    title: 'FOUR-BAR CRANK–ROCKER / 四杆机构',
                    principle: 'A full-turn crank drives an oscillating rocker through a coupler.',
                    parts: 'BLUE INPUT CRANK · AMBER COUPLER · GREEN OUTPUT ROCKER',
                    state: `ROCKER ${(sample.output * 180 / Math.PI).toFixed(1)}° · TRANSMISSION ANGLE ${(sample.transmissionAngle * 180 / Math.PI).toFixed(1)}°`,
                };
            case 'geneva':
                return {
                    title: 'GENEVA INDEXING DRIVE / 槽轮机构',
                    principle: 'The driving pin enters one radial slot, indexes the wheel, then leaves it locked in dwell.',
                    parts: 'BLUE DRIVER · AMBER DRIVE PIN · GREEN SLOTTED WHEEL',
                    state: sample.engaged
                        ? 'PIN IN SLOT · INDEXING OUTPUT'
                        : 'PIN OUT OF SLOT · LOCKED DWELL',
                };
            case 'scotch-yoke':
                return {
                    title: 'SCOTCH YOKE / 苏格兰轭机构',
                    principle: 'A crank pin slides inside a straight slot to create pure harmonic reciprocation.',
                    parts: 'BLUE CRANK · AMBER SLIDING PIN · GREEN YOKE / RAM',
                    state: `RAM POSITION ${sample.output.toFixed(3)} m · PURE SINUSOIDAL MOTION`,
                };
            case 'quick-return':
                return {
                    title: 'WHITWORTH QUICK RETURN / 快速回程机构',
                    principle: 'A crank pin slides in a slotted lever; the ram returns in less input rotation than the working stroke.',
                    parts: 'BLUE CRANK · AMBER SLOTTED LEVER · GREEN RAM',
                    state: `${sample.forwardStroke ? 'WORKING / CUTTING STROKE' : 'FAST RETURN STROKE'} · TIME RATIO ${sample.quickReturnRatio.toFixed(2)}`,
                };
            case 'ratchet':
                return {
                    title: 'PAWL & RATCHET / 棘轮机构',
                    principle: 'The drive pawl pushes one saw tooth; the holding pawl blocks reverse rotation.',
                    parts: 'BLUE OSCILLATING DRIVER · AMBER DRIVE PAWL · GREEN SAW-TOOTH RATCHET WHEEL',
                    state: sample.engaged
                        ? 'DRIVE PAWL ENGAGED · WHEEL ADVANCING ONE TOOTH'
                        : 'DRIVE PAWL RETURNING · HOLDING PAWL LOCKS WHEEL',
                };
            case 'cam-follower':
                return {
                    title: 'RADIAL CAM & ROLLER FOLLOWER / 凸轮从动件',
                    principle: 'The rotating cam profile prescribes follower rise, dwell and return.',
                    parts: 'BLUE CAM · AMBER CONTACT POINT · GREEN ROLLER FOLLOWER',
                    state: `${sample.motionPhase} · FOLLOWER LIFT ${sample.output.toFixed(3)} m`,
                };
            case 'elliptic-gears':
                return {
                    title: 'ELLIPTIC GEAR PAIR / 椭圆齿轮机构',
                    principle: 'Pitch radius changes through the turn, so a constant-speed input creates variable output speed.',
                    parts: 'BLUE INPUT GEAR · AMBER PITCH CONTACT · GREEN OUTPUT GEAR',
                    state: `VARIABLE SPEED RATIO ${(sample.inputPitchRadius / sample.outputPitchRadius).toFixed(2)} · PITCH-ELLIPSE SCHEMATIC`,
                };
            default:
                return {
                    title: 'SLIDER–CRANK / 曲柄滑块机构',
                    principle: 'A rotating crank and rigid connecting rod drive a piston along one straight guide.',
                    parts: 'BLUE CRANK · AMBER CONNECTING ROD · GREEN PISTON',
                    state: `PISTON ${sample.output.toFixed(3)} m · STROKE ${(2 * sample.crankRadius).toFixed(2)} m`,
                };
        }
    }

    private drawMechanism(state: SliderCrankViewState): void {
        const graphics = this.mechanismGraphics;
        if (!graphics) return;
        graphics.clear();
        const transform = this.createTransform(state);
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

    private createTransform(state: SliderCrankViewState): MechanismTransform {
        const bounds = this.worldBounds(state.sample);
        const chartHeight = state.showPlot
            ? Math.min(166, Math.max(104, this.plotHeight * 0.23))
            : 0;
        const top = this.plotHeight / 2 - this.tabHeight() - 98;
        const bottom = -this.plotHeight / 2 + 78
            + (state.showPlot ? chartHeight + 14 : 0);
        const left = -this.plotWidth / 2 + 40;
        const right = this.plotWidth / 2 - 40;
        const width = Math.max(1e-6, bounds.maximumX - bounds.minimumX);
        const height = Math.max(1e-6, bounds.maximumY - bounds.minimumY);
        const scale = Math.max(
            1,
            Math.min((right - left) / width, (top - bottom) / height),
        );
        const worldX = (bounds.minimumX + bounds.maximumX) / 2;
        const worldY = (bounds.minimumY + bounds.maximumY) / 2;
        const screenX = (left + right) / 2;
        const screenY = (bottom + top) / 2;
        return {
            scale,
            point: (point) => ({
                x: screenX + (point.x - worldX) * scale,
                y: screenY + (point.y - worldY) * scale,
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
                    minimumX: -sample.inputLength * 1.2,
                    maximumX: sample.groundLength + sample.outputLength * 1.2,
                    minimumY: -link,
                    maximumY: link * 1.4,
                };
            }
            case 'geneva': {
                const radius = Math.max(sample.driverRadius, sample.wheelRadius);
                return {
                    minimumX: -radius * 1.45,
                    maximumX: sample.centerDistance + sample.wheelRadius * 1.45,
                    minimumY: -radius * 1.45,
                    maximumY: radius * 1.45,
                };
            }
            case 'scotch-yoke':
                return {
                    minimumX: -sample.crankRadius * 2.35,
                    maximumX: sample.crankRadius * 2.35,
                    minimumY: -sample.slotHalfHeight * 1.5,
                    maximumY: sample.slotHalfHeight * 1.5,
                };
            case 'quick-return':
                return {
                    minimumX: -sample.crankRadius * 1.5,
                    maximumX: sample.pivotDistance
                        + sample.leverLength
                        + sample.connectingRodLength * 1.15,
                    minimumY: -sample.leverLength * 1.1,
                    maximumY: sample.leverLength * 1.1,
                };
            case 'ratchet':
                return {
                    minimumX: -sample.wheelRadius * 1.55,
                    maximumX: sample.wheelCenter.x + sample.wheelRadius * 1.55,
                    minimumY: -sample.wheelRadius * 1.55,
                    maximumY: sample.wheelRadius * 1.7,
                };
            case 'cam-follower':
                return {
                    minimumX: -(sample.baseRadius + sample.lift) * 1.35,
                    maximumX: (sample.baseRadius + sample.lift) * 1.35,
                    minimumY: -(sample.baseRadius + sample.lift) * 1.25,
                    maximumY: sample.baseRadius + sample.lift * 2.4,
                };
            case 'elliptic-gears':
                return {
                    minimumX: -sample.semiMajor * 1.45,
                    maximumX: sample.outputCenter.x + sample.semiMajor * 1.45,
                    minimumY: -sample.semiMajor * 1.5,
                    maximumY: sample.semiMajor * 1.5,
                };
            default:
                return {
                    minimumX: -sample.crankRadius * 1.45,
                    maximumX: sample.rodLength + sample.crankRadius * 2.2,
                    minimumY: -sample.crankRadius * 1.65,
                    maximumY: sample.crankRadius * 1.65,
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
        const crank = transform.point(sample.crankPin);
        const piston = transform.point(sample.sliderPin);
        const radius = sample.crankRadius * transform.scale;
        const pistonWidth = Math.max(30, radius * 0.75);
        const pistonHeight = Math.max(25, radius * 0.72);
        const guideStart = transform.point({
            x: sample.rodLength - sample.crankRadius * 1.4,
            y: 0,
        }).x;
        const guideEnd = transform.point({
            x: sample.rodLength + sample.crankRadius * 2.1,
            y: 0,
        }).x;
        this.drawGuide(graphics, guideStart, guideEnd, piston.y, pistonHeight);
        graphics.strokeColor = palette.border;
        graphics.lineWidth = 1.4;
        graphics.circle(center.x, center.y, radius);
        graphics.stroke();
        this.drawLink(graphics, center, crank, INPUT_COLOR, radius * 0.09);
        this.drawLink(graphics, crank, piston, TRANSFER_COLOR, radius * 0.11);
        this.drawSlider(graphics, piston, pistonWidth, pistonHeight);
        this.drawJoint(graphics, center, Math.max(6, radius * 0.11));
        this.drawJoint(graphics, crank, Math.max(5, radius * 0.09));
        this.drawJoint(graphics, piston, Math.max(5, radius * 0.08));
        this.drawLinearKinematics(
            graphics,
            state,
            piston,
            { x: 1, y: 0 },
            pistonHeight,
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
        const input = transform.point(sample.fixedInput);
        const output = transform.point(sample.fixedOutput);
        const crank = transform.point(sample.crankPin);
        const coupler = transform.point(sample.couplerPin);
        const trace = transform.point(sample.couplerPoint);
        const width = Math.max(6, sample.inputLength * transform.scale * 0.08);
        this.drawLink(graphics, input, output, palette.borderStrong, width * 0.8);
        this.drawLink(graphics, input, crank, INPUT_COLOR, width);
        this.drawLink(graphics, crank, coupler, TRANSFER_COLOR, width);
        this.drawLink(graphics, output, coupler, OUTPUT_COLOR, width);
        for (const point of [input, output, crank, coupler]) {
            this.drawJoint(graphics, point, Math.max(5, width));
        }
        graphics.fillColor = palette.accent;
        graphics.circle(trace.x, trace.y, Math.max(4, width * 0.55));
        graphics.fill();
        const rocker = {
            x: coupler.x - output.x,
            y: coupler.y - output.y,
        };
        const length = Math.max(1e-6, Math.hypot(rocker.x, rocker.y));
        this.drawLinearKinematics(
            graphics,
            state,
            coupler,
            { x: -rocker.y / length, y: rocker.x / length },
            12,
            sample.outputVelocity,
            sample.outputAcceleration,
        );
    }

    private drawGeneva(
        graphics: Graphics,
        state: SliderCrankViewState,
        transform: MechanismTransform,
    ): void {
        const sample = state.sample;
        if (sample.mechanism !== 'geneva') return;
        const driver = transform.point(sample.driverCenter);
        const wheel = transform.point(sample.wheelCenter);
        const pin = transform.point(sample.driverPin);
        const driverRadius = sample.driverRadius * transform.scale;
        const wheelRadius = sample.wheelRadius * transform.scale;
        graphics.strokeColor = INPUT_COLOR;
        graphics.lineWidth = 2;
        graphics.circle(driver.x, driver.y, driverRadius * 1.08);
        graphics.stroke();
        this.drawLink(graphics, driver, pin, INPUT_COLOR, Math.max(5, driverRadius * 0.09));
        graphics.fillColor = new Color(60, 76, 90, 238);
        graphics.circle(wheel.x, wheel.y, wheelRadius);
        graphics.fill();
        graphics.strokeColor = OUTPUT_COLOR;
        graphics.lineWidth = 2.4;
        graphics.circle(wheel.x, wheel.y, wheelRadius);
        graphics.stroke();
        const step = TAU / sample.slotCount;
        for (let index = 0; index < sample.slotCount; index += 1) {
            const angle = sample.output + index * step;
            const inner = {
                x: wheel.x + Math.cos(angle) * wheelRadius * 0.18,
                y: wheel.y + Math.sin(angle) * wheelRadius * 0.18,
            };
            const outer = {
                x: wheel.x + Math.cos(angle) * wheelRadius * 0.94,
                y: wheel.y + Math.sin(angle) * wheelRadius * 0.94,
            };
            graphics.strokeColor = palette.backgroundRaised;
            graphics.lineWidth = 4;
            graphics.moveTo(inner.x, inner.y);
            graphics.lineTo(outer.x, outer.y);
            graphics.stroke();
        }
        this.drawJoint(graphics, driver, Math.max(6, driverRadius * 0.11));
        this.drawJoint(graphics, wheel, Math.max(7, wheelRadius * 0.10));
        graphics.fillColor = sample.engaged ? palette.accent : TRANSFER_COLOR;
        graphics.circle(pin.x, pin.y, Math.max(5, driverRadius * 0.10));
        graphics.fill();
        this.drawAngularKinematics(
            graphics,
            state,
            wheel,
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
        const pin = transform.point(sample.crankPin);
        const yoke = transform.point(sample.sliderPin);
        const radius = sample.crankRadius * transform.scale;
        const slot = sample.slotHalfHeight * transform.scale;
        const yokeWidth = Math.max(48, radius * 0.78);
        const yokeHeight = slot * 2.2;
        this.drawGuide(
            graphics,
            center.x - radius * 2.2,
            center.x + radius * 2.2,
            yoke.y,
            Math.max(24, radius * 0.55),
        );
        graphics.strokeColor = INPUT_COLOR;
        graphics.lineWidth = 1.5;
        graphics.circle(center.x, center.y, radius);
        graphics.stroke();
        this.drawLink(graphics, center, pin, INPUT_COLOR, radius * 0.09);
        graphics.fillColor = new Color(55, 79, 70, 238);
        graphics.rect(
            yoke.x - yokeWidth / 2,
            yoke.y - yokeHeight / 2,
            yokeWidth,
            yokeHeight,
        );
        graphics.fill();
        graphics.strokeColor = OUTPUT_COLOR;
        graphics.lineWidth = 2.2;
        graphics.rect(
            yoke.x - yokeWidth / 2,
            yoke.y - yokeHeight / 2,
            yokeWidth,
            yokeHeight,
        );
        graphics.stroke();
        graphics.strokeColor = palette.backgroundRaised;
        graphics.lineWidth = Math.max(9, radius * 0.15);
        graphics.moveTo(yoke.x, yoke.y - slot);
        graphics.lineTo(yoke.x, yoke.y + slot);
        graphics.stroke();
        graphics.fillColor = TRANSFER_COLOR;
        graphics.circle(pin.x, pin.y, Math.max(5, radius * 0.10));
        graphics.fill();
        this.drawJoint(graphics, center, Math.max(6, radius * 0.11));
        this.drawLinearKinematics(
            graphics,
            state,
            yoke,
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
        const leverEnd = transform.point(sample.leverPoint);
        const ram = transform.point(sample.sliderPin);
        const radius = sample.crankRadius * transform.scale;
        const ramHeight = Math.max(25, radius * 0.60);
        this.drawGuide(
            graphics,
            leverEnd.x,
            ram.x + sample.connectingRodLength * transform.scale * 0.45,
            ram.y,
            ramHeight,
        );
        graphics.strokeColor = INPUT_COLOR;
        graphics.lineWidth = 1.5;
        graphics.circle(driver.x, driver.y, radius);
        graphics.stroke();
        this.drawLink(graphics, driver, crankPin, INPUT_COLOR, radius * 0.09);
        this.drawSlottedLever(graphics, pivot, leverEnd, crankPin, radius);
        this.drawLink(graphics, leverEnd, ram, OUTPUT_COLOR, radius * 0.09);
        this.drawSlider(graphics, ram, Math.max(32, radius * 0.76), ramHeight);
        this.drawJoint(graphics, driver, Math.max(6, radius * 0.11));
        this.drawJoint(graphics, pivot, Math.max(7, radius * 0.12));
        this.drawJoint(graphics, leverEnd, Math.max(5, radius * 0.09));
        this.drawLinearKinematics(
            graphics,
            state,
            ram,
            { x: 1, y: 0 },
            ramHeight,
            sample.outputVelocity,
            sample.outputAcceleration,
        );
    }

    private drawSlottedLever(
        graphics: Graphics,
        pivot: MechanismPoint,
        end: MechanismPoint,
        pin: MechanismPoint,
        radius: number,
    ): void {
        const dx = end.x - pivot.x;
        const dy = end.y - pivot.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const normal = { x: -dy / length, y: dx / length };
        const half = Math.max(5, radius * 0.10);
        graphics.strokeColor = TRANSFER_COLOR;
        graphics.lineWidth = 3;
        graphics.moveTo(pivot.x + normal.x * half, pivot.y + normal.y * half);
        graphics.lineTo(end.x + normal.x * half, end.y + normal.y * half);
        graphics.moveTo(pivot.x - normal.x * half, pivot.y - normal.y * half);
        graphics.lineTo(end.x - normal.x * half, end.y - normal.y * half);
        graphics.stroke();
        graphics.fillColor = INPUT_COLOR;
        graphics.circle(pin.x, pin.y, Math.max(5, radius * 0.10));
        graphics.fill();
        graphics.strokeColor = palette.backgroundRaised;
        graphics.lineWidth = 1.5;
        graphics.circle(pin.x, pin.y, Math.max(5, radius * 0.10));
        graphics.stroke();
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
        const crank = transform.point(sample.crankPin);
        const driveTip = transform.point(sample.pawlTip);
        const radius = sample.wheelRadius * transform.scale;
        const crankRadius = Math.max(1, Math.hypot(crank.x - driver.x, crank.y - driver.y));
        graphics.strokeColor = INPUT_COLOR;
        graphics.lineWidth = 1.5;
        graphics.circle(driver.x, driver.y, crankRadius);
        graphics.stroke();
        this.drawLink(graphics, driver, crank, INPUT_COLOR, crankRadius * 0.09);
        this.drawSawToothWheel(
            graphics,
            wheel,
            radius,
            sample.toothCount,
            sample.output,
        );
        this.drawLink(
            graphics,
            crank,
            driveTip,
            sample.engaged ? TRANSFER_COLOR : palette.muted,
            Math.max(6, radius * 0.075),
        );
        this.drawPawlHead(
            graphics,
            driveTip,
            wheel,
            Math.max(10, radius * 0.12),
            sample.engaged ? TRANSFER_COLOR : palette.muted,
        );
        const holdAngle = Math.PI / 2 - 0.28;
        const holdTip = {
            x: wheel.x + Math.cos(holdAngle) * radius * 0.96,
            y: wheel.y + Math.sin(holdAngle) * radius * 0.96,
        };
        const holdPivot = {
            x: wheel.x + Math.cos(holdAngle) * radius * 1.42,
            y: wheel.y + Math.sin(holdAngle) * radius * 1.42,
        };
        this.drawLink(graphics, holdPivot, holdTip, palette.muted, Math.max(5, radius * 0.06));
        this.drawPawlHead(graphics, holdTip, wheel, Math.max(9, radius * 0.10), palette.muted);
        this.drawJoint(graphics, driver, Math.max(6, crankRadius * 0.11));
        this.drawJoint(graphics, wheel, Math.max(7, radius * 0.10));
        this.drawJoint(graphics, holdPivot, Math.max(5, radius * 0.07));
        this.drawAngularKinematics(
            graphics,
            state,
            wheel,
            radius,
            sample.outputVelocity,
            sample.outputAcceleration,
        );
    }

    private drawSawToothWheel(
        graphics: Graphics,
        center: MechanismPoint,
        radius: number,
        teeth: number,
        rotation: number,
    ): void {
        const points = teeth * 2;
        graphics.fillColor = new Color(55, 77, 69, 240);
        for (let index = 0; index <= points; index += 1) {
            const angle = rotation + TAU * index / points;
            const localRadius = index % 2 === 0 ? radius * 0.78 : radius;
            const point = {
                x: center.x + Math.cos(angle) * localRadius,
                y: center.y + Math.sin(angle) * localRadius,
            };
            if (index === 0) graphics.moveTo(point.x, point.y);
            else graphics.lineTo(point.x, point.y);
        }
        graphics.close();
        graphics.fill();
        graphics.strokeColor = OUTPUT_COLOR;
        graphics.lineWidth = 2.2;
        for (let index = 0; index <= points; index += 1) {
            const angle = rotation + TAU * index / points;
            const localRadius = index % 2 === 0 ? radius * 0.78 : radius;
            const point = {
                x: center.x + Math.cos(angle) * localRadius,
                y: center.y + Math.sin(angle) * localRadius,
            };
            if (index === 0) graphics.moveTo(point.x, point.y);
            else graphics.lineTo(point.x, point.y);
        }
        graphics.close();
        graphics.stroke();
    }

    private drawPawlHead(
        graphics: Graphics,
        tip: MechanismPoint,
        wheel: MechanismPoint,
        size: number,
        color: Color,
    ): void {
        const dx = wheel.x - tip.x;
        const dy = wheel.y - tip.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const axis = { x: dx / length, y: dy / length };
        const normal = { x: -axis.y, y: axis.x };
        graphics.fillColor = color;
        graphics.moveTo(tip.x + axis.x * size, tip.y + axis.y * size);
        graphics.lineTo(
            tip.x - axis.x * size * 0.35 + normal.x * size * 0.48,
            tip.y - axis.y * size * 0.35 + normal.y * size * 0.48,
        );
        graphics.lineTo(
            tip.x - axis.x * size * 0.35 - normal.x * size * 0.48,
            tip.y - axis.y * size * 0.35 - normal.y * size * 0.48,
        );
        graphics.close();
        graphics.fill();
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
        if (profile.length > 2) {
            graphics.fillColor = new Color(55, 75, 88, 240);
            graphics.moveTo(profile[0].x, profile[0].y);
            for (let index = 1; index < profile.length; index += 1) {
                graphics.lineTo(profile[index].x, profile[index].y);
            }
            graphics.close();
            graphics.fill();
            graphics.strokeColor = INPUT_COLOR;
            graphics.lineWidth = 2.4;
            graphics.moveTo(profile[0].x, profile[0].y);
            for (let index = 1; index < profile.length; index += 1) {
                graphics.lineTo(profile[index].x, profile[index].y);
            }
            graphics.close();
            graphics.stroke();
        }
        const roller = Math.max(9, sample.baseRadius * transform.scale * 0.15);
        graphics.strokeColor = palette.borderStrong;
        graphics.lineWidth = 2;
        graphics.moveTo(follower.x - roller * 1.7, follower.y);
        graphics.lineTo(follower.x - roller * 1.7, follower.y + roller * 4.0);
        graphics.moveTo(follower.x + roller * 1.7, follower.y);
        graphics.lineTo(follower.x + roller * 1.7, follower.y + roller * 4.0);
        graphics.stroke();
        graphics.fillColor = OUTPUT_COLOR;
        graphics.circle(follower.x, follower.y, roller);
        graphics.fill();
        graphics.strokeColor = TRANSFER_COLOR;
        graphics.lineWidth = 2;
        graphics.circle(follower.x, follower.y, roller);
        graphics.stroke();
        this.drawLink(
            graphics,
            follower,
            { x: follower.x, y: follower.y + roller * 3.4 },
            OUTPUT_COLOR,
            roller * 0.55,
        );
        this.drawSpring(
            graphics,
            { x: follower.x, y: follower.y + roller * 3.4 },
            roller * 2.4,
            roller * 0.55,
        );
        this.drawJoint(graphics, center, Math.max(7, sample.baseRadius * transform.scale * 0.10));
        this.drawLinearKinematics(
            graphics,
            state,
            follower,
            { x: 0, y: 1 },
            roller * 2,
            sample.outputVelocity,
            sample.outputAcceleration,
        );
    }

    private drawSpring(
        graphics: Graphics,
        start: MechanismPoint,
        height: number,
        width: number,
    ): void {
        graphics.strokeColor = palette.muted;
        graphics.lineWidth = 1.5;
        graphics.moveTo(start.x, start.y);
        const segments = 8;
        for (let index = 1; index <= segments; index += 1) {
            const x = start.x + (index % 2 === 0 ? -width : width);
            const y = start.y + height * index / segments;
            graphics.lineTo(x, y);
        }
        graphics.lineTo(start.x, start.y + height + 8);
        graphics.stroke();
    }

    private drawEllipticGears(
        graphics: Graphics,
        state: SliderCrankViewState,
        transform: MechanismTransform,
    ): void {
        const sample = state.sample;
        if (sample.mechanism !== 'elliptic-gears') return;
        const input = transform.point(sample.inputCenter);
        const output = transform.point(sample.outputCenter);
        const a = sample.semiMajor * transform.scale;
        const b = sample.semiMinor * transform.scale;
        this.drawToothedEllipse(
            graphics,
            input,
            a,
            b,
            sample.inputAngle,
            INPUT_COLOR,
        );
        this.drawToothedEllipse(
            graphics,
            output,
            a,
            b,
            sample.output,
            OUTPUT_COLOR,
        );
        graphics.strokeColor = GHOST_COLOR;
        graphics.lineWidth = 1;
        graphics.moveTo(input.x, input.y);
        graphics.lineTo(output.x, output.y);
        graphics.stroke();
        const contact = {
            x: input.x + sample.inputPitchRadius * transform.scale,
            y: input.y,
        };
        graphics.fillColor = TRANSFER_COLOR;
        graphics.circle(contact.x, contact.y, Math.max(5, a * 0.045));
        graphics.fill();
        graphics.strokeColor = palette.primaryText;
        graphics.lineWidth = 1;
        graphics.circle(contact.x, contact.y, Math.max(8, a * 0.075));
        graphics.stroke();
        this.drawJoint(graphics, input, Math.max(7, a * 0.075));
        this.drawJoint(graphics, output, Math.max(7, a * 0.075));
        this.drawAngularKinematics(
            graphics,
            state,
            output,
            a,
            sample.outputVelocity,
            sample.outputAcceleration,
        );
    }

    private drawToothedEllipse(
        graphics: Graphics,
        center: MechanismPoint,
        a: number,
        b: number,
        rotation: number,
        color: Color,
    ): void {
        const segments = 96;
        const cosine = Math.cos(rotation);
        const sine = Math.sin(rotation);
        graphics.fillColor = new Color(color.r, color.g, color.b, 62);
        for (let index = 0; index <= segments; index += 1) {
            const angle = TAU * index / segments;
            const localX = Math.cos(angle) * a;
            const localY = Math.sin(angle) * b;
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
        const teeth = 28;
        for (let index = 0; index < teeth; index += 1) {
            const angle = TAU * index / teeth;
            const localX = Math.cos(angle) * a;
            const localY = Math.sin(angle) * b;
            const normalLength = Math.max(1, Math.hypot(localX / (a * a), localY / (b * b)));
            const normalX = localX / (a * a) / normalLength;
            const normalY = localY / (b * b) / normalLength;
            const root = {
                x: center.x + localX * cosine - localY * sine,
                y: center.y + localX * sine + localY * cosine,
            };
            const worldNormal = {
                x: normalX * cosine - normalY * sine,
                y: normalX * sine + normalY * cosine,
            };
            graphics.moveTo(root.x, root.y);
            graphics.lineTo(
                root.x + worldNormal.x * Math.max(5, a * 0.045),
                root.y + worldNormal.y * Math.max(5, a * 0.045),
            );
        }
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
        graphics.strokeColor = color;
        graphics.lineWidth = 2;
        graphics.moveTo(start.x, start.y);
        graphics.lineTo(end.x, end.y);
        graphics.lineTo(
            end.x - axis.x * sign * 7 + normal.x * 4,
            end.y - axis.y * sign * 7 + normal.y * 4,
        );
        graphics.moveTo(end.x, end.y);
        graphics.lineTo(
            end.x - axis.x * sign * 7 - normal.x * 4,
            end.y - axis.y * sign * 7 - normal.y * 4,
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
        const span = sign * (0.45 + Math.min(1, magnitude));
        const start = sign > 0 ? -0.8 : 0.8;
        const segments = 18;
        graphics.strokeColor = color;
        graphics.lineWidth = 2;
        let end = center;
        let tangent = { x: 1, y: 0 };
        for (let index = 0; index <= segments; index += 1) {
            const angle = start + span * index / segments;
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
        const height = Math.min(166, Math.max(104, this.plotHeight * 0.23));
        const left = -this.plotWidth / 2 + 34;
        const right = this.plotWidth / 2 - 34;
        const bottom = -this.plotHeight / 2 + 78;
        const top = bottom + height;
        const middle = (bottom + top) / 2;
        overlay.strokeColor = palette.border;
        overlay.lineWidth = 1;
        overlay.rect(left, bottom, right - left, height);
        for (let index = 1; index < 4; index += 1) {
            const x = left + (right - left) * index / 4;
            overlay.moveTo(x, bottom);
            overlay.lineTo(x, top);
        }
        overlay.moveTo(left, middle);
        overlay.lineTo(right, middle);
        overlay.stroke();
        const range = Math.max(1e-9, state.outputMaximum - state.outputMinimum);
        this.drawCurve(
            graphics,
            state,
            left,
            right,
            middle,
            height,
            POSITION_COLOR,
            (point) => (point.output - state.outputMinimum) / range * 2 - 1,
        );
        this.drawCurve(
            graphics,
            state,
            left,
            right,
            middle,
            height,
            VELOCITY_COLOR,
            (point) => point.velocity / state.maximumVelocity,
        );
        this.drawCurve(
            graphics,
            state,
            left,
            right,
            middle,
            height,
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
        height: number,
        color: Color,
        value: (point: SliderCrankViewState['cycleSamples'][number]) => number,
    ): void {
        graphics.strokeColor = color;
        graphics.lineWidth = 1.8;
        state.cycleSamples.forEach((point, index) => {
            const x = left + (right - left) * point.angle / TAU;
            const normalized = Math.max(-1, Math.min(1, value(point)));
            const y = middle + normalized * height * 0.42;
            if (index === 0) graphics.moveTo(x, y);
            else graphics.lineTo(x, y);
        });
        graphics.stroke();
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
