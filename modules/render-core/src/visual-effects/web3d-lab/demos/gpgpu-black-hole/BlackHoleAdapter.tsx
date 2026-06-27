import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { BlackHoleCore, BlackHoleConfig } from './BlackHoleCore';

export function BlackHoleAdapter({ config }: { config: BlackHoleConfig }) {
  const { gl, scene: r3fScene, camera: r3fCamera, size, viewport } = useThree();
  const coreRef = useRef<BlackHoleCore | null>(null);
  const configRef = useRef(config);

  // 同步最新的 Config
  useEffect(() => {
    configRef.current = config;
    if (coreRef.current) {
      coreRef.current.setConfig(config);
    }
  }, [config]);

  // 挂载核心层（兼容 Strict Mode 的挂载/卸载规范）
  useEffect(() => {
    const core = new BlackHoleCore();
    core.setRenderer(gl, 42); // 固定种子
    core.setConfig(configRef.current);
    core.resize(size.width, size.height, viewport.dpr);

    const coreScene = core.getScene();
    r3fScene.add(coreScene);
    coreRef.current = core;

    return () => {
      r3fScene.remove(coreScene);
      core.dispose();
      coreRef.current = null;
    };
  }, [gl, r3fScene, size, viewport.dpr]);

  // 驱动逐帧渲染
  useFrame((state, delta) => {
    if (!coreRef.current) return;

    coreRef.current.renderFrame({
      frame: state.clock.getElapsedTime() * 60,
      fps: 60,
      time: state.clock.getElapsedTime(),
      delta: delta,
      width: size.width,
      height: size.height,
      pixelRatio: viewport.dpr,
      seed: 42,
      input: {
        pointer: { x: state.pointer.x, y: state.pointer.y, z: 0 },
        clicks: 0
      }
    });

    // 完美同步相机的投影矩阵与位姿
    const coreCam = coreRef.current.getCamera();
    if (coreCam instanceof THREE.PerspectiveCamera && r3fCamera instanceof THREE.PerspectiveCamera) {
      coreCam.copy(r3fCamera);
    }
  });

  return null;
}
