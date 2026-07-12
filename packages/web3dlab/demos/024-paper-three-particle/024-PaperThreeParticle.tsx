import {OrbitControls, PerspectiveCamera} from '@react-three/drei';
import {useFrame, type ThreeEvent} from '@react-three/fiber';
import {CuboidCollider, Physics, RigidBody, type RapierRigidBody} from '@react-three/rapier';
import {Pause, Play, Shuffle, Zap} from 'lucide-react';
import {useControls} from 'leva';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';
import {
  buildElasticBallSeeds,
  type ChamberBounds,
  type ElasticBallSeed,
} from './elasticSimulation';

const CHAMBER_BOUNDS: ChamberBounds = {x: 6.2, y: 3.7, z: 2.4};

const PALETTES = {
  spectrum: ['#42e3cc', '#4c8dff', '#8c62e8', '#ff4f98', '#ffb347', '#b8ef55'],
  thermal: ['#50d6ff', '#7b79ff', '#d45cff', '#ff586f', '#ff9f43', '#ffe36a'],
  mineral: ['#77e0c2', '#53a8d8', '#7783c9', '#bd74b7', '#e59b65', '#d4d89b'],
} as const;

type PaletteName = keyof typeof PALETTES;

export type ElasticStats = {
  collisions: number;
  energyRatio: number;
};

type ThreeParticleEffectProps = {
  absoluteFrame?: number;
  ballCount?: number;
  ballRadius?: number;
  interactive?: boolean;
  onStats?: (stats: ElasticStats) => void;
  palette?: PaletteName;
  paused?: boolean;
  pulseToken?: number;
  resetToken?: number;
  seed?: number;
  simulationFrame?: number;
  speed?: number;
};

type BodyRegistry = Map<number, RapierRigidBody>;

const vecLength = ({x, y, z}: {x: number; y: number; z: number}) => Math.sqrt(x * x + y * y + z * z);

function ElasticBall({
  color,
  onCollision,
  radius,
  register,
  seed,
  speed,
}: {
  color: string;
  onCollision: () => void;
  radius: number;
  register: (id: number, body: RapierRigidBody | null) => void;
  seed: ElasticBallSeed;
  speed: number;
}) {
  const bodyRef = useRef<RapierRigidBody>(null);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    register(seed.id, body);
    body.setLinvel({x: seed.velocity[0], y: seed.velocity[1], z: seed.velocity[2]}, true);
    return () => register(seed.id, null);
  }, [register, seed]);

  const redirectBall = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 4 || !bodyRef.current) return;
    event.stopPropagation();
    const body = bodyRef.current;
    const position = body.translation();
    const velocity = body.linvel();
    const magnitude = Math.max(0.001, vecLength(velocity));
    const normal = new THREE.Vector3(
      event.point.x - position.x,
      event.point.y - position.y,
      event.point.z - position.z,
    ).normalize();
    const redirected = new THREE.Vector3(velocity.x, velocity.y, velocity.z).reflect(normal);
    if (redirected.lengthSq() < 0.001) redirected.set(1, 0.2, -0.3);
    redirected.normalize().multiplyScalar(magnitude || speed);
    body.setLinvel({x: redirected.x, y: redirected.y, z: redirected.z}, true);
  }, [speed]);

  return (
    <RigidBody
      angularDamping={0}
      canSleep={false}
      ccd
      colliders="ball"
      friction={0}
      linearDamping={0}
      mass={1}
      onCollisionEnter={onCollision}
      position={seed.position}
      ref={bodyRef}
      restitution={1}
    >
      <mesh
        castShadow
        onClick={redirectBall}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer';
        }}
      >
        <sphereGeometry args={[radius, 28, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.1}
          metalness={0.34}
          roughness={0.2}
        />
      </mesh>
    </RigidBody>
  );
}

