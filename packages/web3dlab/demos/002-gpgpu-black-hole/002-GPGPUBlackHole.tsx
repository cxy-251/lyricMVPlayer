import { useControls } from 'leva';
import { DemoScene } from '../../core/DemoScene';
import { BlackHoleAdapter } from './BlackHoleAdapter';

function BlackHoleScene({ config }: { config: any }) {
  return (
    <DemoScene
      engineConfig={{
        background: '#010005',
        camera: { fov: 48, far: 100, near: 0.1, position: [0, 7, 16] },
        bloom: { intensity: config.bloomIntensity, luminanceThreshold: 0.34, luminanceSmoothing: 0.55 }
      }}
      orbitConfig={{
        enablePan: true,
        autoRotate: false,
      }}
    >
      <BlackHoleAdapter config={config} />
    </DemoScene>
  );
}

/**
 * 实验界面层 (Experiment UI)
 * 只负责 UI 控件与路由，核心图形学逻辑已下推至 BlackHoleCore。
 */
export default function Demo002GPGPUBlackHole() {
  const physicsControls = useControls('GPGPU Accretion Disk', {
    gravity: { value: 18.0, min: 2.0, max: 48.0, step: 0.5 },
    friction: { value: 0.985, min: 0.94, max: 0.998, step: 0.001 },
    turbulence: { value: 0.7, min: 0.0, max: 4.0, step: 0.05 },
    feedRate: { value: 0.0014, min: 0.0, max: 0.006, step: 0.0001 },
    particleSize: { value: 2.1, min: 0.8, max: 4.0, step: 0.1 },
    horizonGlow: { value: 0.95, min: 0.0, max: 2.4, step: 0.05 },
    bloomIntensity: { value: 2.1, min: 0.4, max: 4.0, step: 0.1 },
    colorCore: '#ffbc66',
    colorOuter: '#3d7dff',
  });

  return <BlackHoleScene config={physicsControls} />;
}
