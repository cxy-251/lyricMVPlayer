import {Pause, Play, RotateCcw} from 'lucide-react';
import {useControls} from 'leva';
import {useMemo, useRef, useState} from 'react';

import {discreteFourierTransform, selectFourierCoefficients} from './fourier';
import {
  CLOSED_PATH_CHOICES,
  CLOSED_PATHS,
  sampleClosedPolyline,
  type ClosedPathId,
} from './pathSampling';
import type {FourierSortMode} from './types';
import {useFourierAnimation} from './useFourierAnimation';

const SAMPLE_COUNT = 512;
const MAX_TERMS = 121;

const DEMO_STYLES = `
  .fourier-star-demo {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 100dvh;
    overflow: hidden;
    background: #56615e;
    color: #f5f1eb;
  }

  .fourier-star-canvas {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 100dvh;
    touch-action: manipulation;
  }

  .fourier-star-toolbar {
    position: fixed;
    z-index: 12;
    left: 50%;
    bottom: 22px;
    display: flex;
    align-items: center;
    gap: 6px;
    transform: translateX(-50%);
    padding: 6px;
    border: 1px solid rgba(54, 45, 48, 0.18);
    border-radius: 7px;
    background: rgba(248, 247, 244, 0.9);
    box-shadow: 0 12px 30px rgba(61, 49, 52, 0.1);
    backdrop-filter: blur(10px);
  }

  .fourier-star-shapes {
    position: fixed;
    z-index: 12;
    left: 50%;
    bottom: 72px;
    display: flex;
    align-items: center;
    gap: 4px;
    width: max-content;
    max-width: calc(100vw - 24px);
    overflow-x: auto;
    transform: translateX(-50%);
    padding: 5px;
    border: 1px solid rgba(54, 45, 48, 0.18);
    border-radius: 7px;
    background: rgba(248, 247, 244, 0.9);
    box-shadow: 0 12px 30px rgba(35, 29, 31, 0.14);
    backdrop-filter: blur(10px);
    scrollbar-width: none;
  }

  .fourier-star-shapes::-webkit-scrollbar {
    display: none;
  }

  .fourier-star-shape {
    flex: 0 0 auto;
    min-height: 30px;
    padding: 0 9px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: #5c5355;
    font: inherit;
    font-size: 0.68rem;
    font-weight: 720;
    cursor: pointer;
  }

  .fourier-star-shape:hover {
    border-color: rgba(65, 48, 58, 0.2);
    color: #31272d;
  }

  .fourier-star-shape[aria-pressed='true'] {
    border-color: #30262d;
    background: #30262d;
    color: #fffaf2;
  }

  .fourier-star-shape:focus-visible {
    outline: 2px solid #ff695e;
    outline-offset: 1px;
  }

  .fourier-star-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid rgba(54, 45, 48, 0.15);
    border-radius: 5px;
    background: #fff;
    color: #3d3538;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 720;
    cursor: pointer;
  }

  .fourier-star-action:hover {
    border-color: rgba(177, 50, 48, 0.45);
    color: #a82f2e;
  }

  .fourier-star-action:focus-visible {
    outline: 2px solid #ba3d39;
    outline-offset: 2px;
  }

  .fourier-star-formula,
  .fourier-star-inspector {
    position: fixed;
    z-index: 10;
    bottom: 20px;
    color: rgba(250, 247, 241, 0.7);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.66rem;
    line-height: 1.55;
    pointer-events: none;
  }

  .fourier-star-formula {
    left: 18px;
  }

  .fourier-star-formula strong {
    display: block;
    color: #fffaf2;
    font-size: 0.72rem;
    font-weight: 760;
  }

  .fourier-star-inspector {
    right: 18px;
    min-width: 188px;
    padding: 9px 11px;
    border: 1px solid rgba(54, 45, 48, 0.14);
    border-radius: 6px;
    background: rgba(248, 247, 244, 0.88);
    box-shadow: 0 10px 24px rgba(61, 49, 52, 0.08);
    backdrop-filter: blur(8px);
  }

  .fourier-star-inspector strong {
    color: #b23936;
    font-weight: 780;
  }

  .fourier-star-inspector span {
    display: block;
  }

  @media (max-width: 720px) {
    .fourier-star-toolbar {
      bottom: 14px;
    }

    .fourier-star-formula {
      top: 72px;
      bottom: auto;
    }

    .fourier-star-formula span {
      display: none;
    }

    .fourier-star-inspector {
      right: 12px;
      bottom: 112px;
      min-width: 164px;
    }

    .fourier-star-shapes {
      bottom: 62px;
    }
  }
`;

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
);

