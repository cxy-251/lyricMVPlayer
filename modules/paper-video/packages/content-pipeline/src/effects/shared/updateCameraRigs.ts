import type * as THREE from "three";
import type {DollyRigInput, OrbitRigInput} from "./presentation.types";

/**
 * These rigs stay deliberately small and stateless so multiple effect families
 * can share the same cinematic language without sharing their actual shaders or simulation code.
 */
export const applyOrbitRig = ({
  camera,
  target,
  time,
  orbitSpeed,
  radius,
  radiusJitter = 0,
  centerY,
  heightJitter = 0,
  lateralJitter = 0,
  targetX = 0,
  targetXJitter = 0,
  targetY = 0,
  targetYJitter = 0,
  targetZ = 0,
  targetZJitter = 0,
}: OrbitRigInput) => {
  const orbitPhase = time * orbitSpeed;
  const resolvedRadius = radius + Math.sin(time * 0.33) * radiusJitter;

  camera.position.set(
    Math.sin(orbitPhase) * resolvedRadius + Math.sin(time * 0.27) * lateralJitter,
    centerY + Math.sin(time * 0.21) * heightJitter,
    Math.cos(orbitPhase) * resolvedRadius,
  );

  target.set(
    targetX + Math.sin(time * 0.16) * targetXJitter,
    targetY + Math.sin(time * 0.41) * targetYJitter,
    targetZ + Math.cos(time * 0.11) * targetZJitter,
  );
  camera.lookAt(target);
};

export const applyForwardDollyRig = ({
  camera,
  target,
  time,
  baseX,
  baseY,
  baseZ,
  dollyOffset,
  dollyMultiplier,
  xDrift = 0,
  yDrift = 0,
  zDrift = 0,
  targetX = 0,
  targetY,
  targetZ,
  targetXDrift = 0,
  targetYDrift = 0,
  targetZDrift = 0,
}: DollyRigInput) => {
  camera.position.set(
    baseX + Math.sin(time * 0.17) * xDrift,
    baseY + Math.cos(time * 0.13) * yDrift,
    baseZ - dollyOffset * dollyMultiplier + Math.sin(time * 0.08) * zDrift,
  );

  target.set(
    targetX + Math.sin(time * 0.16) * targetXDrift,
    targetY + Math.sin(time * 0.28) * targetYDrift,
    targetZ - dollyOffset * (dollyMultiplier + 0.43) + Math.sin(time * 0.11) * targetZDrift,
  );
  camera.lookAt(target);
};
