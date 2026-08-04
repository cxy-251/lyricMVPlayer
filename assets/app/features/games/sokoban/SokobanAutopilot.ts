import type {
    SokobanDirection,
    SokobanObservation,
} from './SokobanTypes';

const SEARCH_EXPANSION_LIMIT = 50000;
const DIRECTIONS: readonly SokobanDirection[] = [
    'up',
    'down',
    'left',
    'right',
];
const OFFSETS: Record<SokobanDirection, readonly [number, number]> = {
    up: [-1, 0],
    down: [1, 0],
    left: [0, -1],
    right: [0, 1],
};

interface SearchNode {
    readonly boxes: readonly number[];
    readonly player: number;
    readonly parent: number;
    readonly segment: readonly SokobanDirection[];
    readonly pushes: number;
    readonly heuristic: number;
    readonly priority: number;
}

interface SearchAdvanceResult {
    readonly plan: readonly SokobanDirection[] | null;
    readonly failed: boolean;
}

interface Reachability {
    readonly reachable: readonly boolean[];
    readonly parent: readonly number[];
    readonly direction: readonly (SokobanDirection | null)[];
}

class SearchHeap {
    private readonly values: number[] = [];

    constructor(private readonly nodes: readonly SearchNode[]) {}

    get size(): number {
        return this.values.length;
    }

    push(nodeIndex: number): void {
        this.values.push(nodeIndex);
        let index = this.values.length - 1;
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (!this.less(this.values[index], this.values[parent])) {
                break;
            }
            [this.values[index], this.values[parent]] = [
                this.values[parent],
                this.values[index],
            ];
            index = parent;
        }
    }

    pop(): number | null {
        if (this.values.length === 0) {
            return null;
        }
        const result = this.values[0];
        const tail = this.values.pop();
        if (this.values.length > 0 && tail !== undefined) {
            this.values[0] = tail;
            let index = 0;
            while (true) {
                const left = index * 2 + 1;
                const right = left + 1;
                let smallest = index;
                if (
                    left < this.values.length
                    && this.less(this.values[left], this.values[smallest])
                ) {
                    smallest = left;
                }
                if (
                    right < this.values.length
                    && this.less(this.values[right], this.values[smallest])
                ) {
                    smallest = right;
                }
                if (smallest === index) {
                    break;
                }
                [this.values[index], this.values[smallest]] = [
                    this.values[smallest],
                    this.values[index],
                ];
                index = smallest;
            }
        }
        return result;
    }

    private less(leftIndex: number, rightIndex: number): boolean {
        const left = this.nodes[leftIndex];
        const right = this.nodes[rightIndex];
        if (left.priority !== right.priority) {
            return left.priority < right.priority;
        }
        if (left.heuristic !== right.heuristic) {
            return left.heuristic < right.heuristic;
        }
        return left.pushes < right.pushes;
    }
}

class SokobanSearchSession {
    private readonly width: number;
    private readonly height: number;
    private readonly walls: readonly boolean[];
    private readonly goals: readonly boolean[];
    private readonly goalIndexes: readonly number[];
    private readonly deadSquares: ReadonlySet<number>;
    private readonly nodes: SearchNode[] = [];
    private readonly frontier: SearchHeap;
    private readonly visited = new Map<string, number>();
    private expansions = 0;
    private failed = false;

    constructor(observation: SokobanObservation) {
        this.width = observation.width;
        this.height = observation.height;
        this.walls = observation.walls;
        this.goals = observation.goals;
        this.goalIndexes = observation.goals
            .map((goal, index) => goal ? index : -1)
            .filter((index) => index >= 0);
        this.deadSquares = this.computeDeadSquares();
        const boxes = [...observation.boxes].sort((left, right) => left - right);
        const heuristic = this.assignmentDistance(boxes);
        this.nodes.push({
            boxes,
            player: observation.player,
            parent: -1,
            segment: [],
            pushes: 0,
            heuristic,
            priority: heuristic,
        });
        this.frontier = new SearchHeap(this.nodes);
        this.frontier.push(0);
        this.visited.set(this.stateKey(boxes, observation.player), 0);
    }

    advance(budget: number): SearchAdvanceResult {
        if (this.failed) {
            return { plan: null, failed: true };
        }
        const expansionBudget = Math.max(1, Math.floor(budget));
        for (let used = 0; used < expansionBudget; used += 1) {
            if (
                this.frontier.size === 0
                || this.expansions >= SEARCH_EXPANSION_LIMIT
            ) {
                this.failed = true;
                return { plan: null, failed: true };
            }
            const nodeIndex = this.frontier.pop();
            if (nodeIndex === null) {
                this.failed = true;
                return { plan: null, failed: true };
            }
            const node = this.nodes[nodeIndex];
            this.expansions += 1;
            if (this.isSolved(node.boxes)) {
                return {
                    plan: this.reconstruct(nodeIndex),
                    failed: false,
                };
            }
            this.expand(nodeIndex, node);
        }
        return { plan: null, failed: false };
    }

