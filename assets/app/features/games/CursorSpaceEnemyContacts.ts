import { CursorSpaceModel } from './CursorSpaceModel';
import type {
    CursorSpaceEffect,
    CursorSpaceEnemy,
} from './CursorSpaceTypes';

const INSTALL_KEY: unique symbol = Symbol('cursor-space-enemy-contacts');
const CONTACT_EPSILON = 0.001;
const IMPACT_SPEED_THRESHOLD = 8;
const POSITION_ITERATIONS = 2;

interface InstallableModel extends CursorSpaceModel {
    [INSTALL_KEY]?: boolean;
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

function resolveEnemyContacts(model: CursorSpaceModel): void {
    const enemies = model.enemies;

    for (let iteration = 0; iteration < POSITION_ITERATIONS; iteration += 1) {
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

                let dx = second.position.x - first.position.x;
                let dy = second.position.y - first.position.y;
                const minimumDistance = first.radius + second.radius;
                const distanceSquared = dx * dx + dy * dy;
                if (distanceSquared >= minimumDistance * minimumDistance) {
                    continue;
                }

                let distance = Math.sqrt(distanceSquared);
                if (distance < CONTACT_EPSILON) {
                    const angle = (firstIndex * 2.399963 + secondIndex * 1.618034) % (Math.PI * 2);
                    dx = Math.cos(angle);
                    dy = Math.sin(angle);
                    distance = 1;
                }

                const normalX = dx / distance;
                const normalY = dy / distance;
                const closingSpeed = (first.velocity.x - second.velocity.x) * normalX
                    + (first.velocity.y - second.velocity.y) * normalY;

                if (closingSpeed >= IMPACT_SPEED_THRESHOLD) {
                    destroyEnemyPair(first, second, model.effects);
                    break;
                }

                const correction = (minimumDistance - distance + CONTACT_EPSILON) * 0.5;
                first.position.x -= normalX * correction;
                first.position.y -= normalY * correction;
                second.position.x += normalX * correction;
                second.position.y += normalY * correction;
            }
        }
    }
}

const prototype = CursorSpaceModel.prototype as InstallableModel;
if (!prototype[INSTALL_KEY]) {
    const originalStep = prototype.step;
    prototype.step = function stepWithEnemyContacts(deltaTime: number): void {
        originalStep.call(this, deltaTime);
        resolveEnemyContacts(this);
    };
    prototype[INSTALL_KEY] = true;
}
