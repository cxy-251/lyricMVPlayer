import React from "react";
import {EffectRuntimeAdapter, getTextMotionState} from "@paper-to-video/content-pipeline";
import type {VisualModuleConfig} from "@paper-to-video/shared-types";
import {
  formatSeconds,
  getEffectDefinition,
  getSceneLabel,
  PAPER_EDITOR_BASE_PATH,
  routeCollections,
} from "./App.service";
import type {
  EffectPreviewState,
  EffectRoute,
  EffectStageModel,
  PreviewStageProps,
  TemplatePreviewState,
  TemplateRoute,
  TemplateStageModel,
} from "./App.types";
import styles from "./App.module.css";
import {usePreviewSurfaceScale} from "./usePreviewSurfaceScale";

const cx = (...classNames: Array<string | false | null | undefined>) => classNames.filter(Boolean).join(" ");

const readControlValue = (
  modules: VisualModuleConfig | undefined,
  section: string,
  field: string,
) => {
  const sectionValue = modules?.[section as keyof VisualModuleConfig];
  if (!sectionValue || typeof sectionValue !== "object") {
    return "";
  }

  const value = (sectionValue as Record<string, unknown>)[field];
  return typeof value === "number" || typeof value === "string" ? value : "";
};

export const AppIndexView: React.FC<{
  navigate: (href: string) => void;
}> = ({navigate}) => {
  return (
    <div className={styles.indexShell}>
      <div className={styles.indexHero}>
        <div className={styles.eyebrow}>PaperToVideo</div>
        <h1>Preview Index</h1>
        <p>首页现在作为索引。模板组合页和 WebGL / effect 实验页已经拆成两个路径分区，后面继续加案例时可以按目录自然扩展。</p>
      </div>

      <section className={styles.indexSection}>
        <div className={styles.indexSectionHeader}>
          <span className={styles.eyebrow}>Templates</span>
          <h2>组合模板页</h2>
          <p>这里放完整的拼装结果，也就是背景、特效、文本和时间轴都已经组合好的版本。</p>
        </div>
        <div className={styles.indexGrid}>
          {routeCollections.templateRoutes.map((route) => (
            <button key={route.id} className={styles.indexCard} onClick={() => navigate(route.href)} type="button">
              <span className={styles.indexCardPath}>{route.href}</span>
              <strong>{route.title}</strong>
              <span>{route.description}</span>
              <span className={styles.indexCardCta}>Open template</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.indexSection}>
        <div className={styles.indexSectionHeader}>
          <span className={styles.eyebrow}>Effects</span>
          <h2>单独特效实验页</h2>
          <p>这里单独看 WebGL / effect 层，避免每次都通过完整模板链路才能判断特效效果。</p>
        </div>
        <div className={styles.indexGrid}>
          {routeCollections.effectRoutes.map((route) => (
            <button key={route.id} className={styles.indexCard} onClick={() => navigate(route.href)} type="button">
              <span className={styles.indexCardPath}>{route.href}</span>
              <strong>{route.title}</strong>
              <span>{route.description}</span>
              <span className={styles.indexCardCta}>Open effect</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export const LoadingStateView: React.FC<{
  errorMessage?: string | null;
  navigate: (href: string) => void;
}> = ({errorMessage, navigate}) => {
  if (!errorMessage) {
    return <div className={styles.appLoading}>Loading preview manifest...</div>;
  }

  return (
    <div className={styles.appLoading}>
      <div className={styles.loadingCard}>
        <strong>Failed to load preview</strong>
        <span>{errorMessage}</span>
        <button className={styles.backLink} onClick={() => navigate(PAPER_EDITOR_BASE_PATH)} type="button">
          Back to index
        </button>
      </div>
    </div>
  );
};

export const PreviewStageView: React.FC<PreviewStageProps> = ({
  absolutePreviewFrame,
  activationFrame,
  continuousEffectId,
  interactionFrame,
  children,
  coverImageSrc,
  effectId,
  effectLayer,
  manifest,
  palette,
  previewFrame,
  renderHeight,
  renderWidth,
  surfaceVariant = "phone",
  stageBackground,
  visualLayout,
}) => {
  const backgroundMotion = manifest.modules?.backgroundMotion?.overscanPercent ?? 36;
  const {scale, viewportRef} = usePreviewSurfaceScale({renderHeight, renderWidth});

  return (
    <div className={surfaceVariant === "effect-lab" ? styles.effectFrame : styles.phoneFrame}>
      <div className={styles.previewViewport} ref={viewportRef}>
        <div
          className={styles.slidePreview}
          style={{
            color: palette.fg,
            background: stageBackground,
            height: renderHeight,
            transform: `scale(${scale})`,
            width: renderWidth,
          }}
        >
          {coverImageSrc ? (
            <div className={styles.previewCoverLayer}>
              <img
                alt={manifest.coverImage?.alt ?? "cover"}
                className={styles.previewCoverImage}
                style={{
                  width: `${100 + backgroundMotion}%`,
                  height: `${100 + backgroundMotion}%`,
                  left: `-${backgroundMotion / 2}%`,
                  top: `-${backgroundMotion / 2}%`,
                  position: "absolute",
                  objectPosition: "center center",
                  opacity: visualLayout.opacity,
                  filter: `blur(${visualLayout.blurPx}px) saturate(${visualLayout.saturation}) brightness(${visualLayout.brightness})`,
                  transform: `translate(${visualLayout.translateX}%, ${visualLayout.translateY}%) scale(${visualLayout.scale})`,
                }}
                src={coverImageSrc}
              />
              <div className={styles.previewCoverShade} style={{background: visualLayout.shade}} />
            </div>
          ) : null}

          {effectLayer ?? (
            <EffectRuntimeAdapter
              effectId={effectId}
              absoluteFrame={absolutePreviewFrame}
              activationFrame={activationFrame}
              continuousEffectId={
                continuousEffectId === "snake-grid"
                  ? "snake-grid"
                  : continuousEffectId === "particle-orbit"
                    ? "particle-orbit"
                    : continuousEffectId === "donut-spin"
                      ? "donut-spin"
                    : continuousEffectId === "lights-beams"
                      ? "lights-beams"
                    : continuousEffectId === "rubiks-auto-solve"
                      ? "rubiks-auto-solve"
                      : "cellular-life"
              }
              interactionFrame={interactionFrame}
              effectStartFrame={activationFrame}
              height={renderHeight}
              isRunning
              mode="interactive"
              modules={manifest.modules}
              seed={manifest.seed}
              simulationFrame={absolutePreviewFrame}
              width={renderWidth}
            />
          )}

          {children}
        </div>
      </div>
    </div>
  );
};

export const TemplatePreviewView: React.FC<{
  navigate: (href: string) => void;
  route: TemplateRoute;
  stageModel: TemplateStageModel;
  state: TemplatePreviewState;
}> = ({navigate, route, stageModel, state}) => {
  const {activeScene, manifest, previewFrame, setActiveSceneId} = state;
  if (!manifest || !activeScene) {
    return null;
  }

  return (
    <div className={styles.appShell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <button className={styles.backLink} onClick={() => navigate(PAPER_EDITOR_BASE_PATH)} type="button">
            Back to index
          </button>
          <div className={styles.eyebrow}>Templates</div>
          <h1>{manifest.paper.title}</h1>
          <p>{route.description}</p>
        </div>

        <div className={styles.metaGrid}>
          <div className={styles.metaGridCard}>
            <span>Route</span>
            <strong>{route.href}</strong>
          </div>
          <div className={styles.metaGridCard}>
            <span>Theme</span>
            <strong>{manifest.theme.id}</strong>
          </div>
          <div className={styles.metaGridCard}>
            <span>Scenes</span>
            <strong>{manifest.scenes.length}</strong>
          </div>
          <div className={styles.metaGridCard}>
            <span>Total</span>
            <strong>{formatSeconds(manifest.totalFrames, manifest.fps)}</strong>
          </div>
        </div>

        <div className={styles.controlPanel}>
          <div className={styles.controlPanelHeader}>
            <strong>Template Controls</strong>
            <span>手动切论文总结文本和 WebGL 特效，验证统一视频模板在不同输入下的可复用性。</span>
          </div>
          <label className={styles.controlField}>
            <span>Paper / Content Profile</span>
            <select
              className={styles.effectSelect}
              onChange={(event) => state.setSelectedContentProfileId(event.target.value)}
              value={state.selectedContentProfileId}
            >
              {state.contentProfileOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.controlField}>
            <span>WebGL Effect</span>
            <select
              className={styles.effectSelect}
              onChange={(event) => state.setSelectedEffectProfileId(event.target.value as typeof state.selectedEffectProfileId)}
              value={state.selectedEffectProfileId}
            >
              {state.effectProfileOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.sceneList}>
          {manifest.scenes.map((scene, index) => (
            <button
              key={scene.id}
              className={cx(styles.sceneItem, scene.id === activeScene.id && styles.sceneItemActive)}
              onClick={() => setActiveSceneId(scene.id)}
              type="button"
            >
              <span className={styles.sceneItemIndex}>{String(index + 1).padStart(2, "0")}</span>
              <span className={styles.sceneItemContent}>
                <strong>{getSceneLabel(scene)}</strong>
                <span>{scene.type} · {formatSeconds(scene.durationInFrames, manifest.fps)}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className={styles.stage}>
        <PreviewStageView
          absolutePreviewFrame={stageModel.absolutePreviewFrame}
          activationFrame={stageModel.activationFrame}
          continuousEffectId={stageModel.continuousEffectId}
          interactionFrame={stageModel.interactionFrame}
          coverImageSrc={stageModel.coverImageSrc}
          effectId={stageModel.backgroundEffectId}
          manifest={manifest}
          palette={stageModel.palette}
          previewFrame={previewFrame}
          renderHeight={stageModel.renderHeight}
          renderWidth={stageModel.renderWidth}
          surfaceVariant="phone"
          stageBackground={stageModel.stageBackground}
          visualLayout={stageModel.visualLayout}
        >
          <div className={styles.slideTop}>
            {stageModel.primaryNodes.map((node: React.ReactNode, index: number) => {
              const stateMotion = getTextMotionState({
                frame: previewFrame,
                durationInFrames: activeScene.durationInFrames,
                delayFrames:
                  index === 0
                    ? 0
                    : stageModel.textMotion.bodyDelayFrames + (index - 1) * stageModel.textMotion.bulletsStaggerFrames,
                config: stageModel.textMotion,
              });

              return (
                <div
                  key={`preview-primary-${index}`}
                  style={{
                    opacity: stateMotion.opacity,
                    transform: `translateY(${stateMotion.translateY}px)`,
                  }}
                >
                  {node}
                </div>
              );
            })}
          </div>
          {stageModel.secondaryNodes.length > 0 ? stageModel.secondaryNodes[0] : null}
        </PreviewStageView>
      </main>
    </div>
  );
};

export const EffectLabView: React.FC<{
  effectLayer: React.ReactNode;
  navigate: (href: string) => void;
  route: EffectRoute;
  stageModel: EffectStageModel;
  state: EffectPreviewState;
}> = ({effectLayer, navigate, route, stageModel, state}) => {
  const {isRunning, manifest, resetSimulation, scene, setIsRunning, simulationFrame} = state;
  if (!manifest || !scene) {
    return null;
  }

  const effectDefinition = getEffectDefinition(route.effectId);
  const controlLabel = isRunning ? "Running" : "Idle";

  return (
    <div className={styles.appShell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <button className={styles.backLink} onClick={() => navigate(PAPER_EDITOR_BASE_PATH)} type="button">
            Back to index
          </button>
          <div className={styles.eyebrow}>Effects</div>
          <h1>{route.title}</h1>
          <p>{route.description}</p>
        </div>

        <div className={styles.metaGrid}>
          <div className={styles.metaGridCard}>
            <span>Route</span>
            <strong>{route.href}</strong>
          </div>
          <div className={styles.metaGridCard}>
            <span>Effect ID</span>
            <strong>{route.effectId}</strong>
          </div>
          <div className={styles.metaGridCard}>
            <span>Source</span>
            <strong>{route.source}</strong>
          </div>
          <div className={styles.metaGridCard}>
            <span>Status</span>
            <strong>{controlLabel}</strong>
          </div>
        </div>

        <div className={styles.effectNotes}>
          <div className={styles.effectNote}>
            <strong>Purpose</strong>
            <span>Inspect the isolated WebGL effect atom without coupling it to the template composition layer.</span>
          </div>
          <div className={styles.effectNote}>
            <strong>Atom</strong>
            <span>{effectDefinition.title}</span>
          </div>
          <div className={styles.effectNote}>
            <strong>Composition</strong>
            <span>The final short video is background + WebGL effect + text + narration. This page only validates the middle effect layer.</span>
          </div>
          <div className={styles.effectNote}>
            <strong>Current Scene</strong>
            <span>{getSceneLabel(scene)}</span>
          </div>
        </div>
      </aside>

      <main className={styles.stage}>
        <div className={styles.effectLabStageLayout}>
          <div className={styles.effectStagePresentation}>
            <div className={styles.effectStageCaption}>
              <span>Effect Atom</span>
              <strong>{effectDefinition.id}</strong>
            </div>
            <PreviewStageView
              absolutePreviewFrame={stageModel.absolutePreviewFrame}
              activationFrame={stageModel.activationFrame}
              continuousEffectId={stageModel.continuousEffectId}
              interactionFrame={stageModel.interactionFrame}
              coverImageSrc={stageModel.coverImageSrc}
              effectId={stageModel.effectId}
              effectLayer={effectLayer}
              manifest={manifest}
              palette={stageModel.palette}
              previewFrame={simulationFrame}
              renderHeight={stageModel.renderHeight}
              renderWidth={stageModel.renderWidth}
              surfaceVariant="effect-lab"
              stageBackground={stageModel.stageBackground}
              visualLayout={stageModel.visualLayout}
            />
          </div>

          <aside className={styles.effectStageSidebar}>
            <div className={styles.effectControls}>
              <button className={styles.effectControlButton} onClick={() => setIsRunning(true)} type="button">
                Start
              </button>
              <button className={styles.effectControlButton} onClick={() => setIsRunning(false)} type="button">
                Pause
              </button>
              <button
                className={cx(styles.effectControlButton, styles.effectControlButtonGhost)}
                onClick={resetSimulation}
                type="button"
              >
                Reset
              </button>
            </div>

            {state.controlDefinitions.length > 0 ? (
              <div className={styles.effectControlPanel}>
                <div className={styles.effectControlPanelHeader}>
                  <strong>Effect Parameters</strong>
                  <span>这些参数只作用于实验页，用来快速验证不同 WebGL 特效的主体构图和运动节奏。</span>
                </div>
                <div className={styles.effectControlList}>
                  {state.controlDefinitions.map((control) => {
                    const value = readControlValue(stageModel.modules, control.section, control.field);
                    return (
                      <label key={control.id} className={styles.effectControlField}>
                        <div className={styles.effectControlMeta}>
                          <strong>{control.label}</strong>
                          <span>{control.description}</span>
                        </div>
                        <div className={styles.effectControlInputRow}>
                          {control.kind === "range" ? (
                            <input
                              className={styles.effectRange}
                              max={control.max}
                              min={control.min}
                              onChange={(event) => state.setControlValue(control, Number(event.target.value))}
                              step={control.step}
                              type="range"
                              value={typeof value === "number" ? value : control.min}
                            />
                          ) : (
                            <select
                              className={styles.effectSelect}
                              onChange={(event) => state.setControlValue(control, event.target.value)}
                              value={typeof value === "string" ? value : control.options[0]?.value ?? ""}
                            >
                              {control.options.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          )}
                          <output className={styles.effectControlValue}>
                            {typeof value === "number" || typeof value === "string" ? value : "--"}
                          </output>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

          </aside>
        </div>
      </main>
    </div>
  );
};
