import { MechanicalLinkagesModel } from './MechanicalLinkagesModel';
import type {
    MechanicalLinkageConfiguration,
    MechanicalLinkageKind,
} from './SliderCrankTypes';

const TAU = Math.PI * 2;

export function runSliderCrankContractChecks(): void {
    checkSliderCrankConstraint();
    checkFourBarClosure();
    checkGenevaIndexingAndDwell();
    checkScotchYokeHarmonicMotion();
    checkQuickReturnConstraint();
    checkRatchetIndexingAndHold();
    checkCamFollowerMotionProgram();
    checkEllipticGearTransmission();
    checkAllCyclesRemainFinite();
}

function checkSliderCrankConstraint(): void {
    const model = createModel('slider-crank', 'standard');
    const right = model.sampleAt(0);
    const left = model.sampleAt(Math.PI);
    assert(right.mechanism === 'slider-crank', 'Slider-crank sample type changed');
    assert(left.mechanism === 'slider-crank', 'Slider-crank sample type changed');
    assertClose(right.outputVelocity, 0, 1e-9, 'Right dead-center velocity');
    assertClose(left.outputVelocity, 0, 1e-9, 'Left dead-center velocity');
    for (let index = 0; index < 360; index += 3) {
        const sample = model.sampleAt(index * Math.PI / 180);
        assert(sample.mechanism === 'slider-crank', 'Slider-crank sample type changed');
        assertClose(
            distance(sample.sliderPin, sample.crankPin),
            sample.rodLength,
            1e-9,
            'Slider-crank connecting-rod constraint',
        );
    }
}

function checkFourBarClosure(): void {
    for (const configuration of configurations()) {
        const model = createModel('four-bar', configuration);
        for (let index = 0; index < 360; index += 2) {
            const sample = model.sampleAt(index * Math.PI / 180);
            assert(sample.mechanism === 'four-bar', 'Four-bar sample type changed');
            assertClose(
                distance(sample.fixedInput, sample.crankPin),
                sample.inputLength,
                1e-9,
                'Four-bar input-link constraint',
            );
            assertClose(
                distance(sample.crankPin, sample.couplerPin),
                sample.couplerLength,
                1e-9,
                'Four-bar coupler constraint',
            );
            assertClose(
                distance(sample.fixedOutput, sample.couplerPin),
                sample.outputLength,
                1e-9,
                'Four-bar output-link constraint',
            );
            assert(
                sample.transmissionAngle > 0
                    && sample.transmissionAngle < Math.PI,
                'Four-bar transmission angle became invalid',
            );
        }
    }
}

function checkGenevaIndexingAndDwell(): void {
    for (const configuration of configurations()) {
        const model = createModel('geneva', configuration);
        const start = model.sampleAt(0);
        const end = model.sampleAt(TAU);
        const dwell = model.sampleAt(Math.PI);
        assert(start.mechanism === 'geneva', 'Geneva sample type changed');
        assert(end.mechanism === 'geneva', 'Geneva sample type changed');
        assert(dwell.mechanism === 'geneva', 'Geneva sample type changed');
        assertClose(
            end.output - start.output,
            TAU / start.slotCount,
            1e-9,
            'Geneva index angle per driver revolution',
        );
        assert(!dwell.engaged, 'Geneva output did not enter its dwell phase');
        assertClose(dwell.outputVelocity, 0, 1e-8, 'Geneva dwell velocity');
    }
}

function checkScotchYokeHarmonicMotion(): void {
    const model = createModel('scotch-yoke', 'standard');
    const right = model.sampleAt(0);
    const left = model.sampleAt(Math.PI);
    const middle = model.sampleAt(Math.PI / 2);
    assert(right.mechanism === 'scotch-yoke', 'Scotch-yoke sample type changed');
    assert(left.mechanism === 'scotch-yoke', 'Scotch-yoke sample type changed');
    assert(middle.mechanism === 'scotch-yoke', 'Scotch-yoke sample type changed');
    assertClose(right.output, right.crankRadius, 1e-10, 'Scotch-yoke right position');
    assertClose(left.output, -left.crankRadius, 1e-10, 'Scotch-yoke left position');
    assertClose(right.outputVelocity, 0, 1e-10, 'Scotch-yoke right velocity');
    assert(Math.abs(middle.outputVelocity) > 1, 'Scotch-yoke mid-stroke velocity vanished');
}

function checkQuickReturnConstraint(): void {
    for (const configuration of configurations()) {
        const model = createModel('quick-return', configuration);
        for (let index = 0; index < 360; index += 3) {
            const sample = model.sampleAt(index * Math.PI / 180);
            assert(sample.mechanism === 'quick-return', 'Quick-return sample type changed');
            assertClose(
                distance(sample.leverPoint, sample.sliderPin),
                sample.connectingRodLength,
                1e-8,
                'Quick-return connecting-rod constraint',
            );
            assert(sample.quickReturnRatio > 1, 'Quick-return ratio must exceed one');
        }
    }
}

