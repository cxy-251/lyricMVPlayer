import {useFrame, useThree} from '@react-three/fiber';
import {button, folder, useControls} from 'leva';
import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {MutableRefObject, PointerEvent as ReactPointerEvent, WheelEvent} from 'react';
import * as THREE from 'three';

import {Web3DEngine} from '../../core/Web3DEngine';
import {damp, dampFactor, dampVector2, decay} from '../../core/math/easing';
import {usePointerInteraction} from '../../core/pointer/usePointerInteraction';
import type {PointerInteractionState} from '../../core/pointer/usePointerInteraction';
import {createFlightPathData, getFlightFrameIndex} from './flightPath';
import type {FlightPathData} from './flightPath';
import {createRibbonTunnelGeometry, createRibbonTunnelMaterial} from './ribbonTunnel';
import type {RailPaletteName} from './ribbonTunnel';
import {
  createSpacePointMaterial,
  createStarFieldGeometry,
  createTunnelSparkGeometry,
} from './spaceAtmosphere';

// Inspired by Sabo Sugi's "Rails in Space":
// https://x.com/sabosugi/status/2076022180945539475
// https://codepen.io/sabosugi/pen/xbgWXMP

type QualityPreset = 'Performance' | 'Balanced' | 'Showcase';

type RailsControls = {
  bloomStrength: number;
  cameraOffset: number;
  flightSpeed: number;
  glowStrength: number;
  inputStrength: number;
  lookAhead: number;
  palettePreset: RailPaletteName;
  paused: boolean;
  pulseSpeed: number;
  qualityPreset: QualityPreset;
  railCount: number;
  ribbonWidth: number;
  sparkCount: number;
  starBrightness: number;
  starCount: number;
  tunnelRadius: number;
  weave: number;
};

type FlightMotion = {
  effectiveSpeed: number;
  pointer: THREE.Vector2;
  progress: number;
  shaderTime: number;
};

const DEFAULT_CONTROLS: RailsControls = {
  bloomStrength: 0.72,
  cameraOffset: 1.2,
  flightSpeed: 13,
  glowStrength: 1,
  inputStrength: 0.9,
  lookAhead: 7.5,
  palettePreset: 'Original Neon',
  paused: false,
  pulseSpeed: 1,
  qualityPreset: 'Balanced',
  railCount: 128,
  ribbonWidth: 0.09,
  sparkCount: 1200,
  starBrightness: 0.82,
  starCount: 5200,
  tunnelRadius: 8.6,
  weave: 0.16,
};

const QUALITY_SETTINGS: Record<QualityPreset, {particleScale: number; railScale: number; segments: number}> = {
  Performance: {particleScale: 0.68, railScale: 0.78, segments: 360},
  Balanced: {particleScale: 1, railScale: 1, segments: 480},
  Showcase: {particleScale: 1, railScale: 1.17, segments: 620},
};

const PALETTE_TUNING: Record<RailPaletteName, {bloom: number; glow: number}> = {
  'Original Neon': {bloom: 1, glow: 1},
  'Cool Plasma': {bloom: 0.92, glow: 1.05},
  'Solar Spectrum': {bloom: 1.08, glow: 0.94},
};

