import {useCallback, useEffect, useRef} from 'react';
import * as THREE from 'three';

import {usePointerInteraction} from '../../core/pointer/usePointerInteraction';

function writePointerFromClient(clientX: number, clientY: number, target: THREE.Vector2) {
  const width = window.innerWidth || 1;
  const height = window.innerHeight || 1;

  target.set((clientX / width) * 2 - 1, -((clientY / height) * 2 - 1));
}

function shouldIgnoreGlobalInput(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      '.demo-hud, a, button, input, textarea, select, [role="button"], [role="slider"], [class*="leva"], [class*="Leva"]',
    ),
  );
}

export function useMorphInteractionInput() {
  const {interaction, pointerHandlers} = usePointerInteraction();
  const cycleRequest = useRef(0);
  const lastCycleAt = useRef(0);
  const pointer = useRef(new THREE.Vector2());
  const pointerDown = useRef({x: 0, y: 0});
  const wheelCameraImpulse = useRef(0);

  const requestCycle = useCallback(() => {
    const now = performance.now();

    if (now - lastCycleAt.current > 120) {
      cycleRequest.current += 1;
      lastCycleAt.current = now;
      console.info('[ParticleMorphingField] cycle requested', cycleRequest.current);
    }
  }, []);

  useEffect(() => {
    console.info('[ParticleMorphingField] interaction input mounted');

    const handlePointerMove = (event: PointerEvent) => {
      if (shouldIgnoreGlobalInput(event.target)) {
        return;
      }

      writePointerFromClient(event.clientX, event.clientY, pointer.current);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (shouldIgnoreGlobalInput(event.target)) {
        return;
      }

      writePointerFromClient(event.clientX, event.clientY, pointer.current);
      interaction.current.dragTarget = 1;
      pointerDown.current = {x: event.clientX, y: event.clientY};
    };

    const handlePointerUp = (event: PointerEvent) => {
      interaction.current.dragTarget = 0;

      if (shouldIgnoreGlobalInput(event.target)) {
        return;
      }

      writePointerFromClient(event.clientX, event.clientY, pointer.current);

      const dx = event.clientX - pointerDown.current.x;
      const dy = event.clientY - pointerDown.current.y;
      if (dx * dx + dy * dy < 100) {
        requestCycle();
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (shouldIgnoreGlobalInput(event.target)) {
        return;
      }

      event.preventDefault();
      const direction = event.deltaY > 0 ? 1 : -1;
      interaction.current.wheel = THREE.MathUtils.clamp(
        interaction.current.wheel + (direction > 0 ? -0.22 : 0.22),
        -1.35,
        1.35,
      );
      wheelCameraImpulse.current = THREE.MathUtils.clamp(
        wheelCameraImpulse.current + direction * 0.72,
        -1.8,
        2.6,
      );
    };

    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('wheel', handleWheel, {capture: true, passive: false});

    return () => {
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointerup', handlePointerUp, true);
      document.removeEventListener('wheel', handleWheel, true);
    };
  }, [interaction]);

  return {
    cycleRequest,
    interaction,
    pointer,
    pointerHandlers: {
      onPointerLeave: pointerHandlers.onPointerUp,
    },
    requestCycle,
    wheelCameraImpulse,
  };
}
