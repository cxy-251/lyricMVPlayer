import type {
    CursorSpaceModel,
    CursorSpaceWall,
} from '../../CursorSpaceModel';
import type {
    CursorSpaceBounds,
    CursorSpaceEnemy,
    CursorSpaceProjectile,
} from '../../CursorSpaceTypes';

const CANDIDATE_COUNT = 48;
const LOOK_AHEAD_DISTANCE = 212;
const PLAYER_MAXIMUM_SPEED = 540;
const PLAYER_RADIUS = 10;
const ENEMY_HORIZON = 1.38;
const PROJECTILE_HORIZON = 1.72;
const ENEMY_SAFETY_PADDING = 104;
const PROJECTILE_SAFETY_PADDING = 96;
const BOUNDARY_MARGIN = 122;
const ENGAGEMENT_RADIUS = 304;
const NORMAL_TURN_RATE = 4.8;
const EMERGENCY_TURN_RATE = 12.4;
const SURVIVAL_TIE_WINDOW = 8;
const MINIMUM_LENGTH = 0.0001;

const WALL_ROUTE_CLEARANCE = 30;
const WALL_PATH_CLEARANCE = PLAYER_RADIUS + 2;
const WALL_SAFETY_MARGIN = 96;
const WALL_BLOCKED_PENALTY = 80_000;
const WALL_NEAR_PENALTY = 12_800;

const SURVIVAL_HOLD_DURATION = 1.65;
const RESPAWN_SURVIVAL_DURATION = 2.8;
const SAFE_RELEASE_DELAY = 0.95;
const ENEMY_FIRE_LANE_RANGE = 640;
const ENEMY_FIRE_LANE_PADDING = 92;
const PROJECTILE_RELEVANCE_PADDING = 4;

interface Direction {
    readonly x: number;
    readonly y: number;
}

interface EmergencyDirection extends Direction {
    readonly strength: number;
}

interface CandidateEvaluation {
    readonly heading: number;
    readonly survival: number;
    readonly tactical: number;
}

interface TargetPoint {
    readonly x: number;
    readonly y: number;
}

export class CursorSpaceAutopilot {
    private elapsed = 0;
    private heading = 0;
    private orbitSide: -1 | 1 = 1;
    private initialized = false;
    private wasAlive = false;
    private survivalRemaining = 0;
    private safeElapsed = 0;

    reset(): void {
        this.elapsed = 0;
        this.heading = 0;
        this.orbitSide = 1;
        this.initialized = false;
        this.wasAlive = false;
        this.survivalRemaining = RESPAWN_SURVIVAL_DURATION;
        this.safeElapsed = 0;
    }