function ChamberBounds() {
  const thickness = 0.12;
  return (
    <RigidBody colliders={false} friction={0} restitution={1} type="fixed">
      <CuboidCollider args={[thickness, CHAMBER_BOUNDS.y, CHAMBER_BOUNDS.z]} friction={0} position={[-CHAMBER_BOUNDS.x - thickness, 0, 0]} restitution={1} />
      <CuboidCollider args={[thickness, CHAMBER_BOUNDS.y, CHAMBER_BOUNDS.z]} friction={0} position={[CHAMBER_BOUNDS.x + thickness, 0, 0]} restitution={1} />
      <CuboidCollider args={[CHAMBER_BOUNDS.x, thickness, CHAMBER_BOUNDS.z]} friction={0} position={[0, -CHAMBER_BOUNDS.y - thickness, 0]} restitution={1} />
      <CuboidCollider args={[CHAMBER_BOUNDS.x, thickness, CHAMBER_BOUNDS.z]} friction={0} position={[0, CHAMBER_BOUNDS.y + thickness, 0]} restitution={1} />
      <CuboidCollider args={[CHAMBER_BOUNDS.x, CHAMBER_BOUNDS.y, thickness]} friction={0} position={[0, 0, -CHAMBER_BOUNDS.z - thickness]} restitution={1} />
      <CuboidCollider args={[CHAMBER_BOUNDS.x, CHAMBER_BOUNDS.y, thickness]} friction={0} position={[0, 0, CHAMBER_BOUNDS.z + thickness]} restitution={1} />
    </RigidBody>
  );
}