function checkRatchetIndexingAndHold(): void {
    for (const configuration of configurations()) {
        const model = createModel('ratchet', configuration);
        const start = model.sampleAt(0);
        const end = model.sampleAt(TAU);
        const hold = model.sampleAt(Math.PI * 1.5);
        assert(start.mechanism === 'ratchet', 'Ratchet sample type changed');
        assert(end.mechanism === 'ratchet', 'Ratchet sample type changed');
        assert(hold.mechanism === 'ratchet', 'Ratchet sample type changed');
        assertClose(
            end.output - start.output,
            TAU / start.toothCount,
            1e-9,
            'Ratchet index angle per input cycle',
        );
        assert(!hold.engaged, 'Ratchet failed to enter pawl-return phase');
        assertClose(hold.outputVelocity, 0, 1e-8, 'Ratchet holding velocity');
    }
}

function checkCamFollowerMotionProgram(): void {
    for (const configuration of configurations()) {
        const model = createModel('cam-follower', configuration);
        const low = model.sampleAt(0);
        const high = model.sampleAt(Math.PI);
        const complete = model.sampleAt(TAU);
        assert(low.mechanism === 'cam-follower', 'Cam sample type changed');
        assert(high.mechanism === 'cam-follower', 'Cam sample type changed');
        assert(complete.mechanism === 'cam-follower', 'Cam sample type changed');
        assertClose(low.output, 0, 1e-10, 'Cam low-dwell lift');
        assertClose(high.output, high.lift, 1e-10, 'Cam high-dwell lift');
        assertClose(complete.output, 0, 1e-10, 'Cam cycle closure');
        assertClose(high.outputVelocity, 0, 1e-8, 'Cam high-dwell velocity');
        assert(high.profile.length >= 64, 'Cam profile resolution regressed');
    }
}

function checkEllipticGearTransmission(): void {
    for (const configuration of configurations()) {
        const model = createModel('elliptic-gears', configuration);
        const start = model.sampleAt(0);
        const quarter = model.sampleAt(Math.PI / 2);
        const end = model.sampleAt(TAU);
        assert(start.mechanism === 'elliptic-gears', 'Elliptic-gear sample type changed');
        assert(quarter.mechanism === 'elliptic-gears', 'Elliptic-gear sample type changed');
        assert(end.mechanism === 'elliptic-gears', 'Elliptic-gear sample type changed');
        assertClose(end.output - start.output, -TAU, 1e-9, 'Elliptic gear revolution ratio');
        assertClose(
            quarter.inputPitchRadius + quarter.outputPitchRadius,
            quarter.outputCenter.x - quarter.inputCenter.x,
            1e-9,
            'Elliptic gear center-distance constraint',
        );
        assert(
            Math.abs(start.outputVelocity - quarter.outputVelocity) > 0.05,
            'Elliptic gear speed ratio did not vary',
        );
    }
}

function checkAllCyclesRemainFinite(): void {
    for (const mechanism of mechanisms()) {
        for (const configuration of configurations()) {
            const model = createModel(mechanism, configuration);
            const cycleSamples = model.sampleCycle(181);
            assert(
                cycleSamples.length === 181,
                `${mechanism} cycle sample count changed`,
            );
            for (const point of cycleSamples) {
                assert(Number.isFinite(point.output), `${mechanism} output became non-finite`);
                assert(Number.isFinite(point.velocity), `${mechanism} velocity became non-finite`);
                assert(
                    Number.isFinite(point.acceleration),
                    `${mechanism} acceleration became non-finite`,
                );
                assert(Number.isFinite(point.tracePoint.x), `${mechanism} trace x became non-finite`);
                assert(Number.isFinite(point.tracePoint.y), `${mechanism} trace y became non-finite`);
            }
        }
    }
}

function createModel(
    mechanism: MechanicalLinkageKind,
    configuration: MechanicalLinkageConfiguration,
): MechanicalLinkagesModel {
    return new MechanicalLinkagesModel({
        mechanism,
        configuration,
        scale: 1,
        angularVelocity: 2,
    });
}

function mechanisms(): MechanicalLinkageKind[] {
    return [
        'slider-crank',
        'four-bar',
        'geneva',
        'scotch-yoke',
        'quick-return',
        'ratchet',
        'cam-follower',
        'elliptic-gears',
    ];
}

function configurations(): MechanicalLinkageConfiguration[] {
    return ['compact', 'standard', 'wide'];
}

function distance(
    first: { readonly x: number; readonly y: number },
    second: { readonly x: number; readonly y: number },
): number {
    return Math.hypot(second.x - first.x, second.y - first.y);
}

function assertClose(
    actual: number,
    expected: number,
    tolerance: number,
    label: string,
): void {
    assert(
        Math.abs(actual - expected) <= tolerance,
        `${label}: expected ${expected}, received ${actual}`,
    );
}

function assert(condition: boolean, message: string): asserts condition {
    if (!condition) throw new Error(message);
}
