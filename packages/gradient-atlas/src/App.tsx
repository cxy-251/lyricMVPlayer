import React from "react";
import {Link} from "react-router";
import {AnimatePresence, motion} from "framer-motion";

import {CaseStudy} from "./components/CaseStudy";
import {GradientCanvas} from "./components/GradientCanvas";
import {GradientInspector} from "./components/GradientInspector";
import {GradientLibrary} from "./components/GradientLibrary";
import {Toolbar} from "./components/Toolbar";
import {gradientPresets, type GradientPreset} from "./data/gradients";
import {
  createGradientId,
  generateTags,
  getGradientSurfaceVars,
  gradientDirections,
  isGradientDark,
  toCssGradient,
  toFallbackCss,
} from "./utils/gradient";
import "./styles.css";

const CUSTOM_STORAGE_KEY = "gradient-atlas:custom-presets";
const FAVORITES_STORAGE_KEY = "gradient-atlas:favorites";
const RECENTS_STORAGE_KEY = "gradient-atlas:recent";
const SELECTED_STORAGE_KEY = "gradient-atlas:selected";

type Toast = {
  id: number;
  label: string;
};

type CustomGradientInput = {
  name: string;
  colors: string[];
  direction: string;
};

const readStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const searchPreset = (preset: GradientPreset, query: string, activeTag: string): boolean => {
  const normalizedQuery = query.trim().toLowerCase();
  const tagMatch = activeTag === "all" || preset.tags.includes(activeTag);
  if (!tagMatch) return false;
  if (!normalizedQuery) return true;

  return [
    preset.name,
    preset.source ?? "",
    ...preset.colors,
    ...preset.tags,
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
};

const makeCanvasGradient = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  preset: GradientPreset,
  direction: string,
): CanvasGradient => {
  if (direction === "radial") {
    const gradient = context.createRadialGradient(width * 0.28, height * 0.22, 0, width * 0.5, height * 0.5, width * 0.72);
    preset.colors.forEach((color, index) => {
      gradient.addColorStop(index / Math.max(preset.colors.length - 1, 1), color);
    });
    return gradient;
  }

  const coordinates: Record<string, [number, number, number, number]> = {
    "to right": [0, 0, width, 0],
    "to left": [width, 0, 0, 0],
    "to bottom": [0, 0, 0, height],
    "135deg": [width, 0, 0, height],
  };
  const [x0, y0, x1, y1] = coordinates[direction] ?? coordinates["to right"];
  const gradient = context.createLinearGradient(x0, y0, x1, y1);
  preset.colors.forEach((color, index) => {
    gradient.addColorStop(index / Math.max(preset.colors.length - 1, 1), color);
  });
  return gradient;
};

const downloadPngPreview = (preset: GradientPreset, direction: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 900;
  const context = canvas.getContext("2d");
  if (!context) return;

  context.fillStyle = makeCanvasGradient(context, canvas.width, canvas.height, preset, direction);
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalAlpha = 0.16;
  for (let i = 0; i < 5200; i += 1) {
    const shade = Math.random() > 0.55 ? 255 : 0;
    context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 1)`;
    context.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
  }
  context.globalAlpha = 1;

  const dark = isGradientDark(preset.colors);
  context.fillStyle = dark ? "rgba(255,255,255,0.88)" : "rgba(8,12,24,0.82)";
  context.font = "700 48px Inter, system-ui, sans-serif";
  context.fillText(preset.name, 72, canvas.height - 118);
  context.font = "600 22px Inter, system-ui, sans-serif";
  context.fillText(`${direction} · ${preset.colors.join(" · ")}`, 72, canvas.height - 78);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${preset.id}-gradient-atlas.png`;
  link.click();
};

