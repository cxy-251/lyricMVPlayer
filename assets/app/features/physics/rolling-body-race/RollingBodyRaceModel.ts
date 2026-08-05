import type {
    RollingBodyDefinition,
    RollingBodyState,
    RollingRaceDiagnostics,
    RollingRaceParameters,
    RollingRaceSnapshot,
} from './RollingBodyRaceTypes';

export const ROLLING_BODY_DEFINITIONS: readonly RollingBodyDefinition[] = [
    {
        id: 'solid-sphere',
        label: 'Solid sphere',
        inertiaFactor: 2 / 5,
    },
    {
        id: 'solid-cylinder',
        label: 'Solid cylinder',
        inertiaFactor: 1 / 2,
    },
    {
        id: 'hollow-sphere',
        label: 'Hollow sphere',
        inertiaFactor: 2 / 3,
    },
    {
        id: 'ring',
        label: 'Ring',
        inertiaFactor: 1,
    },
];

export class RollingBodyRaceModel {
    private currentParameters: RollingRaceParameters;
    private elapsedTime = 0;

    constructor(parameters: RollingRaceParameters) {
        this.currentParameters = this.validateParameters(parameters);
    }

    get parameters(): RollingRaceParameters {
        return this.currentParameters;
    }

    setParameters(parameters: RollingRaceParameters): void {
        this.currentParameters = this.validateParameters(parameters);
    }

    reset(): void {
        this.elapsedTime = 0;
    }

    step(dt: number): void {
        if (!Number.isFinite(dt) || dt <= 0) {
            throw new Error('Rolling race step must be positive and finite');
        }
        this.elapsedTime += dt;
    }

    snapshot(): RollingRaceSnapshot {
        const bodies = ROLLING_BODY_DEFINITIONS.map((definition) => (
            this.createBodyState(definition)
        ));
        return {
            elapsedTime: this.elapsedTime,
            bodies,
            allFinished: bodies.every((body) => body.finished),
        };
    }

    diagnostics(): RollingRaceDiagnostics {
        const snapshot = this.snapshot();
        const sorted = [...snapshot.bodies]
            .sort((left, right) => left.finishTime - right.finishTime);
        const winner = sorted[0];
        const last = sorted[sorted.length - 1];
        return {
            winner: winner.id,
            winnerLabel: winner.label,
            winnerTime: winner.finishTime,
            lastFinishTime: last.finishTime,
            raceProgress: snapshot.bodies.reduce(
                (sum, body) => sum + body.progress,
                0,
            ) / snapshot.bodies.length,
        };
    }

    acceleration(inertiaFactor: number): number {
        const { gravity, slopeAngleRadians } = this.currentParameters;
        return gravity * Math.sin(slopeAngleRadians) / (1 + inertiaFactor);
    }

    private createBodyState(definition: RollingBodyDefinition): RollingBodyState {
        const { rampLength, radius } = this.currentParameters;
        const acceleration = this.acceleration(definition.inertiaFactor);
        const finishTime = Math.sqrt(2 * rampLength / acceleration);
        const activeTime = Math.min(this.elapsedTime, finishTime);
        const distance = Math.min(
            rampLength,
            0.5 * acceleration * activeTime * activeTime,
        );
        const velocity = acceleration * activeTime;
        return {
            ...definition,
            distance,
            progress: distance / rampLength,
            velocity,
            angularPosition: distance / radius,
            finishTime,
            finished: this.elapsedTime >= finishTime,
            translationalEnergyFraction: 1 / (1 + definition.inertiaFactor),
            rotationalEnergyFraction: definition.inertiaFactor
                / (1 + definition.inertiaFactor),
        };
    }

    private validateParameters(parameters: RollingRaceParameters): RollingRaceParameters {
        if (!Number.isFinite(parameters.gravity) || parameters.gravity <= 0) {
            throw new Error('Rolling race gravity must be positive and finite');
        }
        if (
            !Number.isFinite(parameters.slopeAngleRadians)
            || parameters.slopeAngleRadians <= 0
            || parameters.slopeAngleRadians >= Math.PI / 2
        ) {
            throw new Error('Rolling race slope angle must be between 0 and 90 degrees');
        }
        if (!Number.isFinite(parameters.rampLength) || parameters.rampLength <= 0) {
            throw new Error('Rolling race ramp length must be positive and finite');
        }
        if (!Number.isFinite(parameters.radius) || parameters.radius <= 0) {
            throw new Error('Rolling body radius must be positive and finite');
        }
        return { ...parameters };
    }
}