function FlightCamera({
  controls,
  interaction,
  motion,
  path,
  resetSignal,
  speedBias,
  viewTarget,
}: {
  controls: RailsControls;
  interaction: MutableRefObject<PointerInteractionState>;
  motion: MutableRefObject<FlightMotion>;
  path: FlightPathData;
  resetSignal: MutableRefObject<number>;
  speedBias: MutableRefObject<number>;
  viewTarget: MutableRefObject<THREE.Vector2>;
}) {
  const {camera} = useThree();
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const localOffset = useMemo(() => new THREE.Vector3(), []);
  const frameNormal = useMemo(() => new THREE.Vector3(), []);
  const frameBinormal = useMemo(() => new THREE.Vector3(), []);
  const pointerTarget = useMemo(() => new THREE.Vector2(), []);
  const targetQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const rollQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const lookMatrix = useMemo(() => new THREE.Matrix4(), []);
  const localForward = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const appliedReset = useRef(-1);
  const initialized = useRef(false);

  useEffect(() => {
    initialized.current = false;
  }, [path]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const drag = interaction.current.drag;
    interaction.current.drag = damp(drag, interaction.current.dragTarget, 7.5, delta);
    interaction.current.wheel = decay(interaction.current.wheel, 3, delta);
    speedBias.current = decay(speedBias.current, 1.1, delta);
    pointerTarget.copy(viewTarget.current);
    pointerTarget.clampScalar(-1, 1);
    dampVector2(motion.current.pointer, pointerTarget, 8.5, delta);

    const targetSpeed = THREE.MathUtils.clamp(controls.flightSpeed + speedBias.current, 3, 32);
    motion.current.effectiveSpeed = damp(motion.current.effectiveSpeed, targetSpeed, 4.5, delta);
    if (!controls.paused) {
      motion.current.progress = (motion.current.progress + delta * motion.current.effectiveSpeed / path.length) % 1;
      motion.current.shaderTime += delta;
    }

    if (appliedReset.current !== resetSignal.current) {
      appliedReset.current = resetSignal.current;
      motion.current.progress = 0;
      motion.current.shaderTime = 0;
      initialized.current = false;
    }

    const progress = motion.current.progress;
    const scaledFrame = progress * path.segments;
    const frameIndex = Math.floor(scaledFrame);
    const nextFrameIndex = Math.min(path.segments, frameIndex + 1);
    const frameMix = scaledFrame - frameIndex;
    frameNormal.lerpVectors(path.frames.normals[frameIndex], path.frames.normals[nextFrameIndex], frameMix).normalize();
    frameBinormal.lerpVectors(path.frames.binormals[frameIndex], path.frames.binormals[nextFrameIndex], frameMix).normalize();
    const offsetStrength = controls.cameraOffset * controls.inputStrength;
    path.curve.getPointAt(progress, desiredPosition);
    localOffset.copy(frameBinormal).multiplyScalar(motion.current.pointer.x * offsetStrength * 0.28);
    localOffset.addScaledVector(frameNormal, motion.current.pointer.y * offsetStrength * 0.2);
    desiredPosition.add(localOffset);

    const lookAheadProgress = controls.lookAhead / path.length;
    path.curve.getPointAt((progress + lookAheadProgress) % 1, lookTarget);
    const lookShift = controls.lookAhead * controls.inputStrength * 0.58;
    lookTarget.addScaledVector(frameBinormal, motion.current.pointer.x * lookShift);
    lookTarget.addScaledVector(frameNormal, motion.current.pointer.y * lookShift * 0.72);
    lookMatrix.lookAt(desiredPosition, lookTarget, frameNormal);
    targetQuaternion.setFromRotationMatrix(lookMatrix);
    rollQuaternion.setFromAxisAngle(localForward, -motion.current.pointer.x * 0.045);
    targetQuaternion.multiply(rollQuaternion);

    if (!initialized.current) {
      camera.position.copy(desiredPosition);
      camera.quaternion.copy(targetQuaternion);
      initialized.current = true;
    } else {
      camera.position.copy(desiredPosition);
      camera.quaternion.slerp(targetQuaternion, dampFactor(6.2, delta));
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      const speedRatio = THREE.MathUtils.clamp((motion.current.effectiveSpeed - 4) / 24, 0, 1);
      const targetFov = 69 + speedRatio * 7;
      const nextFov = damp(camera.fov, targetFov, 4, delta);
      if (Math.abs(nextFov - camera.fov) > 0.001) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
    }
  });

  return null;
}

function RibbonTunnel({
  controls,
  glow,
  motion,
  path,
  railCount,
}: {
  controls: RailsControls;
  glow: number;
  motion: MutableRefObject<FlightMotion>;
  path: FlightPathData;
  railCount: number;
}) {
  const geometry = useMemo(
    () =>
      createRibbonTunnelGeometry({
        path,
        palette: controls.palettePreset,
        ribbonCount: railCount,
        ribbonWidth: controls.ribbonWidth,
        tunnelRadius: controls.tunnelRadius,
        weave: controls.weave,
      }),
    [controls.palettePreset, controls.ribbonWidth, controls.tunnelRadius, controls.weave, path, railCount],
  );
  const material = useMemo(() => createRibbonTunnelMaterial(), []);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    material.uniforms.uTime.value = motion.current.shaderTime;
    material.uniforms.uGlow.value = glow;
    material.uniforms.uPulseSpeed.value = controls.pulseSpeed;
  });

  return <mesh frustumCulled={false} geometry={geometry} material={material} />;
}

function StarField({
  brightness,
  count,
  motion,
}: {
  brightness: number;
  count: number;
  motion: MutableRefObject<FlightMotion>;
}) {
  const {gl} = useThree();
  const geometry = useMemo(() => createStarFieldGeometry(count), [count]);
  const material = useMemo(
    () =>
      createSpacePointMaterial({
        brightness,
        pixelRatio: Math.min(gl.getPixelRatio(), 1.75),
        pointScale: 330,
        twinkle: 0.46,
      }),
    [brightness, gl],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    material.uniforms.uTime.value = motion.current.shaderTime;
    material.uniforms.uBrightness.value = brightness;
  });

  return <points frustumCulled={false} geometry={geometry} material={material} />;
}