    update(model: CursorSpaceModel, deltaTime: number): void {
        const dt = Math.max(0, Math.min(0.05, deltaTime));
        const player = model.player;
        if (dt === 0) {
            return;
        }
        if (!player.alive) {
            model.clearTarget();
            this.initialized = false;
            this.wasAlive = false;
            this.survivalRemaining = RESPAWN_SURVIVAL_DURATION;
            this.safeElapsed = 0;
            return;
        }

        const respawned = !this.wasAlive;
        this.wasAlive = true;
        this.elapsed += dt;
        if (!this.initialized) {
            const speed = Math.hypot(player.velocity.x, player.velocity.y);
            this.heading = speed > 8
                ? Math.atan2(player.velocity.y, player.velocity.x)
                : this.initialHeading(model.currentBounds, player.position.x, player.position.y);
            this.initialized = true;
        }
        if (respawned) {
            this.survivalRemaining = Math.max(
                this.survivalRemaining,
                RESPAWN_SURVIVAL_DURATION,
            );
            this.safeElapsed = 0;
        }

        if (Math.floor((this.elapsed - dt) / 9.5) !== Math.floor(this.elapsed / 9.5)) {
            this.orbitSide = this.orbitSide === 1 ? -1 : 1;
        }

        const projectileDanger = this.immediateProjectileDanger(model);
        const enemyDanger = this.immediateEnemyDanger(model);
        const wallDanger = this.wallDanger(model);
        const boundaryDanger = this.boundaryDanger(model);
        const danger = Math.max(
            projectileDanger,
            enemyDanger,
            wallDanger * 0.78,
            boundaryDanger * 0.72,
        );

        if (
            projectileDanger > 0.08
            || enemyDanger > 0.34
            || wallDanger > 0.72
            || boundaryDanger > 0.78
        ) {
            this.survivalRemaining = Math.max(
                this.survivalRemaining,
                SURVIVAL_HOLD_DURATION + danger * 0.9,
            );
            this.safeElapsed = 0;
        } else {
            this.safeElapsed += dt;
            if (this.safeElapsed >= SAFE_RELEASE_DELAY) {
                this.survivalRemaining = Math.max(0, this.survivalRemaining - dt);
            }
        }

        const survivalMode = this.survivalRemaining > 0;
        const emergency = this.emergencyDodgeDirection(model);
        const activeEnemies = this.activeEnemyCount(model);
        let throttle = survivalMode
            ? 0.76 + danger * 0.24
            : 0.34 + Math.min(0.14, activeEnemies * 0.008) + danger * 0.58;
        if (boundaryDanger > 0.45) {
            throttle *= 1 - boundaryDanger * 0.25;
        }
        if (wallDanger > 0.55) {
            throttle = Math.max(throttle, 0.68 + wallDanger * 0.18);
        }
        throttle = this.clamp(throttle, survivalMode ? 0.62 : 0.3, 1);

        const engagement = this.preferredEngagementDirection(model);
        const survival = this.preferredSurvivalDirection(model);
        const survivalBlend = survivalMode
            ? this.clamp(0.76 + danger * 0.24, 0.76, 1)
            : this.clamp(danger * 0.7, 0, 0.58);
        const preferred = this.normalized(
            engagement.x * (1 - survivalBlend) + survival.x * survivalBlend,
            engagement.y * (1 - survivalBlend) + survival.y * survivalBlend,
        );

        let best: CandidateEvaluation | null = null;
        for (let index = 0; index < CANDIDATE_COUNT; index += 1) {
            const angle = Math.PI * 2 * index / CANDIDATE_COUNT;
            const directionX = Math.cos(angle);
            const directionY = Math.sin(angle);
            const candidate = this.evaluateDirection(
                model,
                angle,
                directionX,
                directionY,
                preferred,
                emergency,
                throttle,
                survivalMode,
            );
            if (!best || this.isBetterCandidate(candidate, best, survivalMode)) {
                best = candidate;
            }
        }

        const bestHeading = best?.heading ?? this.heading;
        const maneuverDanger = Math.max(danger, emergency.strength, survivalMode ? 0.48 : 0);
        const turnRate = NORMAL_TURN_RATE
            + (EMERGENCY_TURN_RATE - NORMAL_TURN_RATE) * maneuverDanger;
        const difference = this.wrapAngle(bestHeading - this.heading);
        const maximumTurn = turnRate * dt;
        this.heading = this.wrapAngle(
            this.heading + this.clamp(difference, -maximumTurn, maximumTurn),
        );

        const bounds = model.currentBounds;
        const insetX = Math.min(18, Math.max(0.5, (bounds.right - bounds.left) * 0.5 - 0.5));
        const insetY = Math.min(18, Math.max(0.5, (bounds.top - bounds.bottom) * 0.5 - 0.5));
        const desiredTarget = {
            x: this.clamp(
                player.position.x + Math.cos(this.heading) * LOOK_AHEAD_DISTANCE,
                bounds.left + insetX,
                bounds.right - insetX,
            ),
            y: this.clamp(
                player.position.y + Math.sin(this.heading) * LOOK_AHEAD_DISTANCE,
                bounds.bottom + insetY,
                bounds.top - insetY,
            ),
        };
        const target = this.resolveWallAwareTarget(
            model,
            desiredTarget,
            emergency,
            throttle,
            survivalMode,
        );
        model.setTarget(target.x, target.y, throttle);
    }

    private evaluateDirection(
        model: CursorSpaceModel,
        heading: number,
        directionX: number,
        directionY: number,
        preferred: Readonly<Direction>,
        emergency: Readonly<EmergencyDirection>,
        throttle: number,
        survivalMode: boolean,
    ): CandidateEvaluation {
        const player = model.player;
        const predictedSpeed = PLAYER_MAXIMUM_SPEED * throttle;
        const candidateVelocityX = directionX * predictedSpeed;
        const candidateVelocityY = directionY * predictedSpeed;
        const candidateX = player.position.x + directionX * LOOK_AHEAD_DISTANCE;
        const candidateY = player.position.y + directionY * LOOK_AHEAD_DISTANCE;
        let survival = this.boundarySurvival(
            model.currentBounds,
            candidateX,
            candidateY,
        );
        survival += this.wallPathSurvival(
            model,
            player.position.x,
            player.position.y,
            candidateX,
            candidateY,
        );

        for (const enemy of model.enemies) {
            if (!enemy.active) {
                continue;
            }
            survival += this.enemySurvivalScore(
                player.position.x,
                player.position.y,
                candidateVelocityX,
                candidateVelocityY,
                enemy,
            );
            survival += this.enemyFireLaneSurvivalScore(
                model,
                player.position.x,
                player.position.y,
                candidateVelocityX,
                candidateVelocityY,
                enemy,
            );
        }

        for (const projectile of model.projectiles) {
            if (
                !projectile.active
                || projectile.owner !== 'enemy'
                || !this.projectileRelevantToPlayer(model, projectile)
            ) {
                continue;
            }
            survival += this.projectileSurvivalScore(
                player.position.x,
                player.position.y,
                candidateVelocityX,
                candidateVelocityY,
                projectile,
            );
        }

        survival += (
            directionX * emergency.x + directionY * emergency.y
        ) * emergency.strength * 4_600;
        survival += (
            directionX * preferred.x + directionY * preferred.y
        ) * (survivalMode ? 780 : 110);

        const tacticalScale = survivalMode ? 0.18 : 1;
        let tactical = (
            directionX * preferred.x + directionY * preferred.y
        ) * 30 * tacticalScale;
        const playerSpeed = Math.hypot(player.velocity.x, player.velocity.y);
        if (playerSpeed > 12) {
            tactical += (
                directionX * player.velocity.x / playerSpeed
                + directionY * player.velocity.y / playerSpeed
            ) * (survivalMode ? 3 : 12);
        }
        tactical += Math.cos(this.wrapAngle(heading - this.heading)) * (survivalMode ? 2 : 9);
        tactical += Math.sin(this.elapsed * 0.61 + directionX * 2.1 + directionY * 2.7)
            * (survivalMode ? 0.15 : 1.2);

        return { heading, survival, tactical };
    }

