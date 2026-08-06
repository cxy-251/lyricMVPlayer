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
        const length = Math.hypot(
            sample.sliderPin.x - sample.crankPin.x,
            sample.sliderPin.y - sample.crankPin.y,
        );
        assertClose(
            length,
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
        const expectedStep = TAU / start.slotCount;
        assertClose(
            end.output - start.output,
            expectedStep,
            1e-9,
            'Geneva index angle per driver revolution',
        );
        assert(!dwell.engaged, 'Geneva output did not enter its dwell phase');
        assertClose(
            dwell.outputVelocity,
            0,
            1e-8,
            'Geneva output velocity during dwell',
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
    return ['slider-crank', 'four-bar', 'geneva'];
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
