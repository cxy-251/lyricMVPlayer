import {
    Camera,
    Color,
    Material,
    Mesh,
    MeshRenderer,
    Node,
    Rect,
    Vec3,
    utils,
} from 'cc';
import type { ViewportSnapshot } from '../../../../services/ViewportService';
import type { CursorSpaceBounds } from '../CursorSpaceModel';
import type {
    CursorSpaceEffectRenderState,
    CursorSpaceEnemyRenderState,
    CursorSpaceEscortRenderState,
    CursorSpacePlayerRenderState,
    CursorSpaceProjectileOwner,
    CursorSpaceProjectileRenderState,
    CursorSpaceViewState,
} from '../CursorSpaceViewTypes';

export const CURSOR_SPACE_CURSOR_POINTS: ReadonlyArray<readonly [number, number]> = [
    [18, 0],
    [-7, 10],
    [-3, 3],
    [-12, 3],
    [-12, -3],
    [-3, -3],
    [-7, -10],
];

export const CURSOR_SPACE_ENEMY_POINTS: ReadonlyArray<readonly [number, number]> = [
    [12, 0],
    [-8, 7],
    [-5, 0],
    [-8, -7],
];

const CURSOR_INDICES = [
    0, 1, 2,
    0, 2, 5,
    0, 5, 6,
    2, 3, 4,
    2, 4, 5,
];
const ENEMY_INDICES = [
    0, 1, 2,
    0, 2, 3,
];
const QUAD_INDICES = [
    0, 1, 2,
    0, 2, 3,
];
const RING_SEGMENTS = 32;
const RING_INNER_RADIUS = 0.84;
const RADIANS_TO_DEGREES = 180 / Math.PI;
const RENDER_LAYER = 1 << 18;
const CAMERA_DEPTH = 1000;
const CAMERA_PRIORITY = 100;
const ENEMY_DEPTH = 10;
const PROJECTILE_DEPTH = 20;
const EFFECT_DEPTH = 30;
const TRAIL_DEPTH = 40;
const ESCORT_DEPTH = 47;
const PLAYER_OUTLINE_DEPTH = 49;
const PLAYER_DEPTH = 50;
const MAX_ESCORT_INSTANCES = 24;
const MINIMUM_LENGTH = 0.0001;

export interface CursorSpaceInstancedColors {
    readonly enemy: Color;
    readonly playerProjectile: Color;
    readonly enemyProjectile: Color;
    readonly effect: Color;
    readonly player: Color;
    readonly playerOutline: Color;
}

export interface CursorSpaceInstancedRendererOptions {
    readonly parent: Node;
    readonly viewport: ViewportSnapshot;
    readonly bounds: Readonly<CursorSpaceBounds>;
    readonly enemyCapacity: number;
    readonly projectileCapacity: number;
    readonly effectCapacity: number;
    readonly colors: CursorSpaceInstancedColors;
}

interface RenderInstance {
    readonly node: Node;
    readonly renderer: MeshRenderer;
    projectileOwner: CursorSpaceProjectileOwner | null;
}

export class CursorSpaceInstancedRenderer {
    private readonly cameraNode: Node;
    private readonly modelRoot: Node;
    private readonly meshes: Mesh[] = [];
    private readonly materials: Material[] = [];
    private readonly enemyInstances: RenderInstance[];
    private readonly projectileInstances: RenderInstance[];
    private readonly ringInstances: RenderInstance[];
    private readonly fragmentInstances: RenderInstance[];
    private readonly escortInstances: RenderInstance[];
    private readonly trailInstance: RenderInstance;
    private readonly playerOutlineInstance: RenderInstance;
    private readonly playerInstance: RenderInstance;
    private readonly playerProjectileMaterial: Material;
    private readonly enemyProjectileMaterial: Material;
    private disposed = false;