function TunnelSparks({
  count,
  motion,
  path,
  tunnelRadius,
}: {
  count: number;
  motion: MutableRefObject<FlightMotion>;
  path: FlightPathData;
  tunnelRadius: number;
}) {
  const {gl} = useThree();
  const geometry = useMemo(
    () => createTunnelSparkGeometry({count, path, tunnelRadius}),
    [count, path, tunnelRadius],
  );
  const material = useMemo(
    () =>
      createSpacePointMaterial({
        brightness: 1.25,
        pixelRatio: Math.min(gl.getPixelRatio(), 1.75),
        pointScale: 64,
        twinkle: 0.24,
      }),
    [gl],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    material.uniforms.uTime.value = motion.current.shaderTime;
  });

  return <points frustumCulled={false} geometry={geometry} material={material} />;
}

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.Texture();
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.42)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function DeepSpaceGlows({path}: {path: FlightPathData}) {
  const texture = useMemo(() => createGlowTexture(), []);
  const sprites = useMemo(() => {
    const definitions = [
      {color: '#bf43ff', progress: 0.12, scale: 32, side: 25},
      {color: '#ff477f', progress: 0.38, scale: 27, side: -23},
      {color: '#ff9b45', progress: 0.64, scale: 36, side: 29},
      {color: '#4578ff', progress: 0.86, scale: 30, side: -27},
    ];
    return definitions.map((definition) => {
      const frameIndex = getFlightFrameIndex(path, definition.progress);
      const position = path.curve.getPointAt(definition.progress);
      position.addScaledVector(path.frames.binormals[frameIndex], definition.side);
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: definition.color,
        opacity: 0.18,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(position);
      sprite.scale.setScalar(definition.scale);
      return sprite;
    });
  }, [path, texture]);

  useEffect(
    () => () => {
      texture.dispose();
      for (const sprite of sprites) {
        sprite.material.dispose();
      }
    },
    [sprites, texture],
  );

  return (
    <group>
      {sprites.map((sprite) => (
        <primitive key={sprite.uuid} object={sprite} />
      ))}
    </group>
  );
}

