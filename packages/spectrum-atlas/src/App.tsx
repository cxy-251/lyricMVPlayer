import React from "react";
import {AnimatePresence, motion} from "framer-motion";

import {Spectrum2DArchive} from "./components/Spectrum2DArchive";
import {Spectrum3DScene} from "./components/Spectrum3DScene";
import {SpectrumCaseStudy} from "./components/SpectrumCaseStudy";
import {SpectrumInspector} from "./components/SpectrumInspector";
import {SpectrumOverlay} from "./components/SpectrumOverlay";
import {SpectrumToolbar} from "./components/SpectrumToolbar";
import type {SpectrumMode} from "./components/SpectrumModeToggle";
import {
  defaultSpectrumColor,
  spectrumColorBySlug,
  spectrumColors,
  type SpectrumColor,
  type SpectrumFamily,
} from "./data/spectrum-colors";
import {darken, getReadableTextColor, lighten} from "./utils/color-convert";
import "./styles.css";

const SELECTED_STORAGE_KEY = "spectrum-atlas:selected";
const MODE_STORAGE_KEY = "spectrum-atlas:mode";

type Toast = {
  id: number;
  label: string;
};

const readStorage = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Local storage is a progressive enhancement for this portfolio page.
  }
};

const getHashSlug = (): string | null => {
  if (typeof window === "undefined") return null;
  const slug = window.location.hash.replace(/^#/, "").trim();
  return slug || null;
};

const getInitialSelectedId = (): string => {
  const hashSlug = getHashSlug();
  if (hashSlug && spectrumColorBySlug.has(hashSlug)) return hashSlug;
  const stored = readStorage(SELECTED_STORAGE_KEY);
  if (stored && spectrumColorBySlug.has(stored)) return stored;
  return defaultSpectrumColor.id;
};

const getInitialMode = (): SpectrumMode => {
  if (typeof window !== "undefined" && window.innerWidth < 760) return "2d";
  const stored = readStorage(MODE_STORAGE_KEY);
  return stored === "2d" || stored === "3d" ? stored : "3d";
};

const matchesColor = (color: SpectrumColor, query: string, family: SpectrumFamily | "all"): boolean => {
  if (family !== "all" && color.family !== family) return false;
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    color.name,
    color.displayName,
    color.pinyin ?? "",
    color.hex,
    color.family,
    color.slug,
  ].some((value) => value.toLowerCase().includes(normalized));
};

export const App: React.FC = () => {
  const [selectedId, setSelectedId] = React.useState(getInitialSelectedId);
  const [mode, setMode] = React.useState<SpectrumMode>(getInitialMode);
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [activeFamily, setActiveFamily] = React.useState<SpectrumFamily | "all">("all");
  const [resetSignal, setResetSignal] = React.useState(0);
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const selectedColor = React.useMemo(
    () => spectrumColors.find((color) => color.id === selectedId) ?? defaultSpectrumColor,
    [selectedId],
  );

  const filteredColors = React.useMemo(
    () => spectrumColors.filter((color) => matchesColor(color, deferredQuery, activeFamily)),
    [activeFamily, deferredQuery],
  );

  const showToast = React.useCallback((label: string) => {
    const id = Date.now();
    setToasts((current) => [...current, {id, label}].slice(-3));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2200);
  }, []);

  const selectColor = React.useCallback((id: string) => {
    if (spectrumColors.some((color) => color.id === id)) {
      setSelectedId(id);
    }
  }, []);

  const stepColor = React.useCallback((offset: number) => {
    const source = filteredColors.length > 0 ? filteredColors : spectrumColors;
    const currentIndex = Math.max(0, source.findIndex((color) => color.id === selectedColor.id));
    const next = source[(currentIndex + offset + source.length) % source.length];
    if (next) setSelectedId(next.id);
  }, [filteredColors, selectedColor.id]);

  const randomColor = React.useCallback(() => {
    const source = filteredColors.length > 0 ? filteredColors : spectrumColors;
    const next = source[Math.floor(Math.random() * source.length)];
    if (next) setSelectedId(next.id);
  }, [filteredColors]);

  const copyValue = React.useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    showToast(`${label} copied`);
  }, [showToast]);

  React.useEffect(() => {
    writeStorage(SELECTED_STORAGE_KEY, selectedColor.id);
    if (typeof window === "undefined") return;
    const nextUrl = `${window.location.pathname}${window.location.search}#${selectedColor.slug}`;
    window.history.replaceState(null, "", nextUrl);
  }, [selectedColor.id, selectedColor.slug]);

  React.useEffect(() => {
    writeStorage(MODE_STORAGE_KEY, mode);
  }, [mode]);

  React.useEffect(() => {
    const handleHashChange = () => {
      const slug = getHashSlug();
      if (slug && spectrumColorBySlug.has(slug)) setSelectedId(slug);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") stepColor(-1);
      if (event.key === "ArrowRight") stepColor(1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stepColor]);

  const rootStyle = React.useMemo(
    () => ({
      "--active-color": selectedColor.hex,
      "--active-light": lighten(selectedColor.hex, 0.58),
      "--active-soft": lighten(selectedColor.hex, 0.78),
      "--active-dark": darken(selectedColor.hex, 0.28),
      "--active-ink": getReadableTextColor(lighten(selectedColor.hex, 0.62)),
    }) as React.CSSProperties,
    [selectedColor.hex],
  );

  return (
    <main className="spectrum-page" data-mode={mode} style={rootStyle}>
      <div className="spectrum-paper" aria-hidden="true" />

      <SpectrumOverlay color={selectedColor} mode={mode} onModeChange={setMode} />

      <div className="spectrum-shell">
        <div className="spectrum-workbench">
          <AnimatePresence mode="wait">
            {mode === "3d" ? (
              <motion.div
                key="spectrum-3d"
                className="spectrum-mode-panel"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                transition={{duration: 0.22}}
              >
                <Spectrum3DScene
                  colors={spectrumColors}
                  selectedColor={selectedColor}
                  resetSignal={resetSignal}
                  onSelect={selectColor}
                />
              </motion.div>
            ) : (
              <motion.div
                key="spectrum-2d"
                className="spectrum-mode-panel"
                initial={{opacity: 0, y: 12}}
                animate={{opacity: 1, y: 0}}
                exit={{opacity: 0, y: -8}}
                transition={{duration: 0.24}}
              >
                <Spectrum2DArchive
                  colors={filteredColors}
                  selectedColor={selectedColor}
                  query={query}
                  activeFamily={activeFamily}
                  onQueryChange={setQuery}
                  onFamilyChange={setActiveFamily}
                  onSelect={selectColor}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="spectrum-side-rail">
          <SpectrumToolbar
            mode={mode}
            color={selectedColor}
            total={spectrumColors.length}
            onPrevious={() => stepColor(-1)}
            onNext={() => stepColor(1)}
            onRandom={randomColor}
            onResetView={() => setResetSignal((value) => value + 1)}
          />
          <SpectrumInspector color={selectedColor} onCopy={copyValue} />
        </div>
      </div>

      <SpectrumCaseStudy />

      <div className="spectrum-toast-stack" aria-live="polite">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              className="spectrum-toast"
              initial={{opacity: 0, y: 12, scale: 0.98}}
              animate={{opacity: 1, y: 0, scale: 1}}
              exit={{opacity: 0, y: -8, scale: 0.98}}
            >
              {toast.label}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </main>
  );
};

export const SpectrumAtlasPage = App;
