import { DrivenCavityFlowModel } from './DrivenCavityFlowModel';

export function runDrivenCavityFlowContractChecks(): void {
    checkRestState();
    checkDrivenRecirculation();
    checkMassConservation();
    checkResolutionReconfiguration();
}

function checkRestState(): void {
    const model = createModel(0);
    model.step(60);
    assert(
        model.diagnostics().maximumSpeed < 1e-10,
        'Stationary cavity generated velocity without a moving wall',
    );
}

function checkDrivenRecirculation(): void {
    const model = createModel(0.08);
    model.step(160);
    const snapshot = model.snapshot();
    const diagnostics = model.diagnostics();
    const center = Math.floor(snapshot.height / 2) * snapshot.width
        + Math.floor(snapshot.width / 2);
    assert(
        diagnostics.topMeanVelocityX > 0.03,
        'Moving lid did not transfer positive horizontal momentum',
    );
    assert(
        snapshot.velocityX[center] < -0.002,
        'Driven cavity did not form the expected central return flow',
    );
    assert(
        Number.isFinite(diagnostics.maximumSpeed),
        'Driven cavity produced a non-finite velocity',
    );
}

function checkMassConservation(): void {
    const model = createModel(0.08);
    model.step(180);
    assert(
        Math.abs(model.diagnostics().normalizedMassDrift) < 1e-6,
        'Driven cavity failed to conserve lattice mass',
    );
}

function checkResolutionReconfiguration(): void {
    const model = createModel(0.08);
    model.setParameters({
        width: 32,
        height: 32,
        lidSpeed: 0.06,
        kinematicViscosity: 0.05,
    });
    assert(
        model.snapshot().velocityX.length === 32 * 32,
        'Driven cavity did not reallocate its lattice after a resolution change',
    );
}

function createModel(lidSpeed: number): DrivenCavityFlowModel {
    return new DrivenCavityFlowModel({
        width: 24,
        height: 24,
        lidSpeed,
        kinematicViscosity: 0.04,
    });
}

function assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(message);
}