export const App: React.FC = () => {
  const [customPresets, setCustomPresets] = React.useState<GradientPreset[]>(() => readStorage(CUSTOM_STORAGE_KEY, []));
  const [favorites, setFavorites] = React.useState<Set<string>>(
    () => new Set(readStorage<string[]>(FAVORITES_STORAGE_KEY, [])),
  );
  const [recentIds, setRecentIds] = React.useState<string[]>(() => readStorage(RECENTS_STORAGE_KEY, []));
  const [selectedId, setSelectedId] = React.useState(() => readStorage(SELECTED_STORAGE_KEY, gradientPresets[0].id));
  const [direction, setDirection] = React.useState(gradientPresets[0].direction);
  const [query, setQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState("all");
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const allPresets = React.useMemo(() => [...customPresets, ...gradientPresets], [customPresets]);
  const selectedPreset = React.useMemo(
    () => allPresets.find((preset) => preset.id === selectedId) ?? allPresets[0],
    [allPresets, selectedId],
  );
  const cssGradient = React.useMemo(() => toCssGradient(selectedPreset, direction), [direction, selectedPreset]);
  const surfaceVars = React.useMemo(() => getGradientSurfaceVars(selectedPreset.colors), [selectedPreset.colors]);
  const themeMode = isGradientDark(selectedPreset.colors) ? "dark" : "light";

  const tags = React.useMemo(() => {
    const counts = new Map<string, number>();
    allPresets.forEach((preset) => preset.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);
  }, [allPresets]);

  const filteredPresets = React.useMemo(
    () => allPresets.filter((preset) => searchPreset(preset, query, activeTag)),
    [activeTag, allPresets, query],
  );

  const showToast = React.useCallback((label: string) => {
    const id = Date.now();
    setToasts((current) => [...current, {id, label}].slice(-3));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2200);
  }, []);

  const touchRecent = React.useCallback((id: string) => {
    setRecentIds((current) => [id, ...current.filter((item) => item !== id)].slice(0, 12));
  }, []);

  const selectPreset = React.useCallback((id: string) => {
    const next = allPresets.find((preset) => preset.id === id);
    if (!next) return;
    setSelectedId(next.id);
    setDirection(next.direction);
    touchRecent(next.id);
  }, [allPresets, touchRecent]);

  React.useEffect(() => {
    if (!selectedPreset) return;
    touchRecent(selectedPreset.id);
  }, [selectedPreset, touchRecent]);

  React.useEffect(() => writeStorage(CUSTOM_STORAGE_KEY, customPresets), [customPresets]);
  React.useEffect(() => writeStorage(FAVORITES_STORAGE_KEY, Array.from(favorites)), [favorites]);
  React.useEffect(() => writeStorage(RECENTS_STORAGE_KEY, recentIds), [recentIds]);
  React.useEffect(() => writeStorage(SELECTED_STORAGE_KEY, selectedPreset.id), [selectedPreset.id]);

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

  const toggleFavorite = React.useCallback((id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const stepPreset = React.useCallback((offset: number) => {
    const source = filteredPresets.length > 0 ? filteredPresets : allPresets;
    const index = Math.max(source.findIndex((preset) => preset.id === selectedPreset.id), 0);
    const next = source[(index + offset + source.length) % source.length];
    if (next) selectPreset(next.id);
  }, [allPresets, filteredPresets, selectPreset, selectedPreset.id]);

  const randomPreset = React.useCallback(() => {
    const source = filteredPresets.length > 0 ? filteredPresets : allPresets;
    const next = source[Math.floor(Math.random() * source.length)];
    if (next) selectPreset(next.id);
  }, [allPresets, filteredPresets, selectPreset]);

  const addCustomGradient = React.useCallback((gradient: CustomGradientInput) => {
    const preset: GradientPreset = {
      id: createGradientId(gradient.name),
      name: gradient.name,
      colors: gradient.colors,
      direction: gradient.direction,
      tags: generateTags(gradient.colors),
      source: "Custom",
    };
    setCustomPresets((current) => [preset, ...current].slice(0, 36));
    setSelectedId(preset.id);
    setDirection(preset.direction);
    setActiveTag("all");
    setQuery("");
    touchRecent(preset.id);
    showToast(`${preset.name} saved`);
  }, [showToast, touchRecent]);

  const rootStyle = {
    ...surfaceVars,
    "--atlas-current-gradient": cssGradient,
  } as React.CSSProperties;

  return (
    <main className="gradient-atlas min-h-screen overflow-x-hidden" data-theme={themeMode} style={rootStyle}>
      <GradientCanvas preset={selectedPreset} cssGradient={cssGradient} />

      <div className="gradient-atlas__shell">
        <header className="gradient-atlas__nav">
          <Link to="/studio">Studio</Link>
          <span>Gradient Preset Lab</span>
        </header>

        <div className="gradient-atlas__stage">
          <GradientLibrary
            presets={filteredPresets}
            selectedId={selectedPreset.id}
            favorites={favorites}
            query={query}
            activeTag={activeTag}
            tags={tags}
            onQueryChange={setQuery}
            onTagChange={setActiveTag}
            onSelect={selectPreset}
            onToggleFavorite={toggleFavorite}
          />

          <section className="gradient-atlas__preview" aria-label="Current gradient preview">
            <motion.div
              key={selectedPreset.id}
              className="gradient-atlas__headline"
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.36, ease: [0.16, 1, 0.3, 1]}}
            >
              <h1>Gradient Atlas</h1>
              <p>
                Browse curated gradients, generate semantic tags, and export production-ready color code for video,
                WebGL, and interface systems.
              </p>
              <div className="gradient-atlas__recent" aria-label="Recently viewed gradients">
                {recentIds.slice(0, 5).map((id) => {
                  const recent = allPresets.find((preset) => preset.id === id);
                  if (!recent) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectPreset(id)}
                      style={{backgroundImage: toCssGradient(recent)}}
                      aria-label={`Open ${recent.name}`}
                      title={recent.name}
                    />
                  );
                })}
              </div>
            </motion.div>

            <Toolbar
              preset={selectedPreset}
              direction={direction}
              directions={gradientDirections}
              favorite={favorites.has(selectedPreset.id)}
              onPrevious={() => stepPreset(-1)}
              onNext={() => stepPreset(1)}
              onRandom={randomPreset}
              onToggleFavorite={() => toggleFavorite(selectedPreset.id)}
              onDirectionChange={setDirection}
              onCopyCss={() => copyValue(toFallbackCss(selectedPreset, direction), "CSS")}
              onExportPng={() => {
                downloadPngPreview(selectedPreset, direction);
                showToast("PNG preview exported");
              }}
            />
          </section>

          <GradientInspector
            preset={selectedPreset}
            direction={direction}
            onCopy={copyValue}
            onAddCustomGradient={addCustomGradient}
          />
        </div>
      </div>

      <CaseStudy />

      <div className="gradient-toast-stack" aria-live="polite">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              className="gradient-toast"
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

export const GradientAtlasPage = App;