    private resolveWallAwareTarget(
        model: CursorSpaceModel,
        desiredTarget: Readonly<TargetPoint>,
        emergency: Readonly<EmergencyDirection>,
        throttle: number,
        survivalMode: boolean,
    ): TargetPoint {
        if (
            !model.wallActive
            || this.segmentClearOfWalls(
                model.player.position.x,
                model.player.position.y,
                desiredTarget.x,
                desiredTarget.y,
                model.walls,
                WALL_ROUTE_CLEARANCE,
            )
        ) {
            return { x: desiredTarget.x, y: desiredTarget.y };
        }

        const player = model.player;
        const bounds = model.currentBounds;
        let bestTarget: TargetPoint | null = null;
        let bestEvaluation: CandidateEvaluation | null = null;

        for (const wall of model.walls) {
            const left = wall.x - WALL_ROUTE_CLEARANCE;
            const right = wall.x + wall.width + WALL_ROUTE_CLEARANCE;
            const bottom = wall.y - WALL_ROUTE_CLEARANCE;
            const top = wall.y + wall.height + WALL_ROUTE_CLEARANCE;
            const candidates: readonly TargetPoint[] = [
                { x: left, y: bottom },
                { x: left, y: top },
                { x: right, y: bottom },
                { x: right, y: top },
            ];

            for (const candidate of candidates) {
                if (!this.segmentTraversableFromCurrent(
                    player.position.x,
                    player.position.y,
                    candidate.x,
                    candidate.y,
                    model.walls,
                    PLAYER_RADIUS,
                )) {
                    continue;
                }

                const dx = candidate.x - player.position.x;
                const dy = candidate.y - player.position.y;
                const distance = Math.hypot(dx, dy);
                if (distance < MINIMUM_LENGTH) {
                    continue;
                }
                const directionX = dx / distance;
                const directionY = dy / distance;
                const evaluation = this.evaluateDirection(
                    model,
                    Math.atan2(dy, dx),
                    directionX,
                    directionY,
                    directionX === 0 && directionY === 0
                        ? { x: Math.cos(this.heading), y: Math.sin(this.heading) }
                        : { x: directionX, y: directionY },
                    emergency,
                    throttle,
                    survivalMode,
                );
                const desiredDistance = Math.hypot(
                    desiredTarget.x - candidate.x,
                    desiredTarget.y - candidate.y,
                );
                const adjusted = {
                    heading: evaluation.heading,
                    survival: evaluation.survival
                        + this.wallWaypointSurvival(candidate.x, candidate.y, model.walls),
                    tactical: evaluation.tactical - desiredDistance * (survivalMode ? 0.02 : 0.14),
                };
                if (!bestEvaluation || this.isBetterCandidate(
                    adjusted,
                    bestEvaluation,
                    survivalMode,
                )) {
                    bestEvaluation = adjusted;
                    bestTarget = candidate;
                }
            }
        }

        if (!bestTarget) {
            return this.nearestOpenEscapeTarget(model);
        }
        return {
            x: this.clamp(
                bestTarget.x,
                bounds.left + PLAYER_RADIUS,
                bounds.right - PLAYER_RADIUS,
            ),
            y: this.clamp(
                bestTarget.y,
                bounds.bottom + PLAYER_RADIUS,
                bounds.top - PLAYER_RADIUS,
            ),
        };
    }

