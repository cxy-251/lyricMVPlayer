import { RollingBodyRaceModel } from './RollingBodyRaceModel';

export function runRollingBodyRaceContractChecks(): void {
    checkFinishOrder();
    checkEnergyPartition();
    checkSteeperRampFinishesEarlier();
}

function checkFinishOrder(): void {
    const model = createModel(20);
    const bodies = model.snapshot().bodies;
    const finishTimes = bodies.map((body) => body.finishTime);
    assert(
        finishTimes[0] < finishTimes[1]
            && finishTimes[1] < finishTimes[2]
            && finishTimes[2] < finishTimes[3],
        'Rolling race finish order did not follow increasing inertia factor',
    );
}

function checkEnergyPartition(): void {
    const model = createModel(20);
    for (const body of model.snapshot().bodies) {
        assert(
            Math.abs(
                body.translationalEnergyFraction
                + body.rotationalEnergyFraction
                - 1
            ) < 1e-12,
            `Rolling race energy fractions did not sum to one for ${body.id}`,
        );
    }
}

function checkSteeperRampFinishesEarlier(): void {
    const shallow = createModel(12).diagnostics().winnerTime;
    const steep = createModel(32).diagnostics().winnerTime;
    assert(
        steep < shallow,
        'Rolling race did not finish earlier on a steeper ramp',
    );
}

function createModel(angleDegrees: number): RollingBodyRaceModel {
    return new RollingBodyRaceModel({
        gravity: 9.81,
        slopeAngleRadians: angleDegrees * Math.PI / 180,
        rampLength: 7,
        radius: 0.23,
    });
}

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}