    constructor(options: CursorSpaceInstancedRendererOptions) {
        this.modelRoot = this.createRoot(options.parent, 'CursorSpaceInstancedModels');
        this.cameraNode = this.createRoot(options.parent, 'CursorSpaceInstancedCamera');

        try {
            this.configureCamera(options.viewport, options.bounds);

            const enemyMesh = this.trackMesh(this.createPolygonMesh(
                'CursorSpaceEnemyMesh',
                CURSOR_SPACE_ENEMY_POINTS,
                ENEMY_INDICES,
            ));
            const cursorMesh = this.trackMesh(this.createPolygonMesh(
                'CursorSpaceCursorMesh',
                CURSOR_SPACE_CURSOR_POINTS,
                CURSOR_INDICES,
            ));
            const lineMesh = this.trackMesh(this.createQuadMesh('CursorSpaceLineMesh'));
            const ringMesh = this.trackMesh(this.createRingMesh());

            const enemyMaterial = this.trackMaterial(this.createMaterial(
                'CursorSpaceEnemyMaterial',
                options.colors.enemy,
            ));
            this.playerProjectileMaterial = this.trackMaterial(this.createMaterial(
                'CursorSpacePlayerProjectileMaterial',
                options.colors.playerProjectile,
            ));
            this.enemyProjectileMaterial = this.trackMaterial(this.createMaterial(
                'CursorSpaceEnemyProjectileMaterial',
                options.colors.enemyProjectile,
            ));
            const effectMaterial = this.trackMaterial(this.createMaterial(
                'CursorSpaceEffectMaterial',
                options.colors.effect,
            ));
            const playerMaterial = this.trackMaterial(this.createMaterial(
                'CursorSpacePlayerMaterial',
                options.colors.player,
            ));
            const playerOutlineMaterial = this.trackMaterial(this.createMaterial(
                'CursorSpacePlayerOutlineMaterial',
                options.colors.playerOutline,
            ));

            this.enemyInstances = this.createPool(
                'CursorSpaceEnemyInstance',
                options.enemyCapacity,
                enemyMesh,
                enemyMaterial,
                ENEMY_DEPTH,
            );
            this.projectileInstances = this.createPool(
                'CursorSpaceProjectileInstance',
                options.projectileCapacity,
                lineMesh,
                this.playerProjectileMaterial,
                PROJECTILE_DEPTH,
            );
            this.ringInstances = this.createPool(
                'CursorSpaceRingInstance',
                options.effectCapacity,
                ringMesh,
                effectMaterial,
                EFFECT_DEPTH,
            );
            this.fragmentInstances = this.createPool(
                'CursorSpaceFragmentInstance',
                options.effectCapacity,
                lineMesh,
                effectMaterial,
                EFFECT_DEPTH + 1,
            );
            this.trailInstance = this.createInstance(
                'CursorSpacePlayerTrailInstance',
                lineMesh,
                playerMaterial,
                TRAIL_DEPTH,
            );
            this.escortInstances = this.createPool(
                'CursorSpaceEscortInstance',
                MAX_ESCORT_INSTANCES,
                cursorMesh,
                playerMaterial,
                ESCORT_DEPTH,
            );
            this.playerOutlineInstance = this.createInstance(
                'CursorSpacePlayerOutlineInstance',
                cursorMesh,
                playerOutlineMaterial,
                PLAYER_OUTLINE_DEPTH,
            );
            this.playerInstance = this.createInstance(
                'CursorSpacePlayerInstance',
                cursorMesh,
                playerMaterial,
                PLAYER_DEPTH,
            );
        } catch (error) {
            this.dispose();
            throw error;
        }
    }

    sync(state: CursorSpaceViewState): void {
        if (this.disposed) {
            return;
        }

        this.syncEnemies(state.enemies);
        this.syncProjectiles(state.projectiles);
        this.syncEffects(state.effects);
        this.syncPlayer(state.player, state.escorts);
    }

    dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;

        this.cameraNode.removeFromParent();
        this.modelRoot.removeFromParent();
        this.cameraNode.destroy();
        this.modelRoot.destroy();

