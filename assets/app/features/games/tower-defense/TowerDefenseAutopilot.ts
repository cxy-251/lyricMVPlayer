import { TowerDefenseModel } from './TowerDefenseModel';
import type {
    TowerDefenseAction,
    TowerDefenseObservation,
    TowerDefensePoint,
    TowerDefenseSlotState,
    TowerDefenseTowerKind,
} from './TowerDefenseTypes';

export class TowerDefenseAutopilot {
    decide(observation: TowerDefenseObservation): TowerDefenseAction | null {
        if (observation.phase === 'won' || observation.phase === 'lost') {
            return null;
        }

        const build = this.chooseBuild(observation);
        if (build) {
            return build;
        }

        const upgrade = this.chooseUpgrade(observation);
        if (upgrade) {
            return upgrade;
        }

        if (
            observation.phase === 'building'
            && (
                observation.slots.some((slot) => slot.tower !== null)
                || observation.timeToNextWave <= 1.2
            )
        ) {
            return { kind: 'start-wave' };
        }
        return null;
    }

    private chooseBuild(observation: TowerDefenseObservation): TowerDefenseAction | null {
        const empty = observation.slots.filter((slot) => slot.tower === null);
        if (empty.length === 0) {
            return null;
        }

        const cannonCount = observation.slots.filter((slot) => slot.tower?.kind === 'cannon').length;
        const towerCount = observation.slots.length - empty.length;
        const preferredKind: TowerDefenseTowerKind = (
            towerCount >= 2
            && cannonCount * 3 < Math.max(1, towerCount)
        ) ? 'cannon' : 'dart';
        const towerKinds: readonly TowerDefenseTowerKind[] = ['dart', 'cannon'];
        const affordableKinds = towerKinds.filter((kind) => (
            observation.gold >= TowerDefenseModel.buildCost(kind)
        ));
        if (affordableKinds.length === 0) {
            return null;
        }
        const kind = affordableKinds.includes(preferredKind)
            ? preferredKind
            : affordableKinds[0];

        let best: TowerDefenseSlotState | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const slot of empty) {
            const score = this.coverageScore(
                observation.path,
                slot,
                TowerDefenseModel.towerRange(kind, 1),
            ) + this.neighborDiversity(observation, slot) * 5;
            if (score > bestScore) {
                bestScore = score;
                best = slot;
            }
        }
        return best
            ? { kind: 'build', slotId: best.id, towerKind: kind }
            : null;
    }

    private chooseUpgrade(observation: TowerDefenseObservation): TowerDefenseAction | null {
        let best: TowerDefenseSlotState | null = null;
        let bestValue = Number.NEGATIVE_INFINITY;
        for (const slot of observation.slots) {
            const tower = slot.tower;
            if (!tower || tower.level >= 3) {
                continue;
            }
            const cost = TowerDefenseModel.upgradeCost(tower);
            if (observation.gold < cost) {
                continue;
            }
            const coverage = this.coverageScore(
                observation.path,
                slot,
                TowerDefenseModel.towerRange(tower.kind, tower.level + 1),
            );
            const pressure = observation.phase === 'wave'
                ? observation.enemies.filter((enemy) => enemy.progress > observation.path.length * 0.55).length
                : 0;
            const value = coverage * (tower.kind === 'cannon' ? 1.18 : 1)
                + pressure * 8
                - cost * 0.08
                + tower.level * 3;
            if (value > bestValue) {
                bestValue = value;
                best = slot;
            }
        }
        return best ? { kind: 'upgrade', slotId: best.id } : null;
    }

    private coverageScore(
        path: readonly TowerDefensePoint[],
        slot: TowerDefensePoint,
        range: number,
    ): number {
        const rangeSquared = range * range;
        let score = 0;
        for (let index = 0; index < path.length; index += 1) {
            const point = path[index];
            const dx = point.x - slot.x;
            const dy = point.y - slot.y;
            if (dx * dx + dy * dy > rangeSquared) {
                continue;
            }
            score += 4;
            if (index > 0 && index + 1 < path.length) {
                const previous = path[index - 1];
                const next = path[index + 1];
                const turn = (previous.x - point.x) !== (point.x - next.x)
                    || (previous.y - point.y) !== (point.y - next.y);
                if (turn) {
                    score += 7;
                }
            }
        }
        return score;
    }

    private neighborDiversity(
        observation: TowerDefenseObservation,
        slot: TowerDefensePoint,
    ): number {
        const nearbyKinds = new Set<TowerDefenseTowerKind>();
        for (const candidate of observation.slots) {
            if (!candidate.tower) {
                continue;
            }
            const distance = Math.abs(candidate.x - slot.x) + Math.abs(candidate.y - slot.y);
            if (distance <= 3) {
                nearbyKinds.add(candidate.tower.kind);
            }
        }
        return 2 - nearbyKinds.size;
    }
}
