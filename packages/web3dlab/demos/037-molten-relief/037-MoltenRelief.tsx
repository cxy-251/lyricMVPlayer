import {useFrame} from '@react-three/fiber';
import {button, folder, useControls} from 'leva';
import {useEffect, useMemo, useRef, useState} from 'react';
import type {MutableRefObject} from 'react';
import * as THREE from 'three';

import {DemoScene} from '../../core/DemoScene';
import {
  DEFAULT_MOLTEN_PRESET,
  MOLTEN_PRESETS,
  QUALITY_LEVELS,
} from './moltenReliefPresets';
import type {
  MoltenPresetName,
  MoltenReliefControls,
} from './moltenReliefPresets';
import {moltenReliefFragmentShader, moltenReliefVertexShader} from './moltenReliefShader';

const ROOT_STYLES = `
  .molten-relief-root {
    position: relative;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    background: #120103;
    cursor: grab;
    touch-action: none;
  }

  .molten-relief-root[data-dragging="true"] {
    cursor: grabbing;
  }

  .molten-relief-root > .demo-viewport {
    position: absolute;
    inset: 0;
  }

  .molten-relief-caption {
    position: absolute;
    z-index: 4;
    left: 18px;
    bottom: 16px;
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding-left: 10px;
    border-left: 1px solid rgba(255, 175, 74, 0.5);
    color: rgba(255, 220, 172, 0.74);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.62rem;
    line-height: 1.4;
    pointer-events: none;
  }

  .molten-relief-caption strong {
    color: #ffd88c;
    font-size: 0.68rem;
    letter-spacing: 0.06em;
  }

  .molten-relief-caption span {
    color: rgba(145, 203, 222, 0.58);
  }

  @media (max-width: 640px) {
    .molten-relief-caption {
      left: 10px;
      bottom: 10px;
    }

    .molten-relief-caption span {
      display: none;
    }
  }
`;

