import {useEffect, useMemo, useState} from "react";
import type {
  ContentProfileDocument,
  ContentProfileRegistryDocument,
  ProductionManifest,
  RenderManifest,
  TemplateDocument,
  WebGLEffectProfileId,
} from "@paper-to-video/shared-types";
import {createModuleOverride, getEffectAtomDefinition} from "@paper-to-video/content-pipeline";
import {
  createTemplatePreviewManifest,
  effectProfileOptions,
  findEffectScene,
  findRoutes,
  loadContentProfileDocument,
  loadContentProfileRegistry,
  loadDefaultManifest,
  legacyRedirects,
  loadLatestManifest,
  loadTemplateDocument,
  resolveContentProfileOptions,
  resolveContentProfilePath,
  resolveInitialPath,
} from "./App.service";
import type {AppRouteState, EffectPreviewState, EffectRoute, TemplatePreviewState, TemplateRoute} from "./App.types";

const useAsyncLoader = <T,>(loadValue: (() => Promise<T>) | null) => {
  const [value, setValue] = useState<T | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!loadValue) {
      setValue(null);
      setErrorMessage(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    loadValue()
      .then((nextValue) => {
        if (cancelled) {
          return;
        }

        setValue(nextValue);
        setErrorMessage(null);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        console.error(error);
        setValue(null);
        setErrorMessage(error instanceof Error ? error.message : "Failed to load manifest");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadValue]);

  return {errorMessage, loading, value};
};

export const usePreviewRouter = (): AppRouteState => {
  const [currentPath, setCurrentPath] = useState(() => resolveInitialPath(window.location.pathname));

  useEffect(() => {
    if (legacyRedirects[window.location.pathname]) {
      const nextPath = legacyRedirects[window.location.pathname];
      window.history.replaceState({}, "", nextPath);
      setCurrentPath(nextPath);
    }

    const onPopState = () => {
      setCurrentPath(resolveInitialPath(window.location.pathname));
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const navigate = (href: string) => {
    if (href === currentPath) {
      return;
    }

    window.history.pushState({}, "", href);
    setCurrentPath(href);
  };

  const routes = findRoutes(currentPath);

  return {
    currentPath,
    navigate,
    templateRoute: routes.templateRoute,
    effectRoute: routes.effectRoute,
  };
};

export const useTemplatePreview = (route: TemplateRoute | null): TemplatePreviewState => {
  const {
    errorMessage: renderErrorMessage,
    loading: renderLoading,
    value: renderManifest,
  } = useAsyncLoader<RenderManifest>(route?.loadRenderManifest ?? null);
  const {
    errorMessage: productionErrorMessage,
    loading: productionLoading,
    value: productionManifest,
  } = useAsyncLoader<ProductionManifest>(route?.loadProductionManifest ?? null);
  const {
    errorMessage: registryErrorMessage,
    loading: registryLoading,
    value: registry,
  } = useAsyncLoader<ContentProfileRegistryDocument>(route ? loadContentProfileRegistry : null);
  const [activeSceneId, setActiveSceneId] = useState("");
  const [selectedContentProfileId, setSelectedContentProfileId] = useState("");
  const [selectedEffectProfileId, setSelectedEffectProfileId] = useState<WebGLEffectProfileId>("life-game");
  const [previewFrame, setPreviewFrame] = useState(0);

  useEffect(() => {
    if (!productionManifest) {
      setSelectedContentProfileId("");
      return;
    }

    setSelectedContentProfileId(productionManifest.contentProfile?.id ?? "");
    setSelectedEffectProfileId(productionManifest.effectProfile?.id ?? "life-game");
  }, [productionManifest]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPreviewFrame((frame) => (frame + 1) % 240);
    }, 100);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const selectedContentProfilePath = useMemo(
    () => resolveContentProfilePath(registry, productionManifest, selectedContentProfileId),
    [productionManifest, registry, selectedContentProfileId],
  );
  const loadSelectedContentProfile = useMemo(
    () =>
      selectedContentProfilePath
        ? () => loadContentProfileDocument(selectedContentProfilePath)
        : null,
    [selectedContentProfilePath],
  );
  const {
    errorMessage: contentErrorMessage,
    loading: contentLoading,
    value: selectedContentProfile,
  } = useAsyncLoader<ContentProfileDocument>(loadSelectedContentProfile);
  const loadTemplateDocumentValue = useMemo(
    () =>
      productionManifest?.template?.path
        ? () => loadTemplateDocument(productionManifest.template.path)
        : null,
    [productionManifest?.template?.path],
  );
  const {
    errorMessage: templateErrorMessage,
    loading: templateLoading,
    value: templateDocument,
  } = useAsyncLoader<TemplateDocument>(loadTemplateDocumentValue);

  const contentProfileOptions = useMemo(
    () => resolveContentProfileOptions(registry, productionManifest),
    [productionManifest, registry],
  );

  const manifest = useMemo(() => {
    if (!renderManifest || !productionManifest) {
      return null;
    }

    return createTemplatePreviewManifest({
      contentProfile: selectedContentProfile,
      effectProfileId: selectedEffectProfileId,
      productionManifest,
      renderManifest,
      templateDocument: renderManifest.templateDocument ?? templateDocument ?? {
        id: productionManifest.template.id,
        version: "fallback",
        sceneTemplates: [],
      },
    });
  }, [productionManifest, renderManifest, selectedContentProfile, selectedEffectProfileId, templateDocument]);

  const loading =
    renderLoading ||
    productionLoading ||
    registryLoading ||
    Boolean(productionManifest?.template?.path) && templateLoading ||
    Boolean(selectedContentProfilePath) && contentLoading;
  const errorMessage =
    renderErrorMessage ?? productionErrorMessage ?? registryErrorMessage ?? contentErrorMessage ?? templateErrorMessage ?? null;

  useEffect(() => {
    if (!manifest) {
      setActiveSceneId("");
      return;
    }

    setActiveSceneId((currentSceneId) =>
      manifest.scenes.some((scene) => scene.id === currentSceneId) ? currentSceneId : (manifest.scenes[0]?.id ?? ""),
    );
  }, [manifest]);

  const activeScene = useMemo(
    () => manifest?.scenes.find((scene) => scene.id === activeSceneId) ?? manifest?.scenes[0] ?? null,
    [activeSceneId, manifest],
  );

  const activeSubtitles = useMemo(
    () => manifest?.subtitleSegments.filter((segment) => segment.sceneId === activeScene?.id) ?? [],
    [activeScene?.id, manifest],
  );

  return {
    activeScene,
    activeSceneId,
    activeSubtitles,
    contentProfileOptions,
    errorMessage,
    effectProfileOptions,
    loading,
    manifest,
    previewFrame,
    selectedContentProfileId,
    selectedEffectProfileId,
    setActiveSceneId,
    setSelectedContentProfileId,
    setSelectedEffectProfileId,
  };
};

export const useEffectPreview = (route: EffectRoute | null): EffectPreviewState => {
  const loadManifest = route ? (route.source === "latest" ? loadLatestManifest : loadDefaultManifest) : null;
  const {errorMessage, loading, value: manifest} = useAsyncLoader<RenderManifest>(loadManifest);
  const [isRunning, setIsRunning] = useState(false);
  const [simulationFrame, setSimulationFrame] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const [runtimeSeed, setRuntimeSeed] = useState(1);
  const [moduleOverrides, setModuleOverrides] = useState({} as NonNullable<RenderManifest["modules"]>);
  const usesEngineDrivenFrames =
    route?.effectId === "cellular-life" ||
    route?.effectId === "donut-spin" ||
    route?.effectId === "lights-beams" ||
    route?.effectId === "rubiks-auto-solve";

  const nextRuntimeSeed = (baseSeed: number) =>
    Math.max(1, Math.trunc(baseSeed + Math.random() * 100000 + Date.now() % 9973));

  useEffect(() => {
    /**
     * We reset the sandbox when the route changes so one effect page never
     * leaks runtime state into another experimental page.
     */
    setSimulationFrame(0);
    setIsRunning(false);
    setResetToken((token) => token + 1);
    setModuleOverrides({});
    setRuntimeSeed(nextRuntimeSeed(manifest?.seed ?? 1));
  }, [route?.effectId]);

  useEffect(() => {
    /**
     * Engine-driven families own their own RAF loops, so we only keep the old
     * React timer for effect labs that still rely on a simple external frame.
     */
    if (!isRunning || usesEngineDrivenFrames) {
      return;
    }

    const timer = window.setInterval(() => {
      setSimulationFrame((frame) => frame + 1);
    }, 1000 / 24);

    return () => {
      window.clearInterval(timer);
    };
  }, [isRunning, usesEngineDrivenFrames]);

  const scene = useMemo(() => {
    if (!manifest || !route) {
      return null;
    }

    return findEffectScene(manifest, route.effectId);
  }, [manifest, route]);

  const resetSimulation = () => {
    setIsRunning(false);
    setSimulationFrame(0);
    setResetToken((token) => token + 1);
    setModuleOverrides({});
    setRuntimeSeed(nextRuntimeSeed(manifest?.seed ?? 1));
  };

  const controlDefinitions = useMemo(
    () => (route ? getEffectAtomDefinition(route.effectId).controls ?? [] : []),
    [route],
  );

  const setControlValue = (
    control: (typeof controlDefinitions)[number],
    value: number | string,
  ) => {
    setModuleOverrides((previous) =>
      createModuleOverride({
        baseModules: previous,
        control,
        value,
      }),
    );
  };

  return {
    controlDefinitions,
    errorMessage,
    isRunning,
    loading,
    manifest,
    moduleOverrides,
    resetToken,
    resetSimulation,
    runtimeSeed,
    scene,
    setControlValue,
    setIsRunning,
    simulationFrame,
  };
};

export const useTemplateActivationFrame = (_manifest: RenderManifest | null) => 0;
