import {Html} from '@react-three/drei';
import {useFrame, useThree} from '@react-three/fiber';
import {useRef, useState} from 'react';

type StatsSnapshot = {
  dpr: number;
  frameMs: number;
  fps: number;
};

export function PerformanceStats({enabled}: {enabled: boolean}) {
  const gl = useThree((state) => state.gl);
  const frameCount = useRef(0);
  const frameTotal = useRef(0);
  const elapsedSinceUpdate = useRef(0);
  const [snapshot, setSnapshot] = useState<StatsSnapshot>({dpr: 1, frameMs: 0, fps: 0});

  useFrame((_, delta) => {
    if (!enabled) {
      return;
    }

    frameCount.current += 1;
    frameTotal.current += delta;
    elapsedSinceUpdate.current += delta;

    if (elapsedSinceUpdate.current >= 0.5) {
      const averageDelta = frameTotal.current / Math.max(frameCount.current, 1);
      setSnapshot({
        dpr: Number(gl.getPixelRatio().toFixed(2)),
        frameMs: Number((averageDelta * 1000).toFixed(1)),
        fps: Math.round(1 / Math.max(averageDelta, 0.001)),
      });
      frameCount.current = 0;
      frameTotal.current = 0;
      elapsedSinceUpdate.current = 0;
    }
  });

  if (!enabled) {
    return null;
  }

  return (
    <Html fullscreen prepend>
      <div className="performance-stats" aria-label="Performance stats">
        <span>{snapshot.fps} fps</span>
        <span>{snapshot.frameMs} ms</span>
        <span>{snapshot.dpr} dpr</span>
      </div>
    </Html>
  );
}
