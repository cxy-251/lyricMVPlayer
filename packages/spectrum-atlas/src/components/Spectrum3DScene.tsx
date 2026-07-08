import React from "react";
import {Canvas, useFrame, useThree} from "@react-three/fiber";
import {ContactShadows, OrbitControls} from "@react-three/drei";
import * as THREE from "three";

import type {SpectrumColor} from "../data/spectrum-colors";
import {darken, lighten} from "../utils/color-convert";
import {SpectrumDiscTerrain} from "./SpectrumDiscTerrain";

type Spectrum3DSceneProps = {
  colors: SpectrumColor[];
  selectedColor: SpectrumColor;
  resetSignal: number;
  onSelect: (id: string) => void;
};

type CameraResetterProps = {
  resetSignal: number;
  controlsRef: React.MutableRefObject<any>;
};

const resetCamera = (camera: THREE.Camera, controls: any) => {
  camera.position.set(0, 2.85, 18.4);
  camera.lookAt(0, -1.08, -6.6);
  if (controls) {
    controls.target.set(0, -1.08, -6.6);
    controls.update();
  }
};

const CameraResetter: React.FC<CameraResetterProps> = ({resetSignal, controlsRef}) => {
  const {camera} = useThree();

  React.useEffect(() => {
    resetCamera(camera, controlsRef.current);
  }, [camera, controlsRef, resetSignal]);

  return null;
};

const PointerViewRig: React.FC<React.PropsWithChildren> = ({children}) => {
  const groupRef = React.useRef<THREE.Group>(null);
  const {pointer} = useThree();

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const ease = 1 - Math.exp(-delta * 4.6);
    group.rotation.y += (pointer.x * 0.18 - group.rotation.y) * ease;
    group.rotation.x += (pointer.y * 0.055 - group.rotation.x) * ease;
    group.position.x += (pointer.x * 0.82 - group.position.x) * ease;
  });

  return <group ref={groupRef}>{children}</group>;
};

export const Spectrum3DScene: React.FC<Spectrum3DSceneProps> = ({
  colors,
  selectedColor,
  resetSignal,
  onSelect,
}) => {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const controlsRef = React.useRef<any>(null);
  const fogColor = React.useMemo(() => lighten(selectedColor.hex, 0.42), [selectedColor.hex]);

  return (
    <section className="spectrum-3d" aria-label="3D color terrain">
      <Canvas
        gl={{alpha: true, antialias: true}}
        dpr={[1, 1.7]}
        camera={{fov: 58, near: 0.1, far: 100, position: [0, 2.85, 18.4]}}
      >
        <CameraResetter resetSignal={resetSignal} controlsRef={controlsRef} />
        <fog attach="fog" args={[fogColor, 22, 58]} />
        <ambientLight intensity={1.24} />
        <directionalLight position={[-7, 12, 7]} intensity={2.1} color={lighten(selectedColor.hex, 0.65)} />
        <spotLight position={[0, 15, 8]} angle={0.46} penumbra={0.9} intensity={54} color={lighten(selectedColor.hex, 0.2)} />
        <pointLight position={[8, 4, -14]} intensity={5.5} color={darken(selectedColor.hex, 0.2)} />
        <PointerViewRig>
          <SpectrumDiscTerrain
            colors={colors}
            selectedId={selectedColor.id}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onSelect={onSelect}
          />
        </PointerViewRig>
        <ContactShadows position={[0, -1.51, -4]} opacity={0.28} scale={68} blur={2.8} far={22} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.06}
          enablePan
          enableZoom
          minDistance={12}
          maxDistance={32}
          minPolarAngle={1.38}
          maxPolarAngle={1.57}
          target={[0, -1.08, -6.6]}
        />
      </Canvas>
    </section>
  );
};
