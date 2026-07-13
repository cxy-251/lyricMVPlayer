import {ChevronsRight, Pause, Play, RefreshCcw, RotateCcw} from 'lucide-react';
import {useControls} from 'leva';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {CURVE_DEFINITIONS, normalizeCurveParameters} from './curveDefinitions';
import {CurveLegend} from './CurveLegend';
import {sampleCurveScene} from './curveSampling';
import type {CurveDefinition, CurveParameters} from './types';
import {useCurveAnimation} from './useCurveAnimation';

const DEMO_STYLES = `
  .curve-museum-demo {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 100dvh;
    overflow: hidden;
    background: #eee9df;
    color: #39322f;
  }

  .curve-museum-canvas {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 100dvh;
  }

  .demo-page:has(.curve-museum-demo) .demo-back-link,
  .demo-page:has(.curve-museum-demo) .demo-info-toggle,
  .demo-page:has(.curve-museum-demo) .demo-sequence-button {
    border-color: rgba(63, 54, 50, 0.18);
    background: rgba(255, 253, 248, 0.92);
    color: #413936;
  }

  .demo-page:has(.curve-museum-demo) .demo-sequence-button:disabled {
    color: rgba(65, 57, 54, 0.45);
  }

  .demo-page:has(.curve-museum-demo) .demo-hud {
    border-color: rgba(63, 54, 50, 0.16);
    background: rgba(255, 253, 248, 0.94);
    color: #413936;
  }

  .demo-page:has(.curve-museum-demo) .demo-kicker,
  .demo-page:has(.curve-museum-demo) .demo-description,
  .demo-page:has(.curve-museum-demo) .demo-instructions li {
    color: rgba(65, 57, 54, 0.68);
  }

  .curve-museum-heading {
    position: fixed;
    z-index: 10;
    left: 50%;
    top: 20px;
    transform: translateX(-50%);
    width: min(430px, calc(100vw - 760px));
    min-width: 280px;
    text-align: center;
    pointer-events: none;
  }

  .curve-museum-heading p,
  .curve-museum-heading h2 {
    margin: 0;
  }

  .curve-museum-heading p:first-child {
    color: rgba(60, 52, 49, 0.52);
    font-size: 0.62rem;
    font-weight: 780;
    text-transform: uppercase;
  }

  .curve-museum-heading h2 {
    margin-top: 4px;
    color: #352e2c;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.55rem;
    font-weight: 500;
  }

  .curve-museum-equation {
    margin-top: 5px !important;
    color: rgba(60, 52, 49, 0.68);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.68rem;
  }

  .curve-museum-category {
    margin-top: 4px !important;
    color: rgba(60, 52, 49, 0.45);
    font-size: 0.58rem;
    font-weight: 740;
    text-transform: uppercase;
  }

  .curve-museum-player {
    position: fixed;
    z-index: 13;
    left: 50%;
    bottom: 112px;
    display: flex;
    align-items: center;
    gap: 6px;
    transform: translateX(-50%);
    width: min(680px, calc(100vw - 32px));
    padding: 6px;
    border: 1px solid rgba(63, 54, 50, 0.17);
    border-radius: 7px;
    background: #faf7f0;
  }

  .curve-museum-action {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 34px;
    padding: 0 10px;
    border: 1px solid rgba(63, 54, 50, 0.14);
    border-radius: 5px;
    background: transparent;
    color: #4b413e;
    font: inherit;
    font-size: 0.67rem;
    font-weight: 730;
    cursor: pointer;
  }

  .curve-museum-action:hover,
  .curve-museum-action[aria-pressed='true'] {
    border-color: #403735;
    background: #403735;
    color: #fffaf2;
  }

  .curve-museum-action:focus-visible,
  .curve-museum-legend-item:focus-visible {
    outline: 2px solid #c64835;
    outline-offset: 2px;
  }

  .curve-museum-progress {
    flex: 1 1 auto;
    min-width: 110px;
    height: 3px;
    cursor: ew-resize;
  }

  .curve-museum-progress-value {
    flex: 0 0 34px;
    color: rgba(60, 52, 49, 0.6);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.62rem;
    text-align: right;
  }

  .curve-museum-legend {
    position: fixed;
    z-index: 12;
    left: 12px;
    right: 12px;
    bottom: 10px;
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding: 5px;
    border-top: 1px solid rgba(63, 54, 50, 0.16);
    background: rgba(238, 233, 223, 0.96);
    scrollbar-width: none;
  }

  .curve-museum-legend::-webkit-scrollbar {
    display: none;
  }

  .curve-museum-legend-item {
    display: grid;
    flex: 1 0 76px;
    grid-template-columns: 16px 1fr;
    grid-template-rows: 40px 16px;
    min-width: 76px;
    max-width: 112px;
    padding: 3px 5px 2px;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 3px;
    background: transparent;
    color: rgba(65, 57, 54, 0.24);
    text-align: left;
    cursor: pointer;
  }

  .curve-museum-legend-item[data-visited='true'] {
    color: rgba(65, 57, 54, 0.66);
  }

  .curve-museum-legend-item[aria-pressed='true'] {
    border-bottom-color: currentColor;
    color: #352e2c;
    background: rgba(255, 253, 248, 0.62);
  }

  .curve-museum-legend-item svg {
    grid-column: 1 / -1;
    width: 100%;
    height: 40px;
    overflow: visible;
  }

  .curve-museum-legend-item path {
    stroke-width: 1.35;
  }

  .curve-museum-legend-item span {
    color: rgba(65, 57, 54, 0.38);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.56rem;
  }

  .curve-museum-legend-item strong {
    overflow: hidden;
    font-size: 0.59rem;
    font-weight: 740;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 900px) {
    .curve-museum-heading {
      top: 72px;
      width: min(430px, calc(100vw - 24px));
    }

    .curve-museum-heading h2 {
      font-size: 1.25rem;
    }
  }

  @media (max-width: 680px) {
    .curve-museum-player {
      bottom: 106px;
      width: calc(100vw - 20px);
    }

    .curve-museum-action {
      width: 34px;
      padding: 0;
    }

    .curve-museum-action span {
      display: none;
    }

    .curve-museum-legend {
      left: 6px;
      right: 6px;
      bottom: 6px;
    }
  }
`;

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
);