    private nearestOpenEscapeTarget(model: CursorSpaceModel): TargetPoint {
        const player = model.player;
        let escapeX = 0;
        let escapeY = 0;
        let pressure = 0;
        for (const wall of model.walls) {
            const geometry = this.wallEscapeGeometry(
                player.position.x,
                player.position.y,
                wall,
                WALL_ROUTE_CLEARANCE,
            );
            if (geometry.distance >= WALL_SAFETY_MARGIN) {
                continue;
            }
            const weight = 1 - geometry.distance / WALL_SAFETY_MARGIN;
            escapeX += geometry.x * weight;
            escapeY += geometry.y * weight;
            pressure += weight;
        }
        if (pressure <= 0) {
            const centerX = (model.currentBounds.left + model.currentBounds.right) * 0.5;
            const centerY = (model.currentBounds.bottom + model.currentBounds.top) * 0.5;
            escapeX = centerX - player.position.x;
            escapeY = centerY - player.position.y;
        }
        const direction = this.normalized(escapeX, escapeY);
        return {
            x: this.clamp(
                player.position.x + direction.x * LOOK_AHEAD_DISTANCE * 0.72,
                model.currentBounds.left + PLAYER_RADIUS,
                model.currentBounds.right - PLAYER_RADIUS,
            ),
            y: this.clamp(
                player.position.y + direction.y * LOOK_AHEAD_DISTANCE * 0.72,
                model.currentBounds.bottom + PLAYER_RADIUS,
                model.currentBounds.top - PLAYER_RADIUS,
            ),
        };
    }

    private preferredSurvivalDirection(model: CursorSpaceModel): Direction {
        const player = model.player;
        const centerX = (model.currentBounds.left + model.currentBounds.right) * 0.5;
        const centerY = (model.currentBounds.bottom + model.currentBounds.top) * 0.5;
        let x = (centerX - player.position.x) * 0.0025;
        let y = (centerY - player.position.y) * 0.0025;

        for (const enemy of model.enemies) {
            if (!enemy.active) {
                continue;
            }
            const dx = player.position.x - enemy.position.x;
            const dy = player.position.y - enemy.position.y;
            const distance = Math.max(1, Math.hypot(dx, dy));
            const weight = this.clamp((420 - distance) / 420, 0, 1);
            x += dx / distance * weight * weight * 2.2;
            y += dy / distance * weight * weight * 2.2;
        }

        for (const projectile of model.projectiles) {
            if (
                !projectile.active
                || projectile.owner !== 'enemy'
                || !this.projectileRelevantToPlayer(model, projectile)
            ) {
                continue;
            }
            const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
            if (speed < MINIMUM_LENGTH) {
                continue;
            }
            const directionX = projectile.velocity.x / speed;
            const directionY = projectile.velocity.y / speed;
            const relativeX = player.position.x - projectile.position.x;
            const relativeY = player.position.y - projectile.position.y;
            const side = relativeX * (-directionY) + relativeY * directionX >= 0 ? 1 : -1;
            const distance = Math.max(1, Math.hypot(relativeX, relativeY));
            const weight = this.clamp((360 - distance) / 360, 0, 1);
            x += -directionY * side * weight * 3.4;
            y += directionX * side * weight * 3.4;
        }

        if (model.wallActive) {
            for (const wall of model.walls) {
                const geometry = this.wallEscapeGeometry(
                    player.position.x,
                    player.position.y,
                    wall,
                    WALL_PATH_CLEARANCE,
                );
                if (geometry.distance >= WALL_SAFETY_MARGIN) {
                    continue;
                }
                const weight = 1 - geometry.distance / WALL_SAFETY_MARGIN;
                x += geometry.x * weight * 2.8;
                y += geometry.y * weight * 2.8;
            }
        }
        return this.normalized(x, y);
    }

    private emergencyDodgeDirection(model: CursorSpaceModel): EmergencyDirection {
        const player = model.player;
        let bestStrength = 0;
        let bestX = Math.cos(this.heading);
        let bestY = Math.sin(this.heading);

        for (const projectile of model.projectiles) {
            if (
                !projectile.active
                || projectile.owner !== 'enemy'
                || !this.projectileRelevantToPlayer(model, projectile)
            ) {
                continue;
            }
            const closest = this.closestApproach(
                projectile.position.x - player.position.x,
                projectile.position.y - player.position.y,
                projectile.velocity.x - player.velocity.x,
                projectile.velocity.y - player.velocity.y,
                PROJECTILE_HORIZON,
            );
            const dangerRadius = PLAYER_RADIUS + projectile.radius + PROJECTILE_SAFETY_PADDING;
            const strength = this.clamp(
                (1 - closest.distance / dangerRadius)
                    * (1 - closest.time / PROJECTILE_HORIZON * 0.35),
                0,
                1,
            );
            if (strength <= bestStrength) {
                continue;
            }
            const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
            if (speed < MINIMUM_LENGTH) {
                continue;
            }
            const directionX = projectile.velocity.x / speed;
            const directionY = projectile.velocity.y / speed;
            const relativeX = player.position.x - projectile.position.x;
            const relativeY = player.position.y - projectile.position.y;
            const side = relativeX * (-directionY) + relativeY * directionX >= 0 ? 1 : -1;
            bestStrength = strength;
            bestX = -directionY * side;
            bestY = directionX * side;
        }
        const direction = this.normalized(bestX, bestY);
        return { x: direction.x, y: direction.y, strength: bestStrength };
    }

