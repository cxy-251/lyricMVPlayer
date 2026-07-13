import {ChevronsRight, Pause, Play, RotateCcw} from 'lucide-react';
import {useControls} from 'leva';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {discreteFourierTransform, selectFourierCoefficients} from './fourier';
import {
  CLOSED_PATH_CHOICES,
  CLOSED_PATHS,
  sampleClosedPolyline,
  type ClosedPathId,
} from './pathSampling';
import {ShapeChapterRail} from './ShapeChapterRail';
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

  .fourier-star-heading {
    position: fixed;
    z-index: 10;
    left: 50%;
    top: 18px;
    transform: translateX(-50%);
    width: min(430px, calc(100vw - 760px));
    min-width: 280px;
    text-align: center;
    pointer-events: none;
  }

  .fourier-star-heading p,
  .fourier-star-heading h2 {
    margin: 0;
  }

  .fourier-star-heading > p:first-child {
    color: rgba(250, 247, 241, 0.58);
    font-size: 0.62rem;
    font-weight: 780;
    text-transform: uppercase;
  }

  .fourier-star-heading h2 {
    margin-top: 4px;
    color: #fffaf2;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.5rem;
    font-weight: 500;
  }

  .fourier-star-equation {
    margin-top: 5px !important;
    color: rgba(250, 247, 241, 0.7);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.66rem;
  }

  .fourier-star-sample-count {
    margin-top: 3px !important;
    color: rgba(250, 247, 241, 0.46);
    font-size: 0.58rem;
    font-weight: 700;
  }

  .fourier-star-toolbar {
    position: fixed;
    z-index: 13;
    left: 50%;
    bottom: 106px;
    display: flex;
    align-items: center;
    gap: 6px;
    transform: translateX(-50%);
    width: min(650px, calc(100vw - 32px));
    padding: 6px;
    border: 1px solid rgba(54, 45, 48, 0.18);
    border-radius: 7px;
    background: rgba(248, 247, 244, 0.94);
    backdrop-filter: blur(10px);
  }

  .fourier-star-action {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 34px;
    padding: 0 11px;
    border: 1px solid rgba(54, 45, 48, 0.15);
    border-radius: 5px;
    background: transparent;
    color: #3d3538;
    font: inherit;
    font-size: 0.69rem;
    font-weight: 720;
    cursor: pointer;
  }

  .fourier-star-action:hover,
  .fourier-star-action[aria-pressed='true'] {
    border-color: #30262d;
    background: #30262d;
    color: #fffaf2;
  }

  .fourier-star-action:focus-visible,
  .fourier-star-legend-item:focus-visible {
    outline: 2px solid #ff695e;
    outline-offset: 2px;
  }

  .fourier-star-progress {
    flex: 1 1 auto;
    min-width: 110px;
    height: 3px;
    accent-color: #c34b46;
    cursor: ew-resize;
  }

  .fourier-star-progress-value {
    flex: 0 0 34px;
    color: rgba(55, 47, 50, 0.62);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.62rem;
    text-align: right;
  }

  .fourier-star-legend {
    position: fixed;
    z-index: 12;
    left: 50%;
    bottom: 8px;
    display: flex;
    gap: 4px;
    width: min(486px, calc(100vw - 20px));
    box-sizing: border-box;
    overflow-x: auto;
    padding: 5px;
    border-top: 1px solid rgba(250, 247, 241, 0.18);
    background: rgba(78, 90, 86, 0.96);
    overscroll-behavior-inline: contain;
    scroll-behavior: smooth;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    transform: translateX(-50%);
  }

  .fourier-star-legend::before,
  .fourier-star-legend::after {
    content: '';
    flex: 0 0 calc(40% - 6px);
  }

  .fourier-star-legend::-webkit-scrollbar {
    display: none;
  }

  .fourier-star-legend-item {
    display: grid;
    flex: 0 0 calc(20% - 3.2px);
    grid-template-columns: 17px 1fr;
    grid-template-rows: 42px 16px;
    min-width: 0;
    padding: 3px 5px 2px;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 3px;
    background: transparent;
    color: rgba(250, 247, 241, 0.24);
    text-align: left;
    cursor: pointer;
    scroll-snap-align: center;
  }

  .fourier-star-legend-item[data-visited='true'] {
    color: rgba(250, 247, 241, 0.68);
  }

  .fourier-star-legend-item[aria-pressed='true'] {
    border-bottom-color: #ff8a7f;
    color: #fffaf2;
    background: rgba(255, 255, 255, 0.07);
  }

  .fourier-star-legend-item svg {
    grid-column: 1 / -1;
    width: 100%;
    height: 42px;
    overflow: visible;
  }

  .fourier-star-legend-item path {
    stroke-width: 1.35;
  }

  .fourier-star-legend-item span {
    color: rgba(250, 247, 241, 0.38);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.56rem;
  }

  .fourier-star-legend-item strong {
    overflow: hidden;
    font-size: 0.59rem;
    font-weight: 740;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fourier-star-inspector {
    position: fixed;
    z-index: 10;
    right: 18px;
    bottom: 118px;
    min-width: 188px;
    padding: 9px 11px;
    border: 1px solid rgba(54, 45, 48, 0.14);
    border-radius: 6px;
    background: rgba(248, 247, 244, 0.9);
    color: #4f4548;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.66rem;
    line-height: 1.55;
    pointer-events: none;
  }

  .fourier-star-inspector strong {
    color: #b23936;
    font-weight: 780;
  }

  .fourier-star-inspector span {
    display: block;
  }

  @media (max-width: 900px) {
    .fourier-star-heading {
      top: 72px;
      width: min(430px, calc(100vw - 24px));
    }

    .fourier-star-heading h2 {
      font-size: 1.25rem;
    }
  }

  @media (max-width: 680px) {
    .fourier-star-toolbar {
      bottom: 102px;
      width: calc(100vw - 20px);
    }

    .fourier-star-action {
      width: 34px;
      padding: 0;
    }

    .fourier-star-action span {
      display: none;
    }

    .fourier-star-legend {
      bottom: 6px;
      width: calc(100vw - 12px);
    }

    .fourier-star-inspector {
      right: 12px;
      bottom: 154px;
      min-width: 164px;
    }
  }
`;

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
);

type ShapeChoice = (typeof CLOSED_PATH_CHOICES)[number];

export default function Demo061FourierEpicycleStar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [restartToken, setRestartToken] = useState(0);
  const [seekRequest, setSeekRequest] = useState({token: 0, value: 0});
  const [visitedIds, setVisitedIds] = useState<Set<ClosedPathId>>(
    () => new Set([CLOSED_PATH_CHOICES[0].id]),
  );
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

  const activeChoice = CLOSED_PATH_CHOICES[activeIndex];
  const shape = activeChoice.id;
  const targetPath = useMemo(() => CLOSED_PATHS[shape](), [shape]);
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

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const selectShape = useCallback((choice: ShapeChoice) => {
    clearAdvanceTimer();
    const nextIndex = CLOSED_PATH_CHOICES.findIndex((candidate) => candidate.id === choice.id);
    if (nextIndex < 0) return;
    setActiveIndex(nextIndex);
    setVisitedIds((current) => new Set(current).add(choice.id));
    setPaused(false);
    setProgress(0);
    setRestartToken((token) => token + 1);
  }, [clearAdvanceTimer]);

  const handleComplete = useCallback(() => {
    setVisitedIds((current) => new Set(current).add(shape));
    if (!autoAdvance) return;
    clearAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      selectShape(CLOSED_PATH_CHOICES[(activeIndex + 1) % CLOSED_PATH_CHOICES.length]);
    }, 480);
  }, [activeIndex, autoAdvance, clearAdvanceTimer, selectShape, shape]);

  useEffect(() => () => clearAdvanceTimer(), [clearAdvanceTimer]);
  useEffect(() => {
    if (paused || !autoAdvance) clearAdvanceTimer();
  }, [autoAdvance, clearAdvanceTimer, paused]);

  useFourierAnimation(canvasRef, {
    coefficients,
    onComplete: handleComplete,
    onProgress: setProgress,
    restartToken,
    seekRequest,
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

  const restart = () => {
    clearAdvanceTimer();
    setProgress(0);
    setRestartToken((token) => token + 1);
  };

  return (
    <div className="fourier-star-demo">
      <style>{DEMO_STYLES}</style>
      <canvas
        aria-label={`A Fourier epicycle chain reconstructing a ${shape}`}
        className="fourier-star-canvas"
        ref={canvasRef}
      />

      <header className="fourier-star-heading">
        <p>Fourier Epicycle Curves</p>
        <h2>{activeChoice.label}</h2>
        <p className="fourier-star-equation">z(t) = sum c_k exp(i k tau t)</p>
        <p className="fourier-star-sample-count">
          {SAMPLE_COUNT} equal-arc samples / {fourierTerms} active terms
        </p>
      </header>

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

      <div className="fourier-star-toolbar" role="toolbar" aria-label="Fourier playback">
        <button
          aria-label={paused ? 'Resume Fourier animation' : 'Pause Fourier animation'}
          className="fourier-star-action"
          onClick={() => setPaused((current) => !current)}
          title={paused ? 'Resume' : 'Pause'}
          type="button"
        >
          {paused ? <Play size={15} /> : <Pause size={15} />}
          <span>{paused ? 'Resume' : 'Pause'}</span>
        </button>
        <button
          aria-label="Restart Fourier reconstruction"
          className="fourier-star-action"
          onClick={restart}
          title="Restart"
          type="button"
        >
          <RotateCcw size={15} />
          <span>Restart</span>
        </button>
        <input
          aria-label="Fourier chapter progress"
          className="fourier-star-progress"
          max="1000"
          min="0"
          onChange={(event) => {
            clearAdvanceTimer();
            const value = Number(event.currentTarget.value) / 1000;
            setProgress(value);
            setSeekRequest((current) => ({token: current.token + 1, value}));
          }}
          type="range"
          value={Math.round(progress * 1000)}
        />
        <span className="fourier-star-progress-value">{Math.round(progress * 100)}%</span>
        <button
          aria-label="Toggle automatic Fourier chapter advance"
          aria-pressed={autoAdvance}
          className="fourier-star-action"
          onClick={() => {
            if (autoAdvance) clearAdvanceTimer();
            setAutoAdvance((current) => !current);
          }}
          title="Auto advance"
          type="button"
        >
          <ChevronsRight size={15} />
          <span>Auto</span>
        </button>
      </div>

      <ShapeChapterRail
        activeId={shape}
        choices={CLOSED_PATH_CHOICES}
        onSelect={selectShape}
        visitedIds={visitedIds}
      />
    </div>
  );
}