const categoryLabel = (definition: CurveDefinition) => {
  if (definition.parameterMode === 'rolling-inside') return 'Rolling circle / inside';
  if (definition.parameterMode === 'rolling-outside') return 'Rolling circle / outside';
  if (definition.parameterMode === 'fourier') return 'Discrete Fourier reconstruction';
  return definition.category === 'fourier' ? 'Counter-rotating vectors' : 'Circular motion';
};

export default function Demo062EveryCurveCircle() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [restartToken, setRestartToken] = useState(0);
  const [seekRequest, setSeekRequest] = useState({token: 0, value: 0});
  const [visitedIds, setVisitedIds] = useState(() => new Set([CURVE_DEFINITIONS[0].id]));
  const activeDefinition = CURVE_DEFINITIONS[activeIndex];
  const rollingMode = activeDefinition.parameterMode.startsWith('rolling');
  const fourierMode = activeDefinition.parameterMode === 'fourier';
  const [controls, setControls] = useControls('Curve Construction', () => ({
    fixedRadius: {
      label: 'Fixed Radius R',
      value: activeDefinition.defaultParameters.R,
      min: 0.5,
      max: 6,
      step: 0.5,
      render: () => rollingMode,
    },
    rollingRadius: {
      label: 'Rolling Radius r',
      value: activeDefinition.defaultParameters.r,
      min: 0.5,
      max: 3,
      step: 0.5,
      render: () => rollingMode,
    },
    tracingDistance: {
      label: 'Tracing Distance d',
      value: activeDefinition.defaultParameters.d,
      min: 0,
      max: 4,
      step: 0.1,
      render: () => rollingMode,
    },
    epicycles: {
      label: 'Epicycle Count',
      value: activeDefinition.defaultParameters.epicycles,
      min: 3,
      max: 81,
      step: 2,
      render: () => fourierMode,
    },
    speed: {label: 'Speed', value: 1, min: 0.25, max: 2, step: 0.05},
    showGuides: {label: 'Show Circles', value: true},
    showEquation: {label: 'Show Equation', value: true},
    fullTrajectory: {label: 'Full Trajectory', value: false},
    autoAdvance: {label: 'Auto Advance', value: true},
  }), [activeDefinition.id]);

  const rawParameters = useMemo<CurveParameters>(() => ({
    R: controls.fixedRadius,
    r: controls.rollingRadius,
    d: controls.tracingDistance,
    epicycles: controls.epicycles,
  }), [
    controls.epicycles,
    controls.fixedRadius,
    controls.rollingRadius,
    controls.tracingDistance,
  ]);
  const parameters = useMemo(
    () => normalizeCurveParameters(activeDefinition, rawParameters),
    [activeDefinition, rawParameters],
  );
  const scene = useMemo(
    () => sampleCurveScene(activeDefinition, parameters),
    [activeDefinition, parameters],
  );
  const speed = clamp(controls.speed, 0.25, 2);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const applyRecommendedParameters = useCallback((definition: CurveDefinition) => {
    setControls({
      fixedRadius: definition.defaultParameters.R,
      rollingRadius: definition.defaultParameters.r,
      tracingDistance: definition.defaultParameters.d,
      epicycles: definition.defaultParameters.epicycles,
    });
  }, [setControls]);

  const selectCurve = useCallback((definition: CurveDefinition) => {
    clearAdvanceTimer();
    const nextIndex = CURVE_DEFINITIONS.findIndex((candidate) => candidate.id === definition.id);
    if (nextIndex < 0) return;
    setActiveIndex(nextIndex);
    setVisitedIds((current) => new Set(current).add(definition.id));
    setPaused(false);
    setProgress(0);
    applyRecommendedParameters(definition);
    setRestartToken((token) => token + 1);
  }, [applyRecommendedParameters, clearAdvanceTimer]);

  const handleComplete = useCallback(() => {
    setVisitedIds((current) => new Set(current).add(activeDefinition.id));
    if (!controls.autoAdvance) return;
    clearAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      const nextDefinition = CURVE_DEFINITIONS[(activeIndex + 1) % CURVE_DEFINITIONS.length];
      selectCurve(nextDefinition);
    }, 520);
  }, [
    activeDefinition.id,
    activeIndex,
    clearAdvanceTimer,
    controls.autoAdvance,
    selectCurve,
  ]);

  useEffect(() => () => clearAdvanceTimer(), [clearAdvanceTimer]);
  useEffect(() => {
    if (paused || !controls.autoAdvance) clearAdvanceTimer();
  }, [clearAdvanceTimer, controls.autoAdvance, paused]);

  useCurveAnimation(canvasRef, {
    definition: activeDefinition,
    fullTrajectory: controls.fullTrajectory,
    onComplete: handleComplete,
    onProgress: setProgress,
    parameters,
    paused,
    restartToken,
    scene,
    seekRequest,
    showGuides: controls.showGuides,
    speed,
  });

  const restart = () => {
    clearAdvanceTimer();
    setProgress(0);
    setRestartToken((token) => token + 1);
  };

  const resetRecommended = () => {
    clearAdvanceTimer();
    applyRecommendedParameters(activeDefinition);
    setProgress(0);
    setRestartToken((token) => token + 1);
  };

  return (
    <div className="curve-museum-demo">
      <style>{DEMO_STYLES}</style>
      <canvas
        aria-label={`${activeDefinition.name} circular-motion construction`}
        className="curve-museum-canvas"
        ref={canvasRef}
      />

      <header className="curve-museum-heading">
        <p>Every Curve Hiding Inside a Circle</p>
        <h2>{activeDefinition.name}</h2>
        {controls.showEquation ? (
          <p className="curve-museum-equation">{activeDefinition.equation}</p>
        ) : null}
        <p className="curve-museum-category">{categoryLabel(activeDefinition)}</p>
      </header>

      <div className="curve-museum-player" role="toolbar" aria-label="Curve playback">
        <button
          aria-label={paused ? 'Resume animation' : 'Pause animation'}
          className="curve-museum-action"
          onClick={() => setPaused((current) => !current)}
          title={paused ? 'Resume' : 'Pause'}
          type="button"
        >
          {paused ? <Play size={15} /> : <Pause size={15} />}
          <span>{paused ? 'Resume' : 'Pause'}</span>
        </button>
        <button
          aria-label="Restart current curve"
          className="curve-museum-action"
          onClick={restart}
          title="Restart"
          type="button"
        >
          <RotateCcw size={15} />
          <span>Restart</span>
        </button>
        <input
          aria-label="Animation progress"
          className="curve-museum-progress"
          max="1000"
          min="0"
          onChange={(event) => {
            clearAdvanceTimer();
            const value = Number(event.currentTarget.value) / 1000;
            setProgress(value);
            setSeekRequest((current) => ({token: current.token + 1, value}));
          }}
          style={{accentColor: activeDefinition.accent}}
          type="range"
          value={Math.round(progress * 1000)}
        />
        <span className="curve-museum-progress-value">{Math.round(progress * 100)}%</span>
        <button
          aria-label="Reset recommended curve parameters"
          className="curve-museum-action"
          onClick={resetRecommended}
          title="Recommended parameters"
          type="button"
        >
          <RefreshCcw size={15} />
          <span>Recommended</span>
        </button>
        <button
          aria-label="Toggle automatic chapter advance"
          aria-pressed={controls.autoAdvance}
          className="curve-museum-action"
          onClick={() => {
            if (controls.autoAdvance) clearAdvanceTimer();
            setControls({autoAdvance: !controls.autoAdvance});
          }}
          title="Auto advance"
          type="button"
        >
          <ChevronsRight size={15} />
          <span>Auto</span>
        </button>
      </div>

      <CurveLegend
        activeId={activeDefinition.id}
        definitions={CURVE_DEFINITIONS}
        onSelect={selectCurve}
        visitedIds={visitedIds}
      />
    </div>
  );
}
