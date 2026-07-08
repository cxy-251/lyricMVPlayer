import React from "react";
import {ThreeEvent, useFrame} from "@react-three/fiber";
import * as THREE from "three";

import type {SpectrumColor} from "../data/spectrum-colors";
import {lighten} from "../utils/color-convert";
import {getDiscLayout} from "../utils/spectrum-layout";

type SpectrumDiscTerrainProps = {
  colors: SpectrumColor[];
  selectedId: string;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
};

const matrixObject = new THREE.Object3D();
const instanceColor = new THREE.Color();

type DropEvent = {
  id: number;
  colorId: string;
};

type SpectrumDropProps = {
  color: SpectrumColor;
  layout: ReturnType<typeof getDiscLayout>;
  onComplete: () => void;
};

const SpectrumDrop: React.FC<SpectrumDropProps> = ({color, layout, onComplete}) => {
  const sphereRef = React.useRef<THREE.Mesh>(null);
  const sphereMaterialRef = React.useRef<THREE.MeshStandardMaterial>(null);
  const rippleRef = React.useRef<THREE.Mesh>(null);
  const rippleMaterialRef = React.useRef<THREE.MeshBasicMaterial>(null);
  const elapsedRef = React.useRef(0);

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    const progress = Math.min(1, elapsedRef.current / 0.95);
    const dropProgress = Math.min(1, progress / 0.58);
    const fade = Math.max(0, 1 - progress);

    if (sphereRef.current) {
      sphereRef.current.position.y = 1.56 - dropProgress * 1.36;
      sphereRef.current.scale.setScalar(0.22 + fade * 0.28);
    }
    if (sphereMaterialRef.current) {
      sphereMaterialRef.current.opacity = Math.max(0, 0.76 - progress * 0.82);
    }
    if (rippleRef.current) {
      const rippleScale = layout.scale * (0.82 + progress * 2.45);
      rippleRef.current.scale.set(rippleScale, rippleScale, rippleScale);
    }
    if (rippleMaterialRef.current) {
      rippleMaterialRef.current.opacity = Math.max(0, 0.58 * fade);
    }
    if (progress >= 1) onComplete();
  });

  return (
    <group position={[layout.position[0], layout.position[1] + 0.16, layout.position[2]]}>
      <mesh ref={sphereRef} position={[0, 1.56, 0]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial
          ref={sphereMaterialRef}
          color={lighten(color.hex, 0.52)}
          emissive={lighten(color.hex, 0.22)}
          emissiveIntensity={0.28}
          roughness={0.24}
          transparent
          opacity={0.76}
        />
      </mesh>
      <mesh ref={rippleRef} rotation={[-Math.PI / 2, 0, 0]} scale={layout.scale * 0.62}>
        <ringGeometry args={[0.62, 0.74, 72]} />
        <meshBasicMaterial
          ref={rippleMaterialRef}
          color={lighten(color.hex, 0.28)}
          transparent
          opacity={0.72}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

export const SpectrumDiscTerrain: React.FC<SpectrumDiscTerrainProps> = ({
  colors,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
}) => {
  const meshRef = React.useRef<THREE.InstancedMesh>(null);
  const [drop, setDrop] = React.useState<DropEvent | null>(null);
  const layouts = React.useMemo(
    () => colors.map((color, index) => getDiscLayout(color, index, colors.length)),
    [colors],
  );
  const selectedIndex = React.useMemo(
    () => Math.max(0, colors.findIndex((color) => color.id === selectedId)),
    [colors, selectedId],
  );
  const selectedLayout = layouts[selectedIndex];
  const selectedColor = colors[selectedIndex];
  const dropIndex = React.useMemo(
    () => drop ? colors.findIndex((color) => color.id === drop.colorId) : -1,
    [colors, drop],
  );
  const dropLayout = dropIndex >= 0 ? layouts[dropIndex] : null;
  const dropColor = dropIndex >= 0 ? colors[dropIndex] : null;

  React.useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    colors.forEach((color, index) => {
      const layout = layouts[index];
      const selected = color.id === selectedId;
      const hovered = color.id === hoveredId;
      const [x, y, z] = layout.position;
      const lift = y + (selected ? 0.045 : 0);
      const scale = layout.scale;
      const canTilt = hovered && !selected;
      const tiltX = canTilt ? -0.38 : 0;
      const tiltZ = canTilt ? 0.28 : 0;

      matrixObject.position.set(x, lift, z);
      matrixObject.rotation.set(tiltX, layout.angle * 0.08, tiltZ, "YXZ");
      matrixObject.scale.set(scale, 1, scale);
      matrixObject.updateMatrix();
      mesh.setMatrixAt(index, matrixObject.matrix);

      instanceColor.set(selected ? lighten(color.hex, 0.08) : hovered ? lighten(color.hex, 0.14) : color.hex);
      mesh.setColorAt(index, instanceColor);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [colors, hoveredId, layouts, selectedId]);

  const handlePointerMove = React.useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (typeof event.instanceId === "number") {
      onHover(colors[event.instanceId]?.id ?? null);
      document.body.style.cursor = "pointer";
    }
  }, [colors, onHover]);

  const handlePointerOut = React.useCallback(() => {
    onHover(null);
    document.body.style.cursor = "";
  }, [onHover]);

  const handleClick = React.useCallback((event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (typeof event.instanceId === "number") {
      const color = colors[event.instanceId];
      if (color) {
        setDrop({id: Date.now(), colorId: color.id});
        onSelect(color.id);
      }
    }
  }, [colors, onSelect]);

  React.useEffect(() => () => {
    document.body.style.cursor = "";
  }, []);

  return (
    <group position={[0, -1.3, 2.8]} rotation={[0, 0, 0]}>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, colors.length]}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <cylinderGeometry args={[1, 1, 0.34, 64]} />
        <meshStandardMaterial roughness={0.62} metalness={0.02} />
      </instancedMesh>

      {selectedLayout && selectedColor && (
        <group position={[selectedLayout.position[0], selectedLayout.position[1] + 0.27, selectedLayout.position[2]]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} scale={selectedLayout.scale * 1.46}>
            <ringGeometry args={[0.82, 1.04, 96]} />
            <meshBasicMaterial color={lighten(selectedColor.hex, 0.24)} transparent opacity={0.72} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} scale={selectedLayout.scale * 1.8}>
            <ringGeometry args={[0.98, 1.02, 96]} />
            <meshBasicMaterial color="#fff7e6" transparent opacity={0.34} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {drop && dropLayout && dropColor && (
        <SpectrumDrop
          key={drop.id}
          color={dropColor}
          layout={dropLayout}
          onComplete={() => setDrop((current) => current?.id === drop.id ? null : current)}
        />
      )}
    </group>
  );
};
