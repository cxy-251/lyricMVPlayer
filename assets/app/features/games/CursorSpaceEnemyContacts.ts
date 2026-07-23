import { CursorSpaceModel } from './CursorSpaceModel';
import type {
    CursorSpaceEffect,
    CursorSpaceEnemy,
    CursorSpacePlayer,
} from './CursorSpaceTypes';

const CONTACT_INSTALL_KEY: unique symbol = Symbol('cursor-space-enemy-contacts');
const PRIORITY_INSTALL_KEY: unique symbol = Symbol('cursor-space-enemy-priority');
const NORMAL_PURSUIT_HALF_ANGLE = Math.PI * 0.14;
const DODGE_PURSUIT_HALF_ANGLE = Math.PI * 0.38;

interface RuntimeModel {
    readonly player: CursorSpacePlayer;
    readonly enemies: CursorSpaceEnemy[];
    readonly effects: CursorSpaceEffect[];
    step(deltaTime: number): void;
    updateEnemies(deltaTime: number): void;
    [CONTACT_INSTALL_KEY]?: boolean;
    [PRIORITY_INSTALL_KEY]?: boolean;
}

function wrapAngle(value: number): number {
    let angle = value;
    while (angle > Math.PI) {
        angle -= Math.PI * 2;
    }
    while (angle < -Math.PI) {
        angle += Math.PI * 2;
    }
    return angle;
}

function spawnContactBurst(
    effects: readonly CursorSpaceEffect[],
    x: number,
    y: number,
): void {
    const ring = effects.find((effect) => !effect.active);
    if (ring) {
        ring.active = true;
        ring.kind = 'ring';
        ring.position.x = x;
        ring.position.y = y;
        ring.velocity.x = 0;
        ring.velocity.y = 0;
        ring.life = 0.3;
        ring.initialLife = ring.life;
        ring.radius = 6;
    }

    for (let index = 0; index < 4; index += 1) {
        const fragment = effects.find((effect) => !effect.active);
        if (!fragment) {
            return;
        }

        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 80;
        fragment.active = true;
        fragment.kind = 'fragment';
        fragment.position.x = x;
        fragment.position.y = y;
        fragment.velocity.x = Math.cos(angle) * speed;
        fragment.velocity.y = Math.sin(angle) * speed;
        fragment.life = 0.4;
        fragment.initialLife = fragment.life;
        fragment.radius = 4;
    }
}

function destroyEnemyPair(
    first: CursorSpaceEnemy,
    second: CursorSpaceEnemy,
    effects: readonly CursorSpaceEffect[],
): void {
    const firstX = first.position.x;
    const firstY = first.position.y;
    const secondX = second.position.x;
    const secondY = second.position.y;

    first.active = false;
    second.active = false;
    first.threat = 0;
    second.threat = 0;
    spawnContactBurst(effects, firstX, firstY);
    spawnContactBurst(effects, secondX, secondY);
}

function resolveEnemyContacts(model: RuntimeModel): void {
    const enemies = model.enemies;

    for (let firstIndex = 0; firstIndex < enemies.length; firstIndex += 1) {
        const first = enemies[firstIndex];
        if (!first.active) {
            continue;
        }

        for (let secondIndex = firstIndex + 1; secondIndex < enemies.length; secondIndex += 1) {
            const second = enemies[secondIndex];
            if (!second.active) {
                continue;
            }

            const dx = second.position.x - first.position.x;
            const dy = second.position.y - first.position.y;
            const contactDistance = first.radius + second.radius;
            if (dx * dx + dy * dy > contactDistance * contactDistance) {
                continue;
            }

            destroyEnemyPair(first, second, model.effects);
            break;
        }
    }
}

function enforceRammingPriority(model: RuntimeModel): void {
    const player = model.player;
    if (!player.alive) {
        return;
    }

    for (const enemy of model.enemies) {
        if (!enemy.active) {
            continue;
        }

        const toPlayerX = player.position.x - enemy.position.x;
        const toPlayerY = player.position.y - enemy.position.y;
        if (toPlayerX * toPlayerX + toPlayerY * toPlayerY < 0.0001) {
            continue;
        }

        const pursuitRotation = Math.atan2(toPlayerY, toPlayerX);
        const maximumDeviation = enemy.threat > 0.05
            ? DODGE_PURSUIT_HALF_ANGLE
            : NORMAL_PURSUIT_HALF_ANGLE;
        const deviation = wrapAngle(enemy.rotation - pursuitRotation);
        const correctedDeviation = Math.max(
            -maximumDeviation,
            Math.min(maximumDeviation, deviation),
        );
        const correctedRotation = wrapAngle(pursuitRotation + correctedDeviation);
        const speed = Math.max(0.0001, Math.hypot(enemy.velocity.x, enemy.velocity.y));

        enemy.rotation = correctedRotation;
        enemy.velocity.x = Math.cos(correctedRotation) * speed;
        enemy.velocity.y = Math.sin(correctedRotation) * speed;
    }
}

const prototype = CursorSpaceModel.prototype as unknown as RuntimeModel;

if (!prototype[PRIORITY_INSTALL_KEY]) {
    const originalUpdateEnemies = prototype.updateEnemies;
    prototype.updateEnemies = function updateEnemiesWithRammingPriority(deltaTime: number): void {
        originalUpdateEnemies.call(this, deltaTime);
        enforceRammingPriority(this);
    };
    prototype[PRIORITY_INSTALL_KEY] = true;
}

if (!prototype[CONTACT_INSTALL_KEY]) {
    const originalStep = prototype.step;
    prototype.step = function stepWithEnemyContacts(deltaTime: number): void {
        originalStep.call(this, deltaTime);
        resolveEnemyContacts(this);
    };
    prototype[CONTACT_INSTALL_KEY] = true;
}
