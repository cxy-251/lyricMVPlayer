import type { EventKeyboard } from 'cc';
import { AppState } from '../../../core/AppState';
import { InputRouter } from '../../../services/InputRouter';
import { Game2048Model } from '../game-2048/Game2048Model';
import { MinesweeperModel } from '../minesweeper/MinesweeperModel';
import { SnakeModel } from '../snake/SnakeModel';
import { HybridGameSession } from './HybridGameSession';
import {
    LinearCongruentialRandom,
    XorShift32Random,
} from './RandomSource';

export function runGameModelContractChecks(): void {
    checkAppStateSubscriptionCleanup();
    checkInputRouterContracts();
    checkHybridSessionContracts();
    checkRandomDeterminism();
    checkSnakeDeterminism();
    check2048MergeContract();
    checkMinesweeperContracts();
}

function checkAppStateSubscriptionCleanup(): void {
    const state = new AppState();
    let calls = 0;
    assertThrows(() => {
        state.subscribe(() => {
            calls += 1;
            throw new Error('expected subscription failure');
        });
    }, 'AppState did not forward the initial listener failure');
    state.setActiveModule('contract-check', 'Contract Check');
    assert(calls === 1, 'AppState retained a listener after its initial callback failed');
}

function checkInputRouterContracts(): void {
    const event = {} as EventKeyboard;
    const priorityRouter = new InputRouter();
    const priorityCalls: string[] = [];
    priorityRouter.bind({
        priority: 1,
        onKeyDown: () => {
            priorityCalls.push('low');
            return true;
        },
    });
    const unbindHigh = priorityRouter.bind({
        priority: 10,
        onKeyDown: () => {
            priorityCalls.push('high');
            return false;
        },
    });
    assert(priorityRouter.dispatchKeyDown(event), 'InputRouter did not report a consumed key');
    assertEqual(
        priorityCalls,
        ['high', 'low'],
        'InputRouter did not dispatch routes by priority',
    );
    unbindHigh();
    unbindHigh();

    const mutationRouter = new InputRouter();
    const mutationCalls: string[] = [];
    const unbindLow = mutationRouter.bind({
        priority: 1,
        onKeyDown: () => {
            mutationCalls.push('low');
            return true;
        },
    });
    mutationRouter.bind({
        priority: 10,
        onKeyDown: () => {
            mutationCalls.push('high');
            unbindLow();
            return false;
        },
    });
    assert(
        !mutationRouter.dispatchKeyDown(event),
        'InputRouter dispatched a route removed during the same key event',
    );
    assertEqual(
        mutationCalls,
        ['high'],
        'InputRouter called an unbound route from its dispatch snapshot',
    );
}

function checkHybridSessionContracts(): void {
    const session = new HybridGameSession({
        aiTakeoverDelay: 1,
        aiActionInterval: 0.5,
        resultHold: 0.75,
        renderInterval: 0.25,
    });
    assert(session.shouldRunAi(0), 'Hybrid session did not allow the initial AI action');
    session.activateHuman();
    assert(
        !session.shouldActivateAutopilot(0.5),
        'Hybrid session activated AI before the takeover delay',
    );
    assert(
        session.shouldActivateAutopilot(0.5),
        'Hybrid session did not activate AI at the takeover delay',
    );
    session.activateAutopilot();
    session.resetAiClock(false);
    assert(!session.shouldRunAi(0.25), 'Hybrid session ran AI before its interval');
    assert(session.shouldRunAi(0.25), 'Hybrid session missed the configured AI interval');
    assert(
        !session.shouldRestartTerminal(0.5),
        'Hybrid session restarted a terminal state too early',
    );
    assert(
        session.shouldRestartTerminal(0.25),
        'Hybrid session missed the configured terminal hold',
    );
    assert(session.beginFrame(Number.NaN) === 0, 'Hybrid session accepted a non-finite delta time');
    assertThrows(() => {
        new HybridGameSession({
            aiTakeoverDelay: 1,
            aiActionInterval: 0,
            resultHold: 1,
            renderInterval: 1 / 30,
        });
    }, 'Hybrid session accepted a zero AI interval');
}

function checkRandomDeterminism(): void {
    const first = new XorShift32Random(0x12345678);
    const second = new XorShift32Random(0x12345678);
    for (let index = 0; index < 16; index += 1) {
        assert(first.next() === second.next(), 'XorShift32 sequence is not deterministic');
    }
}

function checkSnakeDeterminism(): void {
    const first = new SnakeModel(new XorShift32Random(0x13572468));
    const second = new SnakeModel(new XorShift32Random(0x13572468));
    assertEqual(
        first.createObservation(),
        second.createObservation(),
        'Snake reset is not reproducible',
    );
}

function check2048MergeContract(): void {
    const result = Game2048Model.simulateMove([
        [2, 2, 2, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ], 'left');
    assertEqual(result.board[0], [4, 4, 0, 0], '2048 merged a tile more than once');
    assert(result.score === 8, '2048 merge score is incorrect');

    const first = new Game2048Model(new XorShift32Random(0x24681357));
    const second = new Game2048Model(new XorShift32Random(0x24681357));
    assertEqual(
        first.createObservation(),
        second.createObservation(),
        '2048 reset is not reproducible',
    );
}

function checkMinesweeperContracts(): void {
    const first = new MinesweeperModel(
        9,
        9,
        10,
        new LinearCongruentialRandom(0x10203040),
    );
    const second = new MinesweeperModel(
        9,
        9,
        10,
        new LinearCongruentialRandom(0x10203040),
    );
    first.reveal(4, 4);
    second.reveal(4, 4);
    assertEqual(
        first.createCellViewStates(),
        second.createCellViewStates(),
        'Minesweeper generation is not reproducible',
    );

    const flagLimited = new MinesweeperModel(
        4,
        4,
        1,
        new LinearCongruentialRandom(1),
    );
    assert(flagLimited.toggleFlag(0, 0), 'Minesweeper rejected the first flag');
    assert(!flagLimited.toggleFlag(0, 1), 'Minesweeper accepted more flags than mines');
    assert(flagLimited.toggleFlag(0, 0), 'Minesweeper could not remove a flag');
}

function assertThrows(action: () => void, message: string): void {
    let threw = false;
    try {
        action();
    } catch {
        threw = true;
    }
    assert(threw, message);
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
    assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

function assert(condition: boolean, message: string): asserts condition {
    if (!condition) {
        throw new Error(`Game contract failed: ${message}`);
    }
}