    private expand(nodeIndex: number, node: SearchNode): void {
        const boxSet = new Set(node.boxes);
        const reachability = this.computeReachability(node.player, boxSet);

        for (const box of node.boxes) {
            for (const direction of DIRECTIONS) {
                const destination = this.offsetIndex(box, direction, 1);
                const pushFrom = this.offsetIndex(box, direction, -1);
                if (
                    destination < 0
                    || pushFrom < 0
                    || this.walls[destination]
                    || boxSet.has(destination)
                    || !reachability.reachable[pushFrom]
                ) {
                    continue;
                }

                const nextBoxes = node.boxes
                    .map((value) => value === box ? destination : value)
                    .sort((left, right) => left - right);
                if (this.isDeadlocked(nextBoxes, destination)) {
                    continue;
                }
                const pushes = node.pushes + 1;
                const nextPlayer = box;
                const key = this.stateKey(nextBoxes, nextPlayer);
                const previousCost = this.visited.get(key);
                if (previousCost !== undefined && previousCost <= pushes) {
                    continue;
                }

                const walking = this.reconstructWalkingPath(
                    node.player,
                    pushFrom,
                    reachability,
                );
                if (!walking) {
                    continue;
                }
                const segment = [...walking, direction];
                const heuristic = this.assignmentDistance(nextBoxes);
                const pathPenalty = Math.min(12, walking.length) * 0.035;
                const priority = pushes + heuristic + pathPenalty;
                const nextIndex = this.nodes.length;
                this.nodes.push({
                    boxes: nextBoxes,
                    player: nextPlayer,
                    parent: nodeIndex,
                    segment,
                    pushes,
                    heuristic,
                    priority,
                });
                this.visited.set(key, pushes);
                this.frontier.push(nextIndex);
            }
        }
    }

    private reconstruct(nodeIndex: number): SokobanDirection[] {
        const segments: Array<readonly SokobanDirection[]> = [];
        let cursor = nodeIndex;
        while (cursor >= 0) {
            const node = this.nodes[cursor];
            if (node.segment.length > 0) {
                segments.push(node.segment);
            }
            cursor = node.parent;
        }
        const result: SokobanDirection[] = [];
        for (let index = segments.length - 1; index >= 0; index -= 1) {
            result.push(...segments[index]);
        }
        return result;
    }

    private computeReachability(
        start: number,
        boxes: ReadonlySet<number>,
    ): Reachability {
        const size = this.width * this.height;
        const reachable = new Array<boolean>(size).fill(false);
        const parent = new Array<number>(size).fill(-1);
        const direction = new Array<SokobanDirection | null>(size).fill(null);
        const queue = [start];
        reachable[start] = true;

        for (let cursor = 0; cursor < queue.length; cursor += 1) {
            const current = queue[cursor];
            for (const move of DIRECTIONS) {
                const next = this.offsetIndex(current, move, 1);
                if (
                    next < 0
                    || reachable[next]
                    || this.walls[next]
                    || boxes.has(next)
                ) {
                    continue;
                }
                reachable[next] = true;
                parent[next] = current;
                direction[next] = move;
                queue.push(next);
            }
        }
        return { reachable, parent, direction };
    }

    private reconstructWalkingPath(
        start: number,
        destination: number,
        reachability: Reachability,
    ): SokobanDirection[] | null {
        if (!reachability.reachable[destination]) {
            return null;
        }
        const reversed: SokobanDirection[] = [];
        let cursor = destination;
        while (cursor !== start) {
            const move = reachability.direction[cursor];
            const parent = reachability.parent[cursor];
            if (!move || parent < 0) {
                return null;
            }
            reversed.push(move);
            cursor = parent;
        }
        reversed.reverse();
        return reversed;
    }

    private assignmentDistance(boxes: readonly number[]): number {
        const count = Math.min(boxes.length, this.goalIndexes.length);
        if (count === 0) {
            return 0;
        }
        const memo = new Map<string, number>();
        const solve = (boxIndex: number, mask: number): number => {
            if (boxIndex >= count) {
                return 0;
            }
            const key = `${boxIndex}:${mask}`;
            const cached = memo.get(key);
            if (cached !== undefined) {
                return cached;
            }
            let best = Number.POSITIVE_INFINITY;
            for (let goalIndex = 0; goalIndex < count; goalIndex += 1) {
                const bit = 1 << goalIndex;
                if ((mask & bit) !== 0) {
                    continue;
                }
                const distance = this.manhattan(
                    boxes[boxIndex],
                    this.goalIndexes[goalIndex],
                );
                best = Math.min(
                    best,
                    distance + solve(boxIndex + 1, mask | bit),
                );
            }
            memo.set(key, best);
            return best;
        };
        return solve(0, 0);
    }