function MoltenReliefSurface({
  controls,
  lightOffsetRef,
  seed,
}: {
  controls: MoltenReliefControls;
  lightOffsetRef: MutableRefObject<number>;
  seed: number;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const elapsedTime = useRef(0);
  const uniforms = useMemo(() => ({
    uBlueRimStrength: {value: controls.blueRimStrength},
    uCellularDistortion: {value: controls.cellularDistortion},
    uCellularScale: {value: controls.cellularScale},
    uCrystalStrength: {value: controls.crystalStrength},
    uErosionStrength: {value: controls.erosionStrength},
    uHeatIntensity: {value: controls.heatIntensity},
    uLayerScale: {value: controls.layerScale},
    uLightAngle: {value: controls.lightAngle},
    uNormalStrength: {value: controls.normalStrength},
    uQuality: {value: QUALITY_LEVELS[controls.quality]},
    uReliefStrength: {value: controls.reliefStrength},
    uResolution: {value: new THREE.Vector2(1, 1)},
    uSeed: {value: seed},
    uSymmetryStrength: {value: controls.symmetryStrength},
    uTime: {value: 0},
  }), []);

  useFrame((state, rawDelta) => {
    const material = materialRef.current;
    if (!material) return;

    if (!controls.pause) {
      elapsedTime.current += Math.min(rawDelta, 0.05) * controls.animationSpeed;
    }

    const pixelRatio = state.gl.getPixelRatio();
    material.uniforms.uTime.value = elapsedTime.current;
    material.uniforms.uResolution.value.set(
      state.size.width * pixelRatio,
      state.size.height * pixelRatio,
    );
    material.uniforms.uReliefStrength.value = controls.reliefStrength;
    material.uniforms.uNormalStrength.value = controls.normalStrength;
    material.uniforms.uCellularScale.value = controls.cellularScale;
    material.uniforms.uCellularDistortion.value = controls.cellularDistortion;
    material.uniforms.uLayerScale.value = controls.layerScale;
    material.uniforms.uCrystalStrength.value = controls.crystalStrength;
    material.uniforms.uSymmetryStrength.value = controls.symmetryStrength;
    material.uniforms.uErosionStrength.value = controls.erosionStrength;
    material.uniforms.uHeatIntensity.value = controls.heatIntensity;
    material.uniforms.uBlueRimStrength.value = controls.blueRimStrength;
    material.uniforms.uLightAngle.value = controls.lightAngle + lightOffsetRef.current;
    material.uniforms.uQuality.value = QUALITY_LEVELS[controls.quality];
    material.uniforms.uSeed.value = seed;
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        depthTest={false}
        depthWrite={false}
        fragmentShader={moltenReliefFragmentShader}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={moltenReliefVertexShader}
      />
    </mesh>
  );
}

function presetValues(name: MoltenPresetName) {
  return {...MOLTEN_PRESETS[name]};
}

export default function Demo037MoltenRelief() {
  const actionRef = useRef<{randomize: () => void; reset: () => void}>({
    randomize: () => undefined,
    reset: () => undefined,
  });
  const [seed, setSeed] = useState(37037);
  const [dragging, setDragging] = useState(false);
  const lightOffsetRef = useRef(0);
  const dragStartRef = useRef({light: 0, x: 0});
  const initial = MOLTEN_PRESETS[DEFAULT_MOLTEN_PRESET];

  const [rawControls, setControls] = useControls('Molten Relief', () => ({
    Experiment: folder({
      preset: {
        label: 'Preset',
        options: Object.keys(MOLTEN_PRESETS),
        value: DEFAULT_MOLTEN_PRESET,
      },
      quality: {
        label: 'Quality',
        options: ['Low', 'Medium', 'High'],
        value: 'Medium',
      },
    }),
    Motion: folder({
      animationSpeed: {label: 'Animation Speed', value: initial.animationSpeed, min: 0, max: 0.45, step: 0.01},
      cellularDistortion: {label: 'Cell Distortion', value: initial.cellularDistortion, min: 0.1, max: 1.25, step: 0.01},
      erosionStrength: {label: 'Erosion', value: initial.erosionStrength, min: 0, max: 1, step: 0.01},
      pause: {label: 'Pause', value: false},
    }, {collapsed: true}),
    Structure: folder({
      reliefStrength: {label: 'Relief', value: initial.reliefStrength, min: 0.65, max: 2.1, step: 0.01},
      normalStrength: {label: 'Normal Depth', value: initial.normalStrength, min: 3, max: 11, step: 0.1},
      cellularScale: {label: 'Cell Scale', value: initial.cellularScale, min: 2.8, max: 7.2, step: 0.1},
      layerScale: {label: 'Strata Scale', value: initial.layerScale, min: 1.5, max: 6.5, step: 0.1},
      crystalStrength: {label: 'Crystal Bloom', value: initial.crystalStrength, min: 0, max: 1.2, step: 0.01},
      symmetryStrength: {label: 'Symmetry', value: initial.symmetryStrength, min: 0, max: 0.72, step: 0.01},
    }, {collapsed: true}),
    Light: folder({
      heatIntensity: {label: 'Heat', value: initial.heatIntensity, min: 0.65, max: 1.55, step: 0.01},
      blueRimStrength: {label: 'Blue Rim', value: initial.blueRimStrength, min: 0, max: 1.25, step: 0.01},
      bloomStrength: {label: 'Bloom', value: initial.bloomStrength, min: 0.15, max: 0.9, step: 0.01},
      bloomRadius: {label: 'Bloom Radius', value: initial.bloomRadius, min: 0.12, max: 0.72, step: 0.01},
      lightAngle: {label: 'Light Angle', value: initial.lightAngle, min: 0, max: Math.PI * 2, step: 0.01},
    }, {collapsed: true}),
    Actions: folder({
      randomizeSeed: button(() => actionRef.current.randomize()),
      resetPreset: button(() => actionRef.current.reset()),
    }, {collapsed: true}),
  }));

  const controls = rawControls as unknown as MoltenReliefControls;
  const previousPresetRef = useRef(controls.preset);

  useEffect(() => {
    if (controls.preset === previousPresetRef.current) return;
    previousPresetRef.current = controls.preset;
    setControls(presetValues(controls.preset));
  }, [controls.preset, setControls]);

  useEffect(() => {
    actionRef.current = {
      randomize: () => setSeed(Math.floor(Math.random() * 900000) + 10000),
      reset: () => {
        previousPresetRef.current = DEFAULT_MOLTEN_PRESET;
        lightOffsetRef.current = 0;
        setSeed(37037);
        setControls({
          pause: false,
          preset: DEFAULT_MOLTEN_PRESET,
          quality: 'Medium',
          ...presetValues(DEFAULT_MOLTEN_PRESET),
        });
      },
    };
  }, [setControls]);

  return (
    <div
      className="molten-relief-root"
      data-dragging={dragging}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStartRef.current = {light: lightOffsetRef.current, x: event.clientX};
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (!dragging) return;
        const width = Math.max(1, event.currentTarget.clientWidth);
        lightOffsetRef.current = THREE.MathUtils.clamp(
          dragStartRef.current.light + (event.clientX - dragStartRef.current.x) / width * Math.PI * 2,
          -Math.PI * 2,
          Math.PI * 2,
        );
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        setDragging(false);
      }}
    >
      <style>{ROOT_STYLES}</style>
      <DemoScene
        engineConfig={{
          background: '#120103',
          bloom: {
            intensity: controls.bloomStrength,
            luminanceSmoothing: 0.38,
            luminanceThreshold: 0.84,
            radius: controls.bloomRadius,
          },
          camera: {position: [0, 0, 1], fov: 45, near: 0.01, far: 4},
          vignette: {darkness: 0.36, offset: 0.18},
        }}
        orbitControls={false}
      >
        <MoltenReliefSurface controls={controls} lightOffsetRef={lightOffsetRef} seed={seed} />
      </DemoScene>
      <div className="molten-relief-caption">
        <strong>MOLTEN RELIEF</strong>
        <span>{controls.preset} · procedural height field</span>
      </div>
    </div>
  );
}