    private wallPathSurvival(
        model: CursorSpaceModel,
        startX: number,
        startY: number,
        endX: number,
        endY: number,
    ): number {
        if (!model.wallActive) {
            return 0;
        }
        if (!this.segmentTraversableFromCurrent(
            startX,
            startY,
            endX,
            endY,
            model.walls,
            WALL_PATH_CLEARANCE,
        )) {
            return -WALL_BLOCKED_PENALTY;
        }

        let minimumClearance = Number.POSITIVE_INFINITY;
        for (let sample = 1; sample <= 5; sample += 1) {
            const progress = sample / 5;
            const x = startX + (endX - startX) * progress;
            const y = startY + (endY - startY) * progress;
            minimumClearance = Math.min(
                minimumClearance,
                this.wallClearanceAt(x, y, model.walls, WALL_PATH_CLEARANCE),
            );
        }
        if (!Number.isFinite(minimumClearance)) {
            return 0;
        }
        if (minimumClearance < WALL_SAFETY_MARGIN) {
            const pressure = 1 - minimumClearance / WALL_SAFETY_MARGIN;
            return -WALL_NEAR_PENALTY * pressure * pressure * pressure;
        }
        return Math.min(36, minimumClearance * 0.09);
    }

    private wallWaypointSurvival(
        x: number,
        y: number,
        walls: readonly CursorSpaceWall[],
    ): number {
        const clearance = this.wallClearanceAt(x, y, walls, PLAYER_RADIUS);
        if (!Number.isFinite(clearance)) {
            return 0;
        }
        if (clearance < WALL_SAFETY_MARGIN) {
            const pressure = 1 - clearance / WALL_SAFETY_MARGIN;
            return -WALL_NEAR_PENALTY * 0.52 * pressure * pressure;
        }
        return Math.min(22, clearance * 0.06);
    }

    private wallDanger(model: CursorSpaceModel): number {
        if (!model.wallActive) {
            return 0;
        }
        const clearance = this.wallClearanceAt(
            model.player.position.x,
            model.player.position.y,
            model.walls,
            PLAYER_RADIUS,
        );
        if (!Number.isFinite(clearance)) {
            return 0;
        }
        return this.clamp(1 - clearance / WALL_SAFETY_MARGIN, 0, 1);
    }

    private wallClearanceAt(
        x: number,
        y: number,
        walls: readonly CursorSpaceWall[],
        padding: number,
    ): number {
        let clearance = Number.POSITIVE_INFINITY;
        for (const wall of walls) {
            const geometry = this.wallEscapeGeometry(x, y, wall, padding);
            clearance = Math.min(clearance, geometry.distance);
        }
        return clearance;
    }

    private wallEscapeGeometry(
        x: number,
        y: number,
        wall: Readonly<CursorSpaceWall>,
        padding: number,
    ): { distance: number; x: number; y: number } {
        const left = wall.x - padding;
        const right = wall.x + wall.width + padding;
        const bottom = wall.y - padding;
        const top = wall.y + wall.height + padding;
        const nearestX = this.clamp(x, left, right);
        const nearestY = this.clamp(y, bottom, top);
        const dx = x - nearestX;
        const dy = y - nearestY;
        const distance = Math.hypot(dx, dy);
        if (distance > MINIMUM_LENGTH) {
            return { distance, x: dx / distance, y: dy / distance };
        }
        const exits = [
            { distance: Math.abs(x - left), x: -1, y: 0 },
            { distance: Math.abs(right - x), x: 1, y: 0 },
            { distance: Math.abs(y - bottom), x: 0, y: -1 },
            { distance: Math.abs(top - y), x: 0, y: 1 },
        ];
        exits.sort((first, second) => first.distance - second.distance);
        return { distance: 0, x: exits[0].x, y: exits[0].y };
    }

    private segmentTraversableFromCurrent(
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        walls: readonly CursorSpaceWall[],
        padding: number,
    ): boolean {
        for (const wall of walls) {
            if (!this.segmentIntersectsWall(
                startX,
                startY,
                endX,
                endY,
                wall,
                padding,
            )) {
                continue;
            }
            if (!this.pointInsideExpandedWall(startX, startY, wall, padding)) {
                return false;
            }
            if (this.pointInsideExpandedWall(endX, endY, wall, padding)) {
                return false;
            }
            const escape = this.nearestWallEscapeNormal(startX, startY, wall, padding);
            const movementX = endX - startX;
            const movementY = endY - startY;
            if (movementX * escape.x + movementY * escape.y <= 0) {
                return false;
            }
        }
        return true;
    }

