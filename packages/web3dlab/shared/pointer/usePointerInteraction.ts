import {useCallback, useRef} from 'react';
import type {WheelEvent} from 'react';
import * as THREE from 'three';

export type PointerInteractionState = {
  drag: number;
  dragTarget: number;
  wheel: number;
};

export function usePointerInteraction() {
  const interaction = useRef<PointerInteractionState>({
    drag: 0,
    dragTarget: 0,
    wheel: 0,
  });

  const onPointerDown = useCallback(() => {
    interaction.current.dragTarget = 1;
  }, []);

  const onPointerUp = useCallback(() => {
    interaction.current.dragTarget = 0;
  }, []);

  const onWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    interaction.current.wheel = THREE.MathUtils.clamp(interaction.current.wheel + direction * 0.22, -1.35, 1.35);
  }, []);

  return {
    interaction,
    pointerHandlers: {
      onPointerDown,
      onPointerLeave: onPointerUp,
      onPointerUp,
      onWheel,
    },
  };
}
