import { useControls } from 'leva';
import { DemoScene } from '../../core/DemoScene';
import { BlackHoleAdapter } from './BlackHoleAdapter';

function BlackHoleScene({ debug, config }: { debug: boolean; config: any }) {
  return (
    <DemoScene
      debug={debug}
      engineConfig={{
        background: '#020104', // Very subtle deep space purple
        camera: { fov: 50, far: 100, near: 0.1, position: [0, 8, 20] }, 
        // Generous bloom to make the additive blending look magical
        bloom: { intensity: 1.5, luminanceThreshold: 0.8, luminanceSmoothing: 0.4 }
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
export default function GPGPUBlackHoleDemo() {
  const { showStats } = useControls('Debug', { showStats: false });
  const physicsControls = useControls('Black Hole Physics', {
    gravity: { value: 85.0, min: 0.0, max: 200.0, step: 1.0 },
    friction: { value: 0.99, min: 0.9, max: 1.0, step: 0.001 },
    colorCore: '#ff8822',
    colorOuter: '#2255ff',
  });

  return <BlackHoleScene debug={showStats} config={physicsControls} />;
}
