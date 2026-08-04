import { MatchThreeModel } from './MatchThreeModel';
import type {
    MatchThreeObservation,
    MatchThreeSwap,
} from './MatchThreeTypes';

export class MatchThreeAutopilot {
    decide(observation: MatchThreeObservation): MatchThreeSwap | null {
        if (observation.phase !== 'playing') {
            return null;
        }

        const swaps = MatchThreeModel.listLegalSwaps(observation.board);
        let best: MatchThreeSwap | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;

        for (const swap of swaps) {
            const score = MatchThreeModel.evaluateSwap(observation.board, swap);
            const center = (observation.size - 1) / 2;
            const centerBias = 8 - (
                Math.abs(swap.second.row - center)
                + Math.abs(swap.second.column - center)
            );
            const tieBreaker = (
                swap.first.row * 31
                + swap.first.column * 17
                + swap.second.row * 7
                + swap.second.column
            ) * 0.0001;
            const total = score + centerBias + tieBreaker;
            if (total > bestScore) {
                bestScore = total;
                best = swap;
            }
        }
        return best;
    }
}