    private pointInsideExpandedWall(
        x: number,
        y: number,
        wall: Readonly<CursorSpaceWall>,
        padding: number,
    ): boolean {
        return x >= wall.x - padding
            && x <= wall.x + wall.width + padding
            && y >= wall.y - padding
            && y <= wall.y + wall.height + padding;
    }

    private nearestWallEscapeNormal(
        x: number,
        y: number,
        wall: Readonly<CursorSpaceWall>,
        padding: number,
    ): Direction {
        const geometry = this.wallEscapeGeometry(x, y, wall, padding);
        return { x: geometry.x, y: geometry.y };
    }

    private segmentClearOfWalls(
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        walls: readonly CursorSpaceWall[],
        padding: number,
    ): boolean {
        for (const wall of walls) {
            if (this.segmentIntersectsWall(
                startX,
                startY,
                endX,
                endY,
                wall,
                padding,
            )) {
                return false;
            }
        }
        return true;
    }

    private segmentIntersectsWall(
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        wall: Readonly<CursorSpaceWall>,
        padding: number,
    ): boolean {
        const left = wall.x - padding;
        const right = wall.x + wall.width + padding;
        const bottom = wall.y - padding;
        const top = wall.y + wall.height + padding;
        let minimumTime = 0;
        let maximumTime = 1;
        const deltaX = endX - startX;
        const deltaY = endY - startY;

        const clip = (
            start: number,
            delta: number,
            minimum: number,
            maximum: number,
        ): boolean => {
            if (Math.abs(delta) < MINIMUM_LENGTH) {
                return start >= minimum && start <= maximum;
            }
            const first = (minimum - start) / delta;
            const second = (maximum - start) / delta;
            minimumTime = Math.max(minimumTime, Math.min(first, second));
            maximumTime = Math.min(maximumTime, Math.max(first, second));
            return minimumTime <= maximumTime;
        };

        return clip(startX, deltaX, left, right)
            && clip(startY, deltaY, bottom, top)
            && maximumTime >= 0
            && minimumTime <= 1;
    }

    private enemySurvivalScore(
        playerX: number,
        playerY: number,
        candidateVelocityX: number,
        candidateVelocityY: number,
        enemy: Readonly<CursorSpaceEnemy>,
    ): number {
        const relativeX = enemy.position.x - playerX;
        const relativeY = enemy.position.y - playerY;
        const relativeVelocityX = enemy.velocity.x - candidateVelocityX;
        const relativeVelocityY = enemy.velocity.y - candidateVelocityY;
        const closest = this.closestApproach(
            relativeX,
            relativeY,
            relativeVelocityX,
            relativeVelocityY,
            ENEMY_HORIZON,
        );
        const collisionRadius = PLAYER_RADIUS + enemy.radius;
        const safetyRadius = collisionRadius + ENEMY_SAFETY_PADDING;
        if (closest.distance <= collisionRadius) {
            const penetration = 1 - closest.distance / Math.max(1, collisionRadius);
            return -24_000 - penetration * 12_000;
        }
        if (closest.distance >= safetyRadius) {
            return 0;
        }
        const pressure = 1 - (closest.distance - collisionRadius)
            / (safetyRadius - collisionRadius);
        const urgency = 1 - closest.time / ENEMY_HORIZON;
        return -(
            pressure * pressure * 6_200
            + pressure * urgency * 2_900
        );
    }

    private enemyFireLaneSurvivalScore(
        model: CursorSpaceModel,
        playerX: number,
        playerY: number,
        candidateVelocityX: number,
        candidateVelocityY: number,
        enemy: Readonly<CursorSpaceEnemy>,
    ): number {
        if (!enemy.shootingEnabled || enemy.fireTier === 0) {
            return 0;
        }
        const horizon = 0.62;
        const candidateX = playerX + candidateVelocityX * horizon;
        const candidateY = playerY + candidateVelocityY * horizon;
        if (model.wallActive && !this.segmentClearOfWalls(
            enemy.position.x,
            enemy.position.y,
            candidateX,
            candidateY,
            model.walls,
            PLAYER_RADIUS + PROJECTILE_RELEVANCE_PADDING,
        )) {
            return 0;
        }
        const directionX = Math.cos(enemy.rotation);
        const directionY = Math.sin(enemy.rotation);
        const relativeX = candidateX - enemy.position.x;
        const relativeY = candidateY - enemy.position.y;
        const projection = relativeX * directionX + relativeY * directionY;
        if (projection <= 0 || projection >= ENEMY_FIRE_LANE_RANGE) {
            return 0;
        }
        const perpendicular = Math.abs(relativeX * directionY - relativeY * directionX);
        if (perpendicular >= ENEMY_FIRE_LANE_PADDING) {
            return 0;
        }
        const lanePressure = 1 - perpendicular / ENEMY_FIRE_LANE_PADDING;
        const rangePressure = 1 - projection / ENEMY_FIRE_LANE_RANGE;
        const readiness = enemy.fireRemaining <= 0.16 ? 1 : 0.38;
        const tierPressure = 0.7 + enemy.fireTier * 0.18;
        return -lanePressure * lanePressure * rangePressure * readiness * tierPressure * 5_800;
    }