function RailsInSpaceScene() {
  const {interaction, pointerHandlers} = usePointerInteraction();
  const speedBias = useRef(0);
  const resetSignal = useRef(0);
  const resetDefaults = useRef<() => void>(() => undefined);
  const viewTarget = useRef(new THREE.Vector2());
  const dragState = useRef({active: false, pointerId: -1, x: 0, y: 0});
  const motion = useRef<FlightMotion>({
    effectiveSpeed: DEFAULT_CONTROLS.flightSpeed,
    pointer: new THREE.Vector2(),
    progress: 0,
    shaderTime: 0,
  });
  const [rawControls, setControls] = useControls('Rails in Space', () => ({
    Flight: folder({
      flightSpeed: {label: 'Speed', value: DEFAULT_CONTROLS.flightSpeed, min: 4, max: 28, step: 0.1},
      lookAhead: {label: 'Look Ahead', value: DEFAULT_CONTROLS.lookAhead, min: 4, max: 13, step: 0.1},
      cameraOffset: {label: 'Camera Offset', value: DEFAULT_CONTROLS.cameraOffset, min: 0, max: 2.6, step: 0.05},
      inputStrength: {label: 'Input Strength', value: DEFAULT_CONTROLS.inputStrength, min: 0, max: 1.6, step: 0.05},
      paused: {label: 'Pause', value: DEFAULT_CONTROLS.paused},
      restartFlight: button(() => {
        resetSignal.current += 1;
      }),
    }),
    Rails: folder({
      railCount: {label: 'Rail Count', options: {Sparse: 96, Layered: 128, Dense: 150}, value: DEFAULT_CONTROLS.railCount},
      tunnelRadius: {label: 'Tunnel Radius', options: {Tight: 7.2, Balanced: 8.6, Wide: 10.4}, value: DEFAULT_CONTROLS.tunnelRadius},
      ribbonWidth: {label: 'Ribbon Width', options: {Fine: 0.06, Balanced: 0.09, Broad: 0.13}, value: DEFAULT_CONTROLS.ribbonWidth},
      weave: {label: 'Weave', options: {Calm: 0.08, Flowing: 0.16, Twisted: 0.28}, value: DEFAULT_CONTROLS.weave},
      pulseSpeed: {label: 'Pulse Speed', value: DEFAULT_CONTROLS.pulseSpeed, min: 0.35, max: 2, step: 0.05},
      glowStrength: {label: 'Rail Glow', value: DEFAULT_CONTROLS.glowStrength, min: 0.55, max: 1.55, step: 0.05},
    }, {collapsed: true}),
    Atmosphere: folder({
      sparkCount: {label: 'Sparks', options: {Low: 700, Balanced: 1200, Dense: 1500}, value: DEFAULT_CONTROLS.sparkCount},
      starCount: {label: 'Stars', options: {Low: 3200, Balanced: 5200, Dense: 7400}, value: DEFAULT_CONTROLS.starCount},
      starBrightness: {label: 'Star Brightness', value: DEFAULT_CONTROLS.starBrightness, min: 0.35, max: 1.35, step: 0.05},
    }, {collapsed: true}),
    Rendering: folder({
      palettePreset: {
        label: 'Palette',
        options: ['Original Neon', 'Cool Plasma', 'Solar Spectrum'],
        value: DEFAULT_CONTROLS.palettePreset,
      },
      qualityPreset: {
        label: 'Quality',
        options: ['Performance', 'Balanced', 'Showcase'],
        value: DEFAULT_CONTROLS.qualityPreset,
      },
      bloomStrength: {label: 'Bloom', value: DEFAULT_CONTROLS.bloomStrength, min: 0.25, max: 1.15, step: 0.05},
      resetDefaults: button(() => resetDefaults.current()),
    }, {collapsed: true}),
  }));
  const controls = rawControls as unknown as RailsControls;

  useEffect(() => {
    resetDefaults.current = () => {
      setControls(DEFAULT_CONTROLS);
      speedBias.current = 0;
      viewTarget.current.set(0, 0);
      resetSignal.current += 1;
    };
  }, [setControls]);

  const quality = QUALITY_SETTINGS[controls.qualityPreset];
  const path = useMemo(() => createFlightPathData(quality.segments), [quality.segments]);
  const railCount = Math.round(controls.railCount * quality.railScale);
  const sparkCount = Math.round(controls.sparkCount * quality.particleScale);
  const starCount = Math.round(controls.starCount * quality.particleScale);
  const paletteTuning = PALETTE_TUNING[controls.palettePreset];
  const glow = controls.glowStrength * paletteTuning.glow;
  const bloom = controls.bloomStrength * paletteTuning.bloom;

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      pointerHandlers.onWheel(event);
      const direction = event.deltaY > 0 ? -1 : 1;
      speedBias.current = THREE.MathUtils.clamp(speedBias.current + direction * 1.4, -4.5, 7);
    },
    [pointerHandlers],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      pointerHandlers.onPointerDown();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragState.current = {
        active: true,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
    },
    [pointerHandlers],
  );

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    const width = Math.max(1, event.currentTarget.clientWidth);
    const height = Math.max(1, event.currentTarget.clientHeight);
    viewTarget.current.x = THREE.MathUtils.clamp(
      viewTarget.current.x + (event.clientX - drag.x) / width * 3.4,
      -0.92,
      0.92,
    );
    viewTarget.current.y = THREE.MathUtils.clamp(
      viewTarget.current.y - (event.clientY - drag.y) / height * 3.4,
      -0.8,
      0.8,
    );
    drag.x = event.clientX;
    drag.y = event.clientY;
  }, []);

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragState.current.active = false;
      pointerHandlers.onPointerUp();
    },
    [pointerHandlers],
  );

  const handleDoubleClick = useCallback(() => {
    viewTarget.current.set(0, 0);
  }, []);

  return (
    <Web3DEngine
      onDoubleClick={handleDoubleClick}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      config={{
        background: '#010104',
        bloom: {
          intensity: bloom,
          luminanceSmoothing: 0.68,
          luminanceThreshold: 0.16,
        },
        camera: {fov: 72, far: 1400, near: 0.04, position: [0, 0, 0]},
        vignette: {darkness: 0.56, offset: 0.18},
      }}
    >
      <FlightCamera
        controls={controls}
        interaction={interaction}
        motion={motion}
        path={path}
        resetSignal={resetSignal}
        speedBias={speedBias}
        viewTarget={viewTarget}
      />
      <StarField brightness={controls.starBrightness} count={starCount} motion={motion} />
      <DeepSpaceGlows path={path} />
      <RibbonTunnel controls={controls} glow={glow} motion={motion} path={path} railCount={railCount} />
      <TunnelSparks count={sparkCount} motion={motion} path={path} tunnelRadius={controls.tunnelRadius} />
    </Web3DEngine>
  );
}

export default function Demo008NeonEnergyTunnel() {
  return <RailsInSpaceScene />;
}