export default function Demo061FourierEpicycleStar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const [restartToken, setRestartToken] = useState(0);
  const [shape, setShape] = useState<ClosedPathId>('pentagram');
  const controls = useControls('Fourier Reconstruction', {
    fourierTerms: {
      label: 'Fourier Terms',
      value: 41,
      min: 3,
      max: MAX_TERMS,
      step: 2,
    },
    speed: {
      label: 'Speed',
      value: 0.1,
      min: 0.02,
      max: 0.3,
      step: 0.01,
    },
    trailLength: {
      label: 'Trail Length',
      value: 100,
      min: 10,
      max: 100,
      step: 5,
    },
    showCircles: {label: 'Show Circles', value: true},
    showVectors: {label: 'Show Vectors', value: true},
    showTarget: {label: 'Show Target', value: true},
    sortMode: {
      label: 'Sort Mode',
      value: 'amplitude',
      options: {Amplitude: 'amplitude', Frequency: 'frequency'},
    },
    inspectComponent: {label: 'Inspect Component', value: false},
    componentIndex: {
      label: 'Component',
      value: 1,
      min: 1,
      max: MAX_TERMS,
      step: 1,
    },
  });

  const targetPath = useMemo(() => CLOSED_PATHS[shape](), [shape]);
  const shapeLabel = CLOSED_PATH_CHOICES.find((choice) => choice.id === shape)?.label ?? shape;
  const samples = useMemo(
    () => sampleClosedPolyline(targetPath, SAMPLE_COUNT),
    [targetPath],
  );
  const allCoefficients = useMemo(
    () => discreteFourierTransform(samples),
    [samples],
  );
  const fourierTerms = clamp(Math.round(controls.fourierTerms), 3, MAX_TERMS);
  const speed = clamp(controls.speed, 0.02, 0.3);
  const trailLength = clamp(controls.trailLength, 10, 100);
  const sortMode = controls.sortMode as FourierSortMode;
  const coefficients = useMemo(
    () => selectFourierCoefficients(allCoefficients, fourierTerms, sortMode),
    [allCoefficients, fourierTerms, sortMode],
  );
  const inspectedIndex = controls.inspectComponent
    ? clamp(Math.round(controls.componentIndex), 1, coefficients.length) - 1
    : null;
  const inspectedCoefficient = inspectedIndex === null
    ? null
    : coefficients[inspectedIndex];

  useFourierAnimation(canvasRef, {
    coefficients,
    restartToken,
    targetPath,
    options: {
      inspectedIndex,
      paused,
      showCircles: controls.showCircles,
      showTarget: controls.showTarget,
      showVectors: controls.showVectors,
      speed,
      trailLength,
    },
  });

  return (
    <div className="fourier-star-demo">
      <style>{DEMO_STYLES}</style>
      <canvas
        aria-label={`A Fourier epicycle chain reconstructing a ${shape}`}
        className="fourier-star-canvas"
        ref={canvasRef}
      />

      <div className="fourier-star-formula" aria-hidden="true">
        <strong>z(t) = sum c_k exp(i k tau t)</strong>
        <span>{shapeLabel} / {SAMPLE_COUNT} equal-arc samples / {fourierTerms} active terms</span>
      </div>

      {inspectedCoefficient ? (
        <output className="fourier-star-inspector" aria-live="polite">
          <strong>Component {inspectedIndex! + 1}</strong>
          <span>frequency: {inspectedCoefficient.frequency}</span>
          <span>amplitude: {inspectedCoefficient.amplitude.toFixed(5)}</span>
          <span>phase: {(inspectedCoefficient.phase * 180 / Math.PI).toFixed(1)} deg</span>
          <span>re: {inspectedCoefficient.re.toFixed(5)}</span>
          <span>im: {inspectedCoefficient.im.toFixed(5)}</span>
        </output>
      ) : null}

      <div className="fourier-star-shapes" role="toolbar" aria-label="Target curve">
        {CLOSED_PATH_CHOICES.map((choice) => (
          <button
            aria-pressed={choice.id === shape}
            className="fourier-star-shape"
            key={choice.id}
            onClick={() => setShape(choice.id)}
            type="button"
          >
            {choice.label}
          </button>
        ))}
      </div>

      <div className="fourier-star-toolbar" role="toolbar" aria-label="Fourier animation controls">
        <button
          aria-label={paused ? 'Resume Fourier animation' : 'Pause Fourier animation'}
          className="fourier-star-action"
          onClick={() => setPaused((current) => !current)}
          type="button"
        >
          {paused ? <Play size={15} /> : <Pause size={15} />}
          <span>{paused ? 'Resume' : 'Pause'}</span>
        </button>
        <button
          aria-label="Restart Fourier reconstruction"
          className="fourier-star-action"
          onClick={() => setRestartToken((token) => token + 1)}
          type="button"
        >
          <RotateCcw size={15} />
          <span>Restart</span>
        </button>
      </div>
    </div>
  );
}
