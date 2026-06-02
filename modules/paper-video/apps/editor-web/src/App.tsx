import React from "react";
import {EffectRuntimeAdapter} from "@paper-to-video/content-pipeline";
import {
  createEffectStageModel,
  createTemplateStageModel,
  EFFECT_LAB_RENDER_HEIGHT,
  EFFECT_LAB_RENDER_WIDTH,
  getEffectStartLabel,
} from "./App.service";
import {EffectLabView, LoadingStateView, TemplatePreviewView, AppIndexView} from "./AppViews";
import styles from "./App.module.css";
import {useEffectPreview, usePreviewRouter, useTemplatePreview} from "./useEditorPreview";

const App: React.FC = () => {
  const {effectRoute, navigate, templateRoute} = usePreviewRouter();
  const templateState = useTemplatePreview(templateRoute);
  const effectState = useEffectPreview(effectRoute);

  if (templateRoute) {
    if (templateState.loading || templateState.errorMessage || !templateState.manifest || !templateState.activeScene) {
      return <LoadingStateView errorMessage={templateState.errorMessage} navigate={navigate} />;
    }

    const templateStageModel = createTemplateStageModel({
      activeScene: templateState.activeScene,
      activeSubtitles: templateState.activeSubtitles,
      manifest: templateState.manifest,
      previewFrame: templateState.previewFrame,
    });

    return (
      <TemplatePreviewView
        navigate={navigate}
        route={templateRoute}
        stageModel={templateStageModel}
        state={templateState}
      />
    );
  }

  if (effectRoute) {
    if (effectState.loading || effectState.errorMessage || !effectState.manifest || !effectState.scene) {
      return <LoadingStateView errorMessage={effectState.errorMessage} navigate={navigate} />;
    }

    const effectStageModel = createEffectStageModel({
      effectRoute,
      isRunning: effectState.isRunning,
      manifest: effectState.manifest,
      moduleOverrides: effectState.moduleOverrides,
      scene: effectState.scene,
      simulationFrame: effectState.simulationFrame,
    });

    const effectLayer = effectState.isRunning ? (
      <EffectRuntimeAdapter
        absoluteFrame={effectStageModel.absolutePreviewFrame}
        activationFrame={effectStageModel.activationFrame}
        continuousEffectId={effectStageModel.continuousEffectId}
        interactionFrame={effectStageModel.interactionFrame}
        effectStartFrame={effectStageModel.activationFrame}
        effectId={effectStageModel.effectId}
        height={EFFECT_LAB_RENDER_HEIGHT}
        isRunning={effectState.isRunning}
        mode="interactive"
        modules={effectStageModel.modules}
        onPrimaryAction={() => effectState.setIsRunning(true)}
        resetToken={effectState.resetToken}
        seed={effectState.runtimeSeed}
        simulationFrame={effectState.simulationFrame}
        width={EFFECT_LAB_RENDER_WIDTH}
      />
    ) : (
      <button className={styles.effectStageButton} onClick={() => effectState.setIsRunning(true)} type="button">
        {getEffectStartLabel(effectRoute.effectId)}
      </button>
    );

    return (
      <EffectLabView
        effectLayer={effectLayer}
        navigate={navigate}
        route={effectRoute}
        stageModel={effectStageModel}
        state={effectState}
      />
    );
  }

  return <AppIndexView navigate={navigate} />;
};

export {App};