    private manhattan(left: number, right: number): number {
        const leftRow = Math.floor(left / this.width);
        const leftColumn = left % this.width;
        const rightRow = Math.floor(right / this.width);
        const rightColumn = right % this.width;
        return Math.abs(leftRow - rightRow) + Math.abs(leftColumn - rightColumn);
    }

    private isSolved(boxes: readonly number[]): boolean {
        return boxes.length > 0 && boxes.every((box) => this.goals[box]);
    }

    private isDeadlocked(
        boxes: readonly number[],
        movedBox: number,
    ): boolean {
        const boxSet = new Set(boxes);
        if (!this.goals[movedBox] && this.deadSquares.has(movedBox)) {
            return true;
        }
        const row = Math.floor(movedBox / this.width);
        const column = movedBox % this.width;
        for (const rowStart of [row - 1, row]) {
            for (const columnStart of [column - 1, column]) {
                const square = [
                    this.indexAt(rowStart, columnStart),
                    this.indexAt(rowStart, columnStart + 1),
                    this.indexAt(rowStart + 1, columnStart),
                    this.indexAt(rowStart + 1, columnStart + 1),
                ];
                if (square.some((index) => index < 0)) {
                    continue;
                }
                if (
                    square.every((index) => this.walls[index] || boxSet.has(index))
                    && square.some((index) => boxSet.has(index) && !this.goals[index])
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    private computeDeadSquares(): ReadonlySet<number> {
        const reachable = new Set<number>();
        const queue: number[] = [];
        for (const goal of this.goalIndexes) {
            reachable.add(goal);
            queue.push(goal);
        }

        for (let cursor = 0; cursor < queue.length; cursor += 1) {
            const current = queue[cursor];
            for (const direction of DIRECTIONS) {
                const previous = this.offsetIndex(current, direction, -1);
                const support = this.offsetIndex(current, direction, -2);
                if (
                    previous >= 0
                    && support >= 0
                    && !this.walls[previous]
                    && !this.walls[support]
                    && !reachable.has(previous)
                ) {
                    reachable.add(previous);
                    queue.push(previous);
                }
            }
        }

        const result = new Set<number>();
        for (let index = 0; index < this.walls.length; index += 1) {
            if (!this.walls[index] && !this.goals[index] && !reachable.has(index)) {
                result.add(index);
            }
        }
        return result;
    }

    private stateKey(boxes: readonly number[], player: number): string {
        return `${boxes.join(',')}|${player}`;
    }

    private offsetIndex(
        index: number,
        direction: SokobanDirection,
        distance: number,
    ): number {
        const [rowOffset, columnOffset] = OFFSETS[direction];
        const row = Math.floor(index / this.width) + rowOffset * distance;
        const column = index % this.width + columnOffset * distance;
        return this.indexAt(row, column);
    }

    private indexAt(row: number, column: number): number {
        if (
            row < 0
            || row >= this.height
            || column < 0
            || column >= this.width
        ) {
            return -1;
        }
        return row * this.width + column;
    }
}

export class SokobanAutopilot {
    private session: SokobanSearchSession | null = null;
    private plan: SokobanDirection[] = [];
    private failedValue = false;

    get planning(): boolean {
        return this.session !== null && this.plan.length === 0;
    }

    get failed(): boolean {
        return this.failedValue;
    }

    reset(): void {
        this.session = null;
        this.plan = [];
        this.failedValue = false;
    }

    update(observation: SokobanObservation, expansionBudget: number): void {
        if (
            observation.phase !== 'playing'
            || this.plan.length > 0
            || this.failedValue
        ) {
            return;
        }
        if (!this.session) {
            this.session = new SokobanSearchSession(observation);
        }
        const result = this.session.advance(expansionBudget);
        if (result.plan) {
            this.plan = [...result.plan];
            this.session = null;
        } else if (result.failed) {
            this.failedValue = true;
            this.session = null;
        }
    }

    takeAction(): SokobanDirection | null {
        return this.plan.shift() ?? null;
    }

    consumeFailure(): boolean {
        if (!this.failedValue) {
            return false;
        }
        this.failedValue = false;
        return true;
    }
}
