import { DoublePendulumModel } from './double-pendulum/DoublePendulumModel';
import { LorenzAttractorModel } from './lorenz-attractor/LorenzAttractorModel';
import { RestrictedThreeBodyModel } from './restricted-three-body/RestrictedThreeBodyModel';

export function runPhysicsModelContractChecks(): void {
    checkDoublePendulumEnergy();
    checkLorenzEquilibrium();
    checkLorenzDeterminism();
    checkLorenzSensitivity();
    checkRestrictedThreeBodyL4Equilibrium();
    checkRestrictedThreeBodyDeterminism();
    checkRestrictedThreeBodyJacobiDrift();
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

function checkRestrictedThreeBodyL4Equilibrium(): void {
    const mu = 0.01215;
    const model = new RestrictedThreeBodyModel({ mu });
    const initial = {
        x: 0.5 - mu,
        y: Math.sqrt(3) / 2,
        vx: 0,
        vy: 0,
    };
    model.reset(initial);
    for (let index = 0; index < 720; index += 1) {
        model.step(1 / 720);
    }
    const state = model.snapshot().state;
    assert(
        Math.hypot(state.x - initial.x, state.y - initial.y) < 1e-8,
        'Restricted three-body L4 equilibrium drifted',
    );
}

function checkRestrictedThreeBodyDeterminism(): void {
    const first = new RestrictedThreeBodyModel({ mu: 0.01215 });
    const second = new RestrictedThreeBodyModel({ mu: 0.01215 });
    for (let index = 0; index < 1200; index += 1) {
        first.step(1 / 720);
        second.step(1 / 720);
    }
    assertEqual(
        first.snapshot(),
        second.snapshot(),
        'Restricted three-body integration is not deterministic',
    );
}

function checkRestrictedThreeBodyJacobiDrift(): void {
    const model = new RestrictedThreeBodyModel({ mu: 0.01215 });
    for (let index = 0; index < 1200; index += 1) {
        model.step(1 / 720);
    }
    assert(
        model.diagnostics().normalizedJacobiDrift < 1e-6,
        'Restricted three-body Jacobi drift exceeded the preview contract',
    );
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