function ChamberVisual({onPulse}: {onPulse: (point: THREE.Vector3) => void}) {
  const edgeGeometry = useMemo(() => {
    const box = new THREE.BoxGeometry(CHAMBER_BOUNDS.x * 2, CHAMBER_BOUNDS.y * 2, CHAMBER_BOUNDS.z * 2);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, []);

  useEffect(() => () => edgeGeometry.dispose(), [edgeGeometry]);

  return (
    <>
      <lineSegments geometry={edgeGeometry}>
        <lineBasicMaterial color="#66869a" opacity={0.58} transparent />
      </lineSegments>
      <gridHelper
        args={[CHAMBER_BOUNDS.x * 2, 24, '#29485a', '#172732']}
        position={[0, 0, -CHAMBER_BOUNDS.z - 0.02]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <mesh
        onClick={(event) => {
          if (event.delta > 4) return;
          event.stopPropagation();
          onPulse(event.point.clone());
        }}
        position={[0, 0, -CHAMBER_BOUNDS.z - 0.04]}
      >
        <planeGeometry args={[CHAMBER_BOUNDS.x * 2, CHAMBER_BOUNDS.y * 2]} />
        <meshBasicMaterial depthWrite={false} opacity={0} transparent />
      </mesh>
    </>
  );
}

function ElasticWorld({
  onStats,
  palette,
  pulseToken,
  radius,
  seeds,
  speed,
}: {
  onStats?: (stats: ElasticStats) => void;
  palette: PaletteName;
  pulseToken: number;
  radius: number;
  seeds: ElasticBallSeed[];
  speed: number;
}) {
  const bodiesRef = useRef<BodyRegistry>(new Map());
  const collisionCountRef = useRef(0);
  const statsClockRef = useRef(0);
  const lastPulseTokenRef = useRef(pulseToken);
  const previousSpeedRef = useRef(speed);
  const statsCallbackRef = useRef(onStats);
  statsCallbackRef.current = onStats;

  const register = useCallback((id: number, body: RapierRigidBody | null) => {
    if (body) bodiesRef.current.set(id, body);
    else bodiesRef.current.delete(id);
  }, []);

  const redirectFrom = useCallback((origin: THREE.Vector3) => {
    bodiesRef.current.forEach((body, id) => {
      const position = body.translation();
      const velocity = body.linvel();
      const magnitude = Math.max(0.01, vecLength(velocity) || speed);
      const direction = new THREE.Vector3(position.x, position.y, position.z).sub(origin);
      if (direction.lengthSq() < 0.001) {
        direction.set(Math.sin(id * 2.1), Math.cos(id * 1.7), Math.sin(id * 0.9 + 1));
      }
      direction.normalize().multiplyScalar(magnitude);
      body.setLinvel({x: direction.x, y: direction.y, z: direction.z}, true);
    });
  }, [speed]);

  useEffect(() => {
    if (lastPulseTokenRef.current === pulseToken) return;
    lastPulseTokenRef.current = pulseToken;
    redirectFrom(new THREE.Vector3(0, 0, 0));
  }, [pulseToken, redirectFrom]);

  useEffect(() => {
    const previousSpeed = Math.max(0.01, previousSpeedRef.current);
    if (Math.abs(previousSpeed - speed) < 0.001) return;
    const scale = speed / previousSpeed;
    bodiesRef.current.forEach((body) => {
      const velocity = body.linvel();
      body.setLinvel({x: velocity.x * scale, y: velocity.y * scale, z: velocity.z * scale}, true);
    });
    previousSpeedRef.current = speed;
  }, [speed]);

  useFrame((_state, delta) => {
    statsClockRef.current += delta;
    if (statsClockRef.current < 0.3 || bodiesRef.current.size === 0) return;
    statsClockRef.current = 0;
    let squaredSpeedSum = 0;
    bodiesRef.current.forEach((body) => {
      const velocity = body.linvel();
      squaredSpeedSum += velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z;
    });
    const expectedSquaredSpeed = bodiesRef.current.size * speed * speed;
    const energyRatio = expectedSquaredSpeed > 0 ? squaredSpeedSum / expectedSquaredSpeed : 1;
    let correctedEnergyRatio = energyRatio;
    if (energyRatio > 0 && Math.abs(energyRatio - 1) > 0.001) {
      const correction = Math.sqrt(1 / energyRatio);
      bodiesRef.current.forEach((body) => {
        const velocity = body.linvel();
        body.setLinvel({x: velocity.x * correction, y: velocity.y * correction, z: velocity.z * correction}, true);
      });
      correctedEnergyRatio = 1;
    }
    statsCallbackRef.current?.({
      collisions: collisionCountRef.current,
      energyRatio: correctedEnergyRatio > 0 ? correctedEnergyRatio : 1,
    });
  });

  const colors = PALETTES[palette];
  return (
    <>
      <ChamberBounds />
      <ChamberVisual onPulse={redirectFrom} />
      {seeds.map((ball) => (
        <ElasticBall
          color={colors[ball.colorIndex % colors.length]!}
          key={ball.id}
          onCollision={() => {
            collisionCountRef.current += 1;
          }}
          radius={radius}
          register={register}
          seed={ball}
          speed={speed}
        />
      ))}
    </>
  );
}

export function ThreeParticleEffect({
  ballCount = 24,
  ballRadius = 0.42,
  interactive = true,
  onStats,
  palette = 'spectrum',
  paused = false,
  pulseToken = 0,
  resetToken = 0,
  seed = 1,
  speed = 4.6,
}: ThreeParticleEffectProps) {
  const resolvedCount = Math.max(6, Math.min(48, Math.round(ballCount)));
  const resolvedRadius = THREE.MathUtils.clamp(ballRadius, 0.22, 0.68);
  const resolvedSpeed = THREE.MathUtils.clamp(speed, 1.5, 9);
  const seeds = useMemo(() => buildElasticBallSeeds({
    bounds: CHAMBER_BOUNDS,
    count: resolvedCount,
    radius: resolvedRadius,
    seed: seed + resetToken * 101,
    speed: resolvedSpeed,
  }), [resetToken, resolvedCount, resolvedRadius, resolvedSpeed, seed]);

  return (
    <>
      <ambientLight intensity={0.52} />
      <directionalLight castShadow intensity={1.65} position={[-4, 6, 9]} />
      <pointLight color="#58d9ff" intensity={18} position={[-5, -2, 4]} />
      <pointLight color="#ff5fa2" intensity={14} position={[5, 3, -2]} />
      <Physics gravity={[0, 0, 0]} interpolate paused={paused} timeStep={1 / 60}>
        <ElasticWorld
          onStats={onStats}
          palette={palette}
          pulseToken={pulseToken}
          radius={resolvedRadius}
          seeds={seeds}
          speed={resolvedSpeed}
        />
      </Physics>
      <PerspectiveCamera far={60} fov={42} makeDefault near={0.1} position={[0, 0, 17]} />
      {interactive ? (
        <OrbitControls
          dampingFactor={0.08}
          enableDamping
          enablePan={false}
          makeDefault
          maxDistance={24}
          minDistance={10}
        />
      ) : null}
    </>
  );
}

const COLLISION_STYLES = `
  .collision-lab {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    background: #06090f;
  }

  .collision-hud {
    position: fixed;
    z-index: 12;
    top: 64px;
    left: 50%;
    width: min(500px, calc(100vw - 132px));
    transform: translateX(-50%);
    padding: 11px 13px 10px;
    border: 1px solid rgba(139, 184, 207, 0.2);
    border-radius: 6px;
    background: rgba(8, 13, 21, 0.9);
    color: #eef7fb;
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(12px);
  }

  .collision-hud__row,
  .collision-hud__stats,
  .collision-hud__actions {
    display: flex;
    align-items: center;
  }

  .collision-hud__row,
  .collision-hud__stats {
    justify-content: space-between;
    gap: 14px;
  }

  .collision-hud__title strong {
    display: block;
    font-size: 0.88rem;
    font-weight: 760;
    line-height: 1.15;
  }

  .collision-hud__mode {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 4px;
    color: #91aab8;
    font-size: 0.66rem;
    font-weight: 700;
  }

  .collision-hud__mode::before {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #55e4c0;
    box-shadow: 0 0 10px rgba(85, 228, 192, 0.56);
    content: '';
  }

  .collision-hud[data-paused='true'] .collision-hud__mode::before {
    background: #ffc55f;
    box-shadow: 0 0 10px rgba(255, 197, 95, 0.46);
  }

  .collision-hud__actions {
    gap: 6px;
  }

  .collision-hud__action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 31px;
    height: 31px;
    border: 1px solid rgba(174, 207, 222, 0.18);
    border-radius: 5px;
    background: #131b26;
    color: #cee0e8;
    cursor: pointer;
  }

  .collision-hud__action:hover {
    border-color: rgba(85, 228, 192, 0.5);
    color: #ffffff;
  }

  .collision-hud__action:focus-visible {
    outline: 2px solid #55e4c0;
    outline-offset: 2px;
  }

  .collision-hud__stats {
    margin-top: 9px;
    padding-top: 8px;
    border-top: 1px solid rgba(174, 207, 222, 0.12);
    color: #7f96a3;
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
  }

  .collision-hud__stats strong {
    color: #d9eaf0;
    font-weight: 720;
  }

  @media (max-width: 650px) {
    .collision-hud {
      top: 70px;
      width: min(480px, calc(100vw - 28px));
    }
  }
`;

export default function Demo024PaperThreeParticle() {
  const controls = useControls('Elastic Collision', {
    ballCount: {label: 'Ball Count', max: 48, min: 6, step: 1, value: 24},
    ballRadius: {label: 'Ball Radius', max: 0.68, min: 0.22, step: 0.01, value: 0.42},
    speed: {label: 'Speed', max: 9, min: 1.5, step: 0.1, value: 4.6},
    palette: {label: 'Palette', options: {Spectrum: 'spectrum', Thermal: 'thermal', Mineral: 'mineral'}, value: 'spectrum'},
  });
  const [paused, setPaused] = useState(false);
  const [pulseToken, setPulseToken] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const [stats, setStats] = useState<ElasticStats>({collisions: 0, energyRatio: 1});
  const ballCount = Math.max(6, Math.min(48, Math.round(controls.ballCount)));

  return (
    <div className="collision-lab">
      <style>{COLLISION_STYLES}</style>
      <div className="collision-hud" data-paused={paused}>
        <div className="collision-hud__row">
          <div className="collision-hud__title">
            <strong>Elastic Collision Chamber</strong>
            <span className="collision-hud__mode">{paused ? 'PAUSED' : 'RESTITUTION 1.00'}</span>
          </div>
          <div className="collision-hud__actions">
            <button
              aria-label={paused ? 'Resume simulation' : 'Pause simulation'}
              className="collision-hud__action"
              onClick={() => setPaused((value) => !value)}
              title={paused ? 'Resume simulation' : 'Pause simulation'}
              type="button"
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
            <button
              aria-label="Apply radial pulse"
              className="collision-hud__action"
              onClick={() => setPulseToken((value) => value + 1)}
              title="Apply radial pulse without changing kinetic energy"
              type="button"
            >
              <Zap size={15} />
            </button>
            <button
              aria-label="Reset collision world"
              className="collision-hud__action"
              onClick={() => {
                setResetToken((value) => value + 1);
                setStats({collisions: 0, energyRatio: 1});
              }}
              title="Reset positions and directions"
              type="button"
            >
              <Shuffle size={15} />
            </button>
          </div>
        </div>
        <div className="collision-hud__stats">
          <span>Balls <strong>{ballCount}</strong></span>
          <span>Collisions <strong>{stats.collisions}</strong></span>
          <span>Energy <strong>{(stats.energyRatio * 100).toFixed(1)}%</strong></span>
        </div>
      </div>

      <DemoScene
        engineConfig={{
          background: '#06090f',
          bloom: {intensity: 0.08, luminanceSmoothing: 0.42, luminanceThreshold: 0.84},
          vignette: {darkness: 0.32, offset: 0.34},
        }}
        orbitControls={false}
      >
        <ThreeParticleEffect
          ballCount={ballCount}
          ballRadius={THREE.MathUtils.clamp(controls.ballRadius, 0.22, 0.68)}
          onStats={setStats}
          palette={controls.palette as PaletteName}
          paused={paused}
          pulseToken={pulseToken}
          resetToken={resetToken}
          seed={1}
          speed={THREE.MathUtils.clamp(controls.speed, 1.5, 9)}
        />
      </DemoScene>
    </div>
  );
}
