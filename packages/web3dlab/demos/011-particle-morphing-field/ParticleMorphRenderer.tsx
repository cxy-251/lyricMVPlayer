import {useFrame, useThree} from '@react-three/fiber';
import {useEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';

import {
  clampMorphParticleCount,
  createWebGlMorphSimulation,
  type MorphControls,
} from './particleSimulation';
import {createMorphGeometryFromTargets, generateMorphTargets} from './particleTargets';
import morphParticleFragmentShader from './shaders/morphParticles.frag';
import morphParticleVertexShader from './shaders/morphParticles.vert';

const CLICK_DRAG_THRESHOLD_SQ = 64;
const CAMERA_MIN_DISTANCE = 4.2;
const CAMERA_MAX_DISTANCE = 14;
const CAMERA_ROTATE_SPEED = 0.006;
const CAMERA_PITCH_SPEED = 0.004;
const CAMERA_ZOOM_SPEED = 0.006;
const CAMERA_MIN_PITCH = -0.9;
const CAMERA_MAX_PITCH = 0.9;
const SUPPRESS_CLICK_AFTER_DRAG_MS = 240;

function syncMaterialUniforms(material: THREE.ShaderMaterial, uniforms: Record<string, THREE.IUniform>) {
  Object.entries(uniforms).forEach(([key, uniform]) => {
    const materialUniform = material.uniforms[key];

    if (materialUniform) {
      materialUniform.value = uniform.value;
    }
  });

  material.uniformsNeedUpdate = true;
}

export function ParticleMorphRenderer({
  controls,
}: {
  controls: MorphControls;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const cycleRequest = useRef(0);
  const pointerState = useRef({
    active: false,
    dragging: false,
    lastX: 0,
    lastY: 0,
    pointerId: -1,
    startX: 0,
    startY: 0,
  });
  const cameraState = useRef({
    distance: 8.2,
    pitch: 0.03,
    targetDistance: 8.2,
    targetPitch: 0.03,
    targetYaw: 0,
    yaw: 0,
  });
  const lastCycleAt = useRef(0);
  const lastDragEndAt = useRef(0);
  const simulation = useMemo(() => createWebGlMorphSimulation(controls), []);
  const safeCount = useMemo(() => clampMorphParticleCount(controls.particleCount), [controls.particleCount]);
  const targets = useMemo(() => generateMorphTargets(safeCount), [safeCount]);
  const geometry = useMemo(() => createMorphGeometryFromTargets(targets), [targets]);
  const {camera, gl} = useThree();

  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => {
    const canvas = gl.domElement;
    const ownerDocument = canvas.ownerDocument;
    const initialCursor = canvas.style.cursor;

    const requestCycle = () => {
      const now = performance.now();

      if (now - lastCycleAt.current < 160) {
        return;
      }

      cycleRequest.current += 1;
      lastCycleAt.current = now;
    };

    const eventStartsOnCanvas = (event: MouseEvent | PointerEvent) => (
      event.target === canvas || ownerDocument.elementFromPoint(event.clientX, event.clientY) === canvas
    );

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !eventStartsOnCanvas(event)) {
        return;
      }

      const pointer = pointerState.current;

      pointer.active = true;
      pointer.dragging = false;
      pointer.pointerId = event.pointerId;
      pointer.startX = event.clientX;
      pointer.startY = event.clientY;
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      canvas.style.cursor = 'grabbing';
      canvas.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const pointer = pointerState.current;

      if (!pointer.active || event.pointerId !== pointer.pointerId) {
        return;
      }

      const moveX = event.clientX - pointer.lastX;
      const moveY = event.clientY - pointer.lastY;
      const totalX = event.clientX - pointer.startX;
      const totalY = event.clientY - pointer.startY;

      if (totalX * totalX + totalY * totalY > CLICK_DRAG_THRESHOLD_SQ) {
        pointer.dragging = true;
      }

      if (pointer.dragging) {
        const orbit = cameraState.current;

        orbit.targetYaw -= moveX * CAMERA_ROTATE_SPEED;
        orbit.targetPitch = THREE.MathUtils.clamp(
          orbit.targetPitch - moveY * CAMERA_PITCH_SPEED,
          CAMERA_MIN_PITCH,
          CAMERA_MAX_PITCH,
        );
      }

      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const pointer = pointerState.current;

      if (!pointer.active || event.pointerId !== pointer.pointerId) {
        return;
      }

      const dx = event.clientX - pointer.startX;
      const dy = event.clientY - pointer.startY;
      const wasClick = !pointer.dragging && dx * dx + dy * dy <= CLICK_DRAG_THRESHOLD_SQ;

      if (!wasClick) {
        lastDragEndAt.current = performance.now();
      }

      pointer.active = false;
      pointer.dragging = false;
      pointer.pointerId = -1;
      canvas.style.cursor = 'grab';

      if (canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      if (wasClick) {
        requestCycle();
      }
    };

    const handlePointerCancel = (event: PointerEvent) => {
      const pointer = pointerState.current;

      if (event.pointerId !== pointer.pointerId) {
        return;
      }

      pointer.active = false;
      pointer.dragging = false;
      pointer.pointerId = -1;
      canvas.style.cursor = 'grab';
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const orbit = cameraState.current;

      orbit.targetDistance = THREE.MathUtils.clamp(
        orbit.targetDistance + event.deltaY * CAMERA_ZOOM_SPEED,
        CAMERA_MIN_DISTANCE,
        CAMERA_MAX_DISTANCE,
      );
    };

    const handleClick = (event: MouseEvent) => {
      if (!eventStartsOnCanvas(event)) {
        return;
      }

      if (performance.now() - lastDragEndAt.current < SUPPRESS_CLICK_AFTER_DRAG_MS) {
        return;
      }

      requestCycle();
    };

    canvas.style.cursor = 'grab';
    ownerDocument.addEventListener('pointerdown', handlePointerDown, true);
    ownerDocument.addEventListener('pointermove', handlePointerMove, true);
    ownerDocument.addEventListener('pointerup', handlePointerEnd, true);
    ownerDocument.addEventListener('pointercancel', handlePointerCancel, true);
    ownerDocument.addEventListener('click', handleClick, true);
    canvas.addEventListener('wheel', handleWheel, {passive: false});

    return () => {
      canvas.style.cursor = initialCursor;
      ownerDocument.removeEventListener('pointerdown', handlePointerDown, true);
      ownerDocument.removeEventListener('pointermove', handlePointerMove, true);
      ownerDocument.removeEventListener('pointerup', handlePointerEnd, true);
      ownerDocument.removeEventListener('pointercancel', handlePointerCancel, true);
      ownerDocument.removeEventListener('click', handleClick, true);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [gl.domElement]);

  useFrame((state, delta) => {
    const points = pointsRef.current;

    if (!points) {
      return;
    }

    const orbit = cameraState.current;
    const frame = simulation.step({
      controls,
      cycleRequest,
      delta,
      elapsedTime: state.clock.elapsedTime,
      pixelRatio: Math.min(gl.getPixelRatio(), 1.75),
    });
    const material = materialRef.current;
    const safeDelta = Math.min(delta, 0.045);
    const cameraEase = 1 - Math.exp(-8 * safeDelta);

    if (material) {
      syncMaterialUniforms(material, simulation.uniforms);
    }

    orbit.yaw += (orbit.targetYaw - orbit.yaw) * cameraEase;
    orbit.pitch += (orbit.targetPitch - orbit.pitch) * cameraEase;
    orbit.distance += (orbit.targetDistance - orbit.distance) * cameraEase;

    const pitchCos = Math.cos(orbit.pitch);
    camera.position.set(
      Math.sin(orbit.yaw) * pitchCos * orbit.distance,
      Math.sin(orbit.pitch) * orbit.distance,
      Math.cos(orbit.yaw) * pitchCos * orbit.distance,
    );
    camera.lookAt(0, 0, 0);

    points.rotation.y += frame.rotationDeltaY;
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        fragmentShader={morphParticleFragmentShader}
        transparent
        uniforms={simulation.uniforms}
        vertexShader={morphParticleVertexShader}
      />
    </points>
  );
}
