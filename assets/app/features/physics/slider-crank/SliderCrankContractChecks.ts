import { SliderCrankModel } from './SliderCrankModel';

export function runSliderCrankContractChecks(): void {
    checkDeadCenters();
    checkRodConstraint();
    checkVelocityAtDeadCenters();
    checkCycleFiniteness();
}

function checkDeadCenters(): void {
    const model = createModel();
    const right = model.sampleAt(0);
    const left = model.sampleAt(Math.PI);
    assertClose(right.pistonPosition, 3.6, 1e-10, 'Right dead-center position');
    assertClose(left.pistonPosition, 2.0, 1e-10, 'Left dead-center position');
    assertClose(right.strokeFraction, 1, 1e-10, 'Right dead-center stroke');
    assertClose(left.strokeFraction, 0, 1e-10, 'Left dead-center stroke');
}

function checkRodConstraint(): void {
    const model = createModel();
    for (let index = 0; index < 360; index += 3) {
        const sample = model.sampleAt(index * Math.PI / 180);
        const distance = Math.hypot(
            sample.pistonPin.x - sample.crankPin.x,
            sample.pistonPin.y - sample.crankPin.y,
        );
        assertClose(distance, 2.8, 1e-9, 'Connecting-rod length constraint');
    }
}

function checkVelocityAtDeadCenters(): void {
    const model = createModel();
    assertClose(
        model.sampleAt(0).pistonVelocity,
        0,
        1e-10,
        'Right dead-center velocity',
    );
    assertClose(
        model.sampleAt(Math.PI).pistonVelocity,
        0,
        1e-10,
        'Left dead-center velocity',
    );
}

function checkCycleFiniteness(): void {
    const model = createModel();
    const cycle = model.sampleCycle(181);
    assert(cycle.length === 181, 'Slider-crank cycle sample count changed');
    for (const point of cycle) {
        assert(Number.isFinite(point.position), 'Slider-crank position became non-finite');
        assert(Number.isFinite(point.velocity), 'Slider-crank velocity became non-finite');
        assert(Number.isFinite(point.acceleration), 'Slider-crank acceleration became non-finite');
    }
}

function createModel(): SliderCrankModel {
    return new SliderCrankModel({
        crankRadius: 0.8,
        rodLength: 2.8,
        angularVelocity: 2,
    });
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

function assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(message);
}
