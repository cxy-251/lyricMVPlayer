import type {
    MinesweeperAction,
    MinesweeperObservation,
    MinesweeperObservationCell,
} from './MinesweeperTypes';

interface Constraint {
    readonly hidden: readonly number[];
    readonly remaining: number;
}

export class MinesweeperAutopilot {
    private decisionCursor = 0;

    reset(): void {
        this.decisionCursor = 0;
    }

    decide(observation: MinesweeperObservation): MinesweeperAction | null {
        if (observation.phase === 'ready') {
            return {
                kind: 'reveal',
                row: Math.floor(observation.rows / 2),
                column: Math.floor(observation.columns / 2),
            };
        }
        if (observation.phase !== 'playing') {
            return null;
        }

        const constraints = this.createConstraints(observation);
        for (const constraint of constraints) {
            if (constraint.remaining === 0 && constraint.hidden.length > 0) {
                return this.cellAction(observation, constraint.hidden[0], 'reveal');
            }
            if (
                constraint.remaining > 0
                && constraint.remaining === constraint.hidden.length
            ) {
                return this.cellAction(observation, constraint.hidden[0], 'flag');
            }
        }

        const inferred = this.subsetInference(observation, constraints);
        if (inferred) {
            return inferred;
        }
        return this.lowestRiskReveal(observation, constraints);
    }

    private createConstraints(observation: MinesweeperObservation): Constraint[] {
        const constraints: Constraint[] = [];
        for (const cell of observation.cells) {
            if (cell.state !== 'revealed' || cell.adjacentMines <= 0) {
                continue;
            }
            const hidden: number[] = [];
            let flags = 0;
            for (const neighborIndex of this.neighborIndexes(observation, cell)) {
                const neighbor = observation.cells[neighborIndex];
                if (neighbor.state === 'flagged') {
                    flags += 1;
                } else if (neighbor.state === 'hidden') {
                    hidden.push(neighborIndex);
                }
            }
            if (hidden.length === 0) {
                continue;
            }
            constraints.push({
                hidden,
                remaining: Math.max(0, cell.adjacentMines - flags),
            });
        }
        return constraints;
    }

    private subsetInference(
        observation: MinesweeperObservation,
        constraints: readonly Constraint[],
    ): MinesweeperAction | null {
        for (let firstIndex = 0; firstIndex < constraints.length; firstIndex += 1) {
            const first = constraints[firstIndex];
            const firstSet = new Set(first.hidden);
            for (let secondIndex = 0; secondIndex < constraints.length; secondIndex += 1) {
                if (firstIndex === secondIndex) {
                    continue;
                }
                const second = constraints[secondIndex];
                if (
                    first.hidden.length >= second.hidden.length
                    || !first.hidden.every((index) => second.hidden.includes(index))
                ) {
                    continue;
                }
                const difference = second.hidden.filter((index) => !firstSet.has(index));
                const remaining = second.remaining - first.remaining;
                if (difference.length === 0 || remaining < 0) {
                    continue;
                }
                if (remaining === 0) {
                    return this.cellAction(observation, difference[0], 'reveal');
                }
                if (remaining === difference.length) {
                    return this.cellAction(observation, difference[0], 'flag');
                }
            }
        }
        return null;
    }

    private lowestRiskReveal(
        observation: MinesweeperObservation,
        constraints: readonly Constraint[],
    ): MinesweeperAction | null {
        const hidden = observation.cells
            .map((cell, index) => ({ cell, index }))
            .filter(({ cell }) => cell.state === 'hidden');
        if (hidden.length === 0) {
            return null;
        }

        const globalRisk = this.clamp(
            observation.remainingMines / Math.max(1, hidden.length),
            0,
            1,
        );
        let bestRisk = Number.POSITIVE_INFINITY;
        const best: number[] = [];
        for (const { index } of hidden) {
            let riskTotal = 0;
            let riskCount = 0;
            let maximumRisk = 0;
            for (const constraint of constraints) {
                if (!constraint.hidden.includes(index)) {
                    continue;
                }
                const risk = this.clamp(
                    constraint.remaining / Math.max(1, constraint.hidden.length),
                    0,
                    1,
                );
                riskTotal += risk;
                riskCount += 1;
                maximumRisk = Math.max(maximumRisk, risk);
            }
            const risk = riskCount === 0
                ? globalRisk * 0.92
                : maximumRisk * 0.72 + riskTotal / riskCount * 0.28;
            if (risk < bestRisk - 0.0001) {
                bestRisk = risk;
                best.length = 0;
                best.push(index);
            } else if (Math.abs(risk - bestRisk) <= 0.0001) {
                best.push(index);
            }
        }

        const target = best[this.decisionCursor % best.length];
        this.decisionCursor += 1;
        return this.cellAction(observation, target, 'reveal');
    }

    private cellAction(
        observation: MinesweeperObservation,
        index: number,
        kind: 'reveal' | 'flag',
    ): MinesweeperAction {
        return {
            kind,
            row: Math.floor(index / observation.columns),
            column: index % observation.columns,
        };
    }

    private neighborIndexes(
        observation: MinesweeperObservation,
        cell: MinesweeperObservationCell,
    ): number[] {
        const result: number[] = [];
        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
            for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
                if (rowOffset === 0 && columnOffset === 0) {
                    continue;
                }
                const row = cell.row + rowOffset;
                const column = cell.column + columnOffset;
                if (
                    row >= 0
                    && row < observation.rows
                    && column >= 0
                    && column < observation.columns
                ) {
                    result.push(row * observation.columns + column);
                }
            }
        }
        return result;
    }

    private clamp(value: number, minimum: number, maximum: number): number {
        return Math.max(minimum, Math.min(maximum, value));
    }
}