    private projectileSurvivalScore(
        playerX: number,
        playerY: number,
        candidateVelocityX: number,
        candidateVelocityY: number,
        projectile: Readonly<CursorSpaceProjectile>,
    ): number {
        const relativeX = projectile.position.x - playerX;
        const relativeY = projectile.position.y - playerY;
        const relativeVelocityX = projectile.velocity.x - candidateVelocityX;
        const relativeVelocityY = projectile.velocity.y - candidateVelocityY;
        const closest = this.closestApproach(
            relativeX,
            relativeY,
            relativeVelocityX,
            relativeVelocityY,
            PROJECTILE_HORIZON,
        );
        const collisionRadius = PLAYER_RADIUS + projectile.radius;
        const safetyRadius = collisionRadius + PROJECTILE_SAFETY_PADDING;
        if (closest.distance <= collisionRadius) {
            const penetration = 1 - closest.distance / Math.max(1, collisionRadius);
            return -42_000 - penetration * 18_000;
        }
        if (closest.distance >= safetyRadius) {
            return 0;
        }
        const pressure = 1 - (closest.distance - collisionRadius)
            / (safetyRadius - collisionRadius);
        const urgency = 1 - closest.time / PROJECTILE_HORIZON;
        return -(
            pressure * pressure * 13_600
            + pressure * urgency * 7_200
        );
    }

    private projectileRelevantToPlayer(
        model: CursorSpaceModel,
        projectile: Readonly<CursorSpaceProjectile>,
    ): boolean {
        const player = model.player;
        const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
        if (speed < MINIMUM_LENGTH) {
            return false;
        }
        const toPlayerX = player.position.x - projectile.position.x;
        const toPlayerY = player.position.y - projectile.position.y;
        const projection = (
            toPlayerX * projectile.velocity.x + toPlayerY * projectile.velocity.y
        ) / speed;
        if (projection < -PLAYER_RADIUS * 2) {
            return false;
        }
        const remainingDistance = speed * Math.max(
            0,
            Math.min(projectile.life, PROJECTILE_HORIZON),
        );
        if (projection > remainingDistance + PROJECTILE_SAFETY_PADDING) {
            return false;
        }
        if (model.wallActive && !this.segmentClearOfWalls(
            projectile.position.x,
            projectile.position.y,
            player.position.x,
            player.position.y,
            model.walls,
            projectile.radius + PROJECTILE_RELEVANCE_PADDING,
        )) {
            return false;
        }
        return true;
    }

    private immediateProjectileDanger(model: CursorSpaceModel): number {
        const player = model.player;
        let danger = 0;
        for (const projectile of model.projectiles) {
            if (
                !projectile.active
                || projectile.owner !== 'enemy'
                || !this.projectileRelevantToPlayer(model, projectile)
            ) {
                continue;
            }
            const closest = this.closestApproach(
                projectile.position.x - player.position.x,
                projectile.position.y - player.position.y,
                projectile.velocity.x - player.velocity.x,
                projectile.velocity.y - player.velocity.y,
                PROJECTILE_HORIZON,
            );
            danger = Math.max(
                danger,
                this.clamp(
                    (1 - closest.distance / 126)
                        * (1 - closest.time / PROJECTILE_HORIZON * 0.38),
                    0,
                    1,
                ),
            );
        }
        return danger;
    }

    private immediateEnemyDanger(model: CursorSpaceModel): number {
        const player = model.player;
        let danger = 0;
        for (const enemy of model.enemies) {
            if (!enemy.active) {
                continue;
            }
            const distance = Math.hypot(
                enemy.position.x - player.position.x,
                enemy.position.y - player.position.y,
            );
            danger = Math.max(danger, this.clamp(1 - distance / 190, 0, 1));
            const laneScore = -this.enemyFireLaneSurvivalScore(
                model,
                player.position.x,
                player.position.y,
                player.velocity.x,
                player.velocity.y,
                enemy,
            );
            danger = Math.max(danger, this.clamp(laneScore / 5_800, 0, 1));
        }
        return danger;
    }

    private boundaryDanger(model: CursorSpaceModel): number {
        const player = model.player;
        const left = player.position.x - model.currentBounds.left;
        const right = model.currentBounds.right - player.position.x;
        const bottom = player.position.y - model.currentBounds.bottom;
        const top = model.currentBounds.top - player.position.y;
        const clearance = Math.min(left, right, bottom, top);
        return this.clamp(1 - clearance / 110, 0, 1);
    }

