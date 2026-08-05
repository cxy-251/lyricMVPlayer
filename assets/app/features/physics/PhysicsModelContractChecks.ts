import { DoublePendulumModel } from './double-pendulum/DoublePendulumModel';
import { LorenzAttractorModel } from './lorenz-attractor/LorenzAttractorModel';

export function runPhysicsModelContractChecks(): void {
    checkDoublePendulumEnergy();
    checkLorenzEquilibrium();
    checkLorenzDeterminism();
    checkLorenzSensitivity();
}

function checkDoublePendulumEnergy(): void {
    const model = new DoublePendulumModel({
        gravity: 9.81,
        mass1: 1,
        mass2: 1,
        length1: 1,
        length2: 1,
    });
    for (let index = 0; index < 240; index += 1) {
        model.step(1 / 240);
    }
    const diagnostics = model.diagnostics();
    assert(Number.isFinite(diagnostics.totalEnergy), 'Double pendulum produced non-finite energy');
    assert(
        diagnostics.normalizedEnergyDrift < 1e-3,
        'Double pendulum RK4 energy drift exceeded the preview contract',
    );
}

function checkLorenzEquilibrium(): void {
    const model = new LorenzAttractorModel({ sigma: 10, rho: 28, beta: 8 / 3 });
    model.reset({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    for (let index = 0; index < 120; index += 1) {
        model.step(1 / 240);
    }
    const state = model.snapshot();
    assert(
        state.primary.x === 0 && state.primary.y === 0 && state.primary.z === 0,
        'Lorenz origin equilibrium was not invariant',
    );
}

function checkLorenzDeterminism(): void {
    const parameters = { sigma: 10, rho: 28, beta: 8 / 3 };
    const first = new LorenzAttractorModel(parameters);
    const second = new LorenzAttractorModel(parameters);
    for (let index = 0; index < 480; index += 1) {
        first.step(1 / 240);
        second.step(1 / 240);
    }
    assertEqual(first.snapshot(), second.snapshot(), 'Lorenz integration is not deterministic');
}

function checkLorenzSensitivity(): void {
    const model = new LorenzAttractorModel({ sigma: 10, rho: 28, beta: 8 / 3 });
    model.reset(
        { x: 1, y: 1, z: 1 },
        { x: 1.00001, y: 1, z: 1 },
    );
    const initial = model.diagnostics().separation;
    for (let index = 0; index < 4800; index += 1) {
        model.step(1 / 240);
    }
    const final = model.diagnostics().separation;
    assert(final > initial * 100, 'Lorenz nearby trajectories did not separate');
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