        for (const material of this.materials) {
            material.destroy();
        }
        for (const mesh of this.meshes) {
            mesh.destroy();
        }
        this.materials.length = 0;
        this.meshes.length = 0;
    }

    private configureCamera(
        viewport: ViewportSnapshot,
        bounds: Readonly<CursorSpaceBounds>,
    ): void {
        const width = Math.max(1, viewport.width);
        const height = Math.max(1, viewport.height);
        const playWidth = Math.max(1, bounds.right - bounds.left);
        const playHeight = Math.max(1, bounds.top - bounds.bottom);
        const centerX = (bounds.left + bounds.right) / 2;
        const centerY = (bounds.bottom + bounds.top) / 2;
        const viewportX = this.clamp((bounds.left + width / 2) / width, 0, 1);
        const viewportY = this.clamp((bounds.bottom + height / 2) / height, 0, 1);
        const viewportWidth = this.clamp(playWidth / width, 0, 1 - viewportX);
        const viewportHeight = this.clamp(playHeight / height, 0, 1 - viewportY);

        this.cameraNode.setPosition(centerX, centerY, CAMERA_DEPTH);
        const camera = this.cameraNode.addComponent(Camera);
        camera.projection = Camera.ProjectionType.ORTHO;
        camera.orthoHeight = playHeight / 2;
        camera.near = 1;
        camera.far = CAMERA_DEPTH + 100;
        camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
        camera.priority = CAMERA_PRIORITY;
        camera.visibility = RENDER_LAYER;
        camera.rect = new Rect(viewportX, viewportY, viewportWidth, viewportHeight);
    }

    private syncEnemies(enemies: readonly CursorSpaceEnemyRenderState[]): void {
        for (let index = 0; index < this.enemyInstances.length; index += 1) {
            const instance = this.enemyInstances[index];
            const enemy = enemies[index];
            if (!enemy?.active) {
                instance.node.active = false;
                continue;
            }

            const tierScale = 0.92 + (enemy.speedTier - 1) * 0.1;
            const healthScale = enemy.maximumHealth > 0
                ? 0.94 + enemy.health / enemy.maximumHealth * 0.06
                : 0.94;
            this.setTransform(
                instance.node,
                enemy.position.x,
                enemy.position.y,
                ENEMY_DEPTH,
                enemy.rotation,
                tierScale * healthScale,
                tierScale * healthScale,
            );
        }
    }

    private syncProjectiles(
        projectiles: readonly CursorSpaceProjectileRenderState[],
    ): void {
        for (let index = 0; index < this.projectileInstances.length; index += 1) {
            const instance = this.projectileInstances[index];
            const projectile = projectiles[index];
            if (!projectile?.active) {
                instance.node.active = false;
                continue;
            }

            if (instance.projectileOwner !== projectile.owner) {
                instance.renderer.setSharedMaterial(
                    projectile.owner === 'enemy'
                        ? this.enemyProjectileMaterial
                        : this.playerProjectileMaterial,
                    0,
                );
                instance.projectileOwner = projectile.owner;
            }

            const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
            if (!Number.isFinite(speed) || speed < MINIMUM_LENGTH) {
                instance.node.active = false;
                continue;
            }

            const directionX = projectile.velocity.x / speed;
            const directionY = projectile.velocity.y / speed;
            const length = projectile.owner === 'enemy' ? 9 : 7;
            const thickness = projectile.owner === 'enemy' ? 2.6 : 1.8;
            const centerX = projectile.position.x - directionX * length * 0.5;
            const centerY = projectile.position.y - directionY * length * 0.5;
            this.setTransform(
                instance.node,
                centerX,
                centerY,
                PROJECTILE_DEPTH,
                Math.atan2(directionY, directionX),
                length,
                thickness,
            );
        }
    }

    private syncEffects(effects: readonly CursorSpaceEffectRenderState[]): void {
        for (let index = 0; index < this.ringInstances.length; index += 1) {
            const effect = effects[index];
            const ringInstance = this.ringInstances[index];
            const fragmentInstance = this.fragmentInstances[index];
            ringInstance.node.active = false;
            fragmentInstance.node.active = false;

            if (!effect?.active) {
                continue;
            }

            if (effect.kind === 'ring') {
                this.setTransform(
                    ringInstance.node,
                    effect.position.x,
                    effect.position.y,
                    EFFECT_DEPTH,
                    0,
                    effect.radius,
                    effect.radius,
                );
                continue;
            }

            const speed = Math.hypot(effect.velocity.x, effect.velocity.y);
            const rotation = speed >= MINIMUM_LENGTH
                ? Math.atan2(effect.velocity.y, effect.velocity.x)
                : 0;
            this.setTransform(
                fragmentInstance.node,
                effect.position.x,
                effect.position.y,
                EFFECT_DEPTH,
                rotation,
                Math.max(0.5, effect.radius * 2),
                1.5,
            );
        }
    }

    private syncPlayer(
        player: CursorSpacePlayerRenderState,
        escorts: readonly CursorSpaceEscortRenderState[],
    ): void {
        const blinkHidden = player.invulnerableRemaining > 0
            && Math.floor(player.invulnerableRemaining * 12) % 2 === 0;
        const playerVisible = player.alive && !blinkHidden;

        for (let index = 0; index < this.escortInstances.length; index += 1) {
            const instance = this.escortInstances[index];
            const escort = escorts[index];
            if (!playerVisible || !escort?.active) {
                instance.node.active = false;
                continue;
            }
            this.setTransform(
                instance.node,
                escort.x,
                escort.y,
                ESCORT_DEPTH,
                escort.rotation,
                0.48,
                0.48,
            );
        }

        this.playerInstance.node.active = playerVisible;
        this.playerOutlineInstance.node.active = playerVisible;

        if (playerVisible) {
            this.setTransform(
                this.playerOutlineInstance.node,
                player.position.x,
                player.position.y,
                PLAYER_OUTLINE_DEPTH,
                player.rotation,
                1.09,
                1.09,
            );
            this.setTransform(
                this.playerInstance.node,
                player.position.x,
                player.position.y,
                PLAYER_DEPTH,
                player.rotation,
                1,
                1,
            );
        }

        const speed = Math.hypot(player.velocity.x, player.velocity.y);
        if (!player.alive || !Number.isFinite(speed) || speed <= 18) {
            this.trailInstance.node.active = false;
            return;
        }

        const directionX = player.velocity.x / speed;
        const directionY = player.velocity.y / speed;
        const endDistance = Math.min(28, 8 + speed * 0.036);
        const startDistance = 12;
        const segmentLength = Math.abs(endDistance - startDistance);
        if (segmentLength < 0.25) {
            this.trailInstance.node.active = false;
            return;
        }

        const centerDistance = (startDistance + endDistance) * 0.5;
        this.setTransform(
            this.trailInstance.node,
            player.position.x - directionX * centerDistance,
            player.position.y - directionY * centerDistance,
            TRAIL_DEPTH,
            Math.atan2(directionY, directionX),
            segmentLength,
            1.5,
        );
    }

    private createRoot(parent: Node, name: string): Node {
        const node = new Node(name);
        node.layer = RENDER_LAYER;
        parent.addChild(node);
        return node;
    }

    private createPool(
        name: string,
        capacity: number,
        mesh: Mesh,
        material: Material,
        priority: number,
    ): RenderInstance[] {
        return Array.from({ length: Math.max(0, capacity) }, (_, index) => this.createInstance(
            `${name}:${index}`,
            mesh,
            material,
            priority,
        ));
    }

    private createInstance(
        name: string,
        mesh: Mesh,
        material: Material,
        priority: number,
    ): RenderInstance {
        const node = new Node(name);
        node.layer = RENDER_LAYER;
        this.modelRoot.addChild(node);
        const renderer = node.addComponent(MeshRenderer);
        renderer.mesh = mesh;
        renderer.setSharedMaterial(material, 0);
        renderer.priority = priority;
        node.active = false;
        return { node, renderer, projectileOwner: null };
    }

    private createMaterial(name: string, color: Readonly<Color>): Material {
        const material = new Material();
        material.name = name;

        try {
            material.initialize({
                effectName: 'builtin-unlit',
                technique: 1,
                defines: {
                    USE_INSTANCING: true,
                    USE_TEXTURE: false,
                    USE_VERTEX_COLOR: false,
                },
            });
            material.setProperty('mainColor', new Color(color.r, color.g, color.b, color.a));
            return material;
        } catch (error) {
            material.destroy();
            throw error;
        }
    }

    private createPolygonMesh(
        name: string,
        points: ReadonlyArray<readonly [number, number]>,
        indices: readonly number[],
    ): Mesh {
        const positions: number[] = [];
        for (const [x, y] of points) {
            positions.push(x, y, 0);
        }
        return this.createStaticMesh(name, positions, [...indices]);
    }

    private createQuadMesh(name: string): Mesh {
        return this.createStaticMesh(
            name,
            [
                -0.5, -0.5, 0,
                0.5, -0.5, 0,
                0.5, 0.5, 0,
                -0.5, 0.5, 0,
            ],
            [...QUAD_INDICES],
        );
    }

    private createRingMesh(): Mesh {
        const positions: number[] = [];
        const indices: number[] = [];

        for (let index = 0; index < RING_SEGMENTS; index += 1) {
            const angle = index / RING_SEGMENTS * Math.PI * 2;
            const cosine = Math.cos(angle);
            const sine = Math.sin(angle);
            positions.push(cosine, sine, 0);
            positions.push(cosine * RING_INNER_RADIUS, sine * RING_INNER_RADIUS, 0);
        }

        for (let index = 0; index < RING_SEGMENTS; index += 1) {
            const next = (index + 1) % RING_SEGMENTS;
            const outer = index * 2;
            const inner = outer + 1;
            const nextOuter = next * 2;
            const nextInner = nextOuter + 1;
            indices.push(
                outer, inner, nextOuter,
                nextOuter, inner, nextInner,
            );
        }

        return this.createStaticMesh('CursorSpaceRingMesh', positions, indices);
    }

    private createStaticMesh(name: string, positions: number[], indices: number[]): Mesh {
        let minimumX = Number.POSITIVE_INFINITY;
        let minimumY = Number.POSITIVE_INFINITY;
        let maximumX = Number.NEGATIVE_INFINITY;
        let maximumY = Number.NEGATIVE_INFINITY;

        for (let index = 0; index < positions.length; index += 3) {
            minimumX = Math.min(minimumX, positions[index]);
            minimumY = Math.min(minimumY, positions[index + 1]);
            maximumX = Math.max(maximumX, positions[index]);
            maximumY = Math.max(maximumY, positions[index + 1]);
        }

        const mesh = utils.MeshUtils.createMesh({
            positions,
            indices,
            minPos: new Vec3(minimumX, minimumY, 0),
            maxPos: new Vec3(maximumX, maximumY, 0),
        });
        mesh.name = name;
        return mesh;
    }

    private setTransform(
        node: Node,
        x: number,
        y: number,
        z: number,
        rotation: number,
        scaleX: number,
        scaleY: number,
    ): void {
        if (
            !Number.isFinite(x)
            || !Number.isFinite(y)
            || !Number.isFinite(rotation)
            || !Number.isFinite(scaleX)
            || !Number.isFinite(scaleY)
            || scaleX <= 0
            || scaleY <= 0
        ) {
            node.active = false;
            return;
        }

        node.active = true;
        node.setPosition(x, y, z);
        node.setRotationFromEuler(0, 0, rotation * RADIANS_TO_DEGREES);
        node.setScale(scaleX, scaleY, 1);
    }

    private trackMesh(mesh: Mesh): Mesh {
        this.meshes.push(mesh);
        return mesh;
    }

    private trackMaterial(material: Material): Material {
        this.materials.push(material);
        return material;
    }

    private clamp(value: number, minimum: number, maximum: number): number {
        return Math.max(minimum, Math.min(maximum, value));
    }
}