    private boundarySurvival(
        bounds: Readonly<CursorSpaceBounds>,
        x: number,
        y: number,
    ): number {
        const left = x - bounds.left;
        const right = bounds.right - x;
        const bottom = y - bounds.bottom;
        const top = bounds.top - y;
        const clearance = Math.min(left, right, bottom, top);
        if (clearance <= 0) {
            return -36_000 - Math.abs(clearance) * 180;
        }
        if (clearance < BOUNDARY_MARGIN) {
            const pressure = 1 - clearance / BOUNDARY_MARGIN;
            return -8_200 * pressure * pressure * pressure;
        }
        return Math.min(42, clearance * 0.09);
    }

    private preferredEngagementDirection(model: CursorSpaceModel): Direction {
        const player = model.player;
        let nearest: CursorSpaceEnemy | null = null;
        let nearestDistanceSquared = Number.POSITIVE_INFINITY;
        for (const enemy of model.enemies) {
            if (!enemy.active) {
                continue;
            }
            const dx = player.position.x - enemy.position.x;
            const dy = player.position.y - enemy.position.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared < nearestDistanceSquared) {
                nearest = enemy;
                nearestDistanceSquared = distanceSquared;
            }
        }
        if (!nearest) {
            const centerX = (model.currentBounds.left + model.currentBounds.right) / 2;
            const centerY = (model.currentBounds.bottom + model.currentBounds.top) / 2;
            return this.normalized(
                centerX - player.position.x + Math.cos(this.elapsed * 0.41) * 54,
                centerY - player.position.y + Math.sin(this.elapsed * 0.34) * 54,
            );
        }
        const distance = Math.sqrt(Math.max(MINIMUM_LENGTH, nearestDistanceSquared));
        const radialX = (player.position.x - nearest.position.x) / distance;
        const radialY = (player.position.y - nearest.position.y) / distance;
        const tangentX = -radialY * this.orbitSide;
        const tangentY = radialX * this.orbitSide;
        const radialWeight = this.clamp(
            (ENGAGEMENT_RADIUS - distance) / ENGAGEMENT_RADIUS,
            -0.35,
            1.55,
        );
        return this.normalized(
            tangentX * 0.72 + radialX * radialWeight,
            tangentY * 0.72 + radialY * radialWeight,
        );
    }

    private activeEnemyCount(model: CursorSpaceModel): number {
        let count = 0;
        for (const enemy of model.enemies) {
            if (enemy.active) {
                count += 1;
            }
        }
        return count;
    }

    private isBetterCandidate(
        candidate: Readonly<CandidateEvaluation>,
        current: Readonly<CandidateEvaluation>,
        survivalMode: boolean,
    ): boolean {
        const survivalDifference = candidate.survival - current.survival;
        const tieWindow = survivalMode ? 1.5 : SURVIVAL_TIE_WINDOW;
        if (Math.abs(survivalDifference) > tieWindow) {
            return survivalDifference > 0;
        }
        return candidate.tactical > current.tactical;
    }

    private closestApproach(
        relativeX: number,
        relativeY: number,
        relativeVelocityX: number,
        relativeVelocityY: number,
        horizon: number,
    ): { distance: number; time: number } {
        const speedSquared = relativeVelocityX * relativeVelocityX
            + relativeVelocityY * relativeVelocityY;
        const time = speedSquared > MINIMUM_LENGTH
            ? this.clamp(
                -(relativeX * relativeVelocityX + relativeY * relativeVelocityY)
                    / speedSquared,
                0,
                horizon,
            )
            : 0;
        const closestX = relativeX + relativeVelocityX * time;
        const closestY = relativeY + relativeVelocityY * time;
        return {
            distance: Math.hypot(closestX, closestY),
            time,
        };
    }

    private initialHeading(bounds: Readonly<CursorSpaceBounds>, x: number, y: number): number {
        const centerX = (bounds.left + bounds.right) / 2;
        const centerY = (bounds.bottom + bounds.top) / 2;
        const angleToCenter = Math.atan2(centerY - y, centerX - x);
        return this.wrapAngle(angleToCenter + Math.PI * 0.5);
    }

    private normalized(x: number, y: number): Direction {
        const length = Math.hypot(x, y);
        if (length < MINIMUM_LENGTH) {
            return { x: Math.cos(this.heading), y: Math.sin(this.heading) };
        }
        return { x: x / length, y: y / length };
    }

    private wrapAngle(value: number): number {
        let angle = value;
        while (angle > Math.PI) {
            angle -= Math.PI * 2;
        }
        while (angle < -Math.PI) {
            angle += Math.PI * 2;
        }
        return angle;
    }

    private clamp(value: number, minimum: number, maximum: number): number {
        return Math.max(minimum, Math.min(maximum, value));
    }
}
