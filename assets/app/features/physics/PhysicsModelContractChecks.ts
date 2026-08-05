import { DoublePendulumModel } from './double-pendulum/DoublePendulumModel';
import { MassSpringDamperModel } from './mass-spring-damper/MassSpringDamperModel';

export function runPhysicsModelContractChecks(): void {
    checkDoublePendulumEnergy();
    checkMassSpringEquilibrium();
    checkMassSpringEnergy();
    checkMassSpringRegimes();
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
    assert(
        Number.isFinite(diagnostics.totalEnergy),
        'Double pendulum produced non-finite energy',
    );
    assert(
        diagnostics.normalizedEnergyDrift < 1e-3,
        'Double pendulum RK4 energy drift exceeded the preview contract',
    );
}

function checkMassSpringEquilibrium(): void {
    const model = new MassSpringDamperModel({
        mass: 1,
        stiffness: 10,
        damping: 1,
        forcingAmplitude: 0,
        forcingFrequency: 0,
    });
    model.reset({ displacement: 0, velocity: 0 });
    for (let index = 0; index < 240; index += 1) {
        model.step(1 / 240);
    }
    const snapshot = model.snapshot();
    assert(
        Math.abs(snapshot.displacement) < 1e-12
            && Math.abs(snapshot.velocity) < 1e-12,
        'Mass-spring-damper equilibrium was not invariant',
    );
}

function checkMassSpringEnergy(): void {
    const model = new MassSpringDamperModel({
        mass: 1,
        stiffness: 16,
        damping: 0,
        forcingAmplitude: 0,
        forcingFrequency: 0,
    });
    model.reset({ displacement: 0.4, velocity: 0 });
    const initialEnergy = model.diagnostics().mechanicalEnergy;
    for (let index = 0; index < 480; index += 1) {
        model.step(1 / 240);
    }
    const finalEnergy = model.diagnostics().mechanicalEnergy;
    assert(
        Math.abs(finalEnergy - initialEnergy) / initialEnergy < 1e-6,
        'Undamped mass-spring energy drift exceeded the preview contract',
    );
}

function checkMassSpringRegimes(): void {
    const base = {
        mass: 1,
        stiffness: 9,
        forcingAmplitude: 0,
        forcingFrequency: 0,
    };
    const underdamped = new MassSpringDamperModel({ ...base, damping: 2 });
    const critical = new MassSpringDamperModel({ ...base, damping: 6 });
    const overdamped = new MassSpringDamperModel({ ...base, damping: 8 });

    assert(
        underdamped.diagnostics().regime === 'underdamped',
        'Underdamped regime classification changed',
    );
    assert(
        critical.diagnostics().regime === 'critical',
        'Critical regime classification changed',
    );
    assert(
        overdamped.diagnostics().regime === 'overdamped',
        'Overdamped regime classification changed',
    );
}

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}
