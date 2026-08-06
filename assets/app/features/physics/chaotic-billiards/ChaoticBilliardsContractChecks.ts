import { ChaoticBilliardsModel } from './ChaoticBilliardsModel';

const DEFAULT_INITIAL_Y = 0.8;
const DEFAULT_LAUNCH_ANGLE = 10 * Math.PI / 180;
const DEFAULT_PERTURBATION = 0.001 * Math.PI / 180;

export function runChaoticBilliardsContractChecks(): void {
    checkSpeedPreservation();
    checkDeterminism();
    checkCircleRegularity();
    checkStadiumSensitivity();
}

function checkSpeedPreservation(): void {
    const model = createModel('stadium');
    for (let index = 0; index < 6000; index += 1) {
        model.step(1 / 240);
    }
    const diagnostics = model.diagnostics();
    assert(
        Math.abs(diagnostics.primarySpeed - 1) < 1e-9,
        'Chaotic billiards reflection changed the primary speed',
    );
    assert(
        Math.abs(diagnostics.nearbySpeed - 1) < 1e-9,
        'Chaotic billiards reflection changed the nearby speed',
    );
}

function checkDeterminism(): void {
    const first = createModel('stadium');
    const second = createModel('stadium');
    for (let index = 0; index < 4800; index += 1) {
        first.step(1 / 240);
        second.step(1 / 240);
    }
    assertEqual(
        first.snapshot(),
        second.snapshot(),
        'Chaotic billiards integration is not deterministic',
    );
}

function checkCircleRegularity(): void {
    const model = createModel('circle');
    for (let index = 0; index < 2880; index += 1) {
        model.step(1 / 240);
    }
    assert(
        model.diagnostics().separation < 1e-3,
        'Circular billiard nearby trajectories separated unexpectedly',
    );
}

function checkStadiumSensitivity(): void {
    const model = createModel('stadium');
    for (let index = 0; index < 2880; index += 1) {
        model.step(1 / 240);
    }
    assert(
        model.diagnostics().separation > 0.15,
        'Stadium billiard did not visibly amplify the nearby launch-angle difference',
    );
}

function createModel(boundary: 'stadium' | 'circle'): ChaoticBilliardsModel {
    const model = new ChaoticBilliardsModel({
        boundary,
        radius: 1,
        straightHalfLength: 1.1,
        particleSpeed: 1,
    });
    model.reset(
        DEFAULT_INITIAL_Y,
        DEFAULT_LAUNCH_ANGLE,
        DEFAULT_PERTURBATION,
    );
    return model;
}

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(message);
    }
}
