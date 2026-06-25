import React, {useEffect, useMemo, useRef, useState} from "react";
import {Link} from "react-router";
import {
  EFFECT_ATOMS,
  EffectRuntimeAdapter,
  type EffectAtomId,
} from "@paper-to-video/content-pipeline";
import {
  getVisualEffectAtom,
  visualEffectAtoms,
  visualEffectRecipes,
  VisualEffectStage,
  type EffectAudioFrame,
  type RecipeLayer,
  type VisualEffectRecipe,
} from "@lyric-mv/visual-effects";

import type {AudioFeatureTrack} from "../../types";

type LabSong = {
  id: string;
  title: string;
  artist: string;
  audioSrc?: string;
  audioFeatures?: AudioFeatureTrack;
  fps: number;
  durationInFrames: number;
};

type RecipeEntry = {kind: "recipe"; recipe: VisualEffectRecipe};
type PaperEntry = {kind: "paper"; id: EffectAtomId; title: string; description: string};
type LabEntry = RecipeEntry | PaperEntry;

const paperEffectIds: EffectAtomId[] = [
  "cellular-life",
  "snake-grid",
  "particle-orbit",
  "donut-spin",
  "lights-beams",
  "rubiks-auto-solve",
];

const entries: LabEntry[] = [
  ...visualEffectRecipes.map((recipe): RecipeEntry => ({kind: "recipe", recipe})),
  ...paperEffectIds.map((id): PaperEntry => ({
    kind: "paper",
    id,
    title: EFFECT_ATOMS[id].title,
    description: EFFECT_ATOMS[id].description,
  })),
];

const entryId = (entry: LabEntry) => entry.kind === "recipe" ? entry.recipe.id : `paper/${entry.id}`;
const cloneRecipe = (recipe: VisualEffectRecipe) => structuredClone(recipe);

const routeEntryId = () => {
  const segments = window.location.pathname.split("/").filter(Boolean);
  const marker = segments.indexOf("effects");
  return marker >= 0 ? decodeURIComponent(segments.slice(marker + 1).join("/")) : "";
};

const sampleAudio = (track: AudioFeatureTrack | undefined, seconds: number): EffectAudioFrame | null => {
  if (!track?.frames.length) return null;
  const index = Math.max(0, Math.min(track.frames.length - 1, Math.round(seconds * track.frameRate)));
  const frame = track.frames[index];
  return {
    bass: frame.bass,
    mid: frame.mid,
    high: frame.high,
    energy: frame.energy,
    beat: frame.beat,
    onset: frame.onset,
  };
};

const PaperEffectStage: React.FC<{effectId: EffectAtomId; frame: number}> = ({effectId, frame}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({width: 1280, height: 720});

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const resize = () => {
      const rect = host.getBoundingClientRect();
      setSize({width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height))});
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    return () => observer.disconnect();
  }, []);

  return (
    <div className="effect-lab-paper-stage" ref={hostRef}>
      <EffectRuntimeAdapter
        absoluteFrame={frame}
        activationFrame={0}
        continuousEffectId={effectId}
        effectId={effectId}
        effectStartFrame={0}
        height={size.height}
        interactionFrame={0}
        isRunning
        mode="interactive"
        seed={1307}
        simulationFrame={frame}
        width={size.width}
      />
    </div>
  );
};

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};

export const EffectLabPage: React.FC<{song: LabSong}> = ({song}) => {
  const initialId = routeEntryId();
  const initialEntry = entries.find((entry) => entryId(entry) === initialId) ?? entries[0];
  const [selectedEntryId, setSelectedEntryId] = useState(entryId(initialEntry));
  const [recipe, setRecipe] = useState<VisualEffectRecipe>(() =>
    initialEntry.kind === "recipe" ? cloneRecipe(initialEntry.recipe) : cloneRecipe(visualEffectRecipes[0]),
  );
  const [selectedLayerId, setSelectedLayerId] = useState(recipe.layers[0]?.id ?? "");
  const [soloLayerId, setSoloLayerId] = useState<string | null>(null);
  const [effectListOpen, setEffectListOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(song.durationInFrames / song.fps);
  const audioRef = useRef<HTMLAudioElement>(null);
  const selectedEntry = entries.find((entry) => entryId(entry) === selectedEntryId) ?? entries[0];
  const selectedLayer = recipe.layers.find((item) => item.id === selectedLayerId) ?? recipe.layers[0];
  const selectedAtom = selectedLayer ? getVisualEffectAtom(selectedLayer.atomId) : visualEffectAtoms[0];
  const audioFrame = useMemo(() => sampleAudio(song.audioFeatures, currentTime), [currentTime, song.audioFeatures]);
  const frame = Math.round(currentTime * song.fps);
  const stageRecipe = useMemo(() => ({
    ...recipe,
    layers: recipe.layers.map((item) => ({
      ...item,
      visible: item.visible && (!soloLayerId || item.id === soloLayerId),
    })),
  }), [recipe, soloLayerId]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    let raf = 0;
    const tick = () => {
      setCurrentTime(audioRef.current?.currentTime ?? 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  const selectEntry = (entry: LabEntry) => {
    const id = entryId(entry);
    setSelectedEntryId(id);
    setEffectListOpen(false);
    window.history.pushState({}, "", `/studio/effects/${id}`);
    if (entry.kind === "recipe") {
      const next = cloneRecipe(entry.recipe);
      setRecipe(next);
      setSelectedLayerId(next.layers[0]?.id ?? "");
      setSoloLayerId(null);
    }
  };

  const updateLayer = (id: string, update: (layer: RecipeLayer) => RecipeLayer) => {
    setRecipe((current) => ({...current, source: "custom", id: `custom/${current.id.replace(/^custom\//, "")}`, layers: current.layers.map((item) => item.id === id ? update(item) : item)}));
  };

  const addLayer = (atomId: string) => {
    const atom = getVisualEffectAtom(atomId);
    const id = `${atomId}-${Date.now().toString(36)}`;
    const nextLayer: RecipeLayer = {
      id,
      atomId,
      config: structuredClone(atom.defaultConfig) as Record<string, unknown>,
      opacity: 1,
      blendMode: "normal",
      transform: {x: 0, y: 0, scale: 1, rotation: 0},
      inputEnabled: Boolean(atom.capabilities.pointer),
      visible: true,
    };
    setRecipe((current) => ({...current, source: "custom", id: `custom/${current.id.replace(/^custom\//, "")}`, layers: [...current.layers, nextLayer]}));
    setSelectedLayerId(id);
  };

  const moveLayer = (direction: -1 | 1) => {
    const index = recipe.layers.findIndex((item) => item.id === selectedLayerId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= recipe.layers.length) return;
    setRecipe((current) => {
      const layers = [...current.layers];
      [layers[index], layers[target]] = [layers[target], layers[index]];
      return {...current, source: "custom", layers};
    });
  };

  const duplicateLayer = () => {
    if (!selectedLayer) return;
    const copy = structuredClone(selectedLayer);
    copy.id = `${copy.atomId}-${Date.now().toString(36)}`;
    setRecipe((current) => ({...current, source: "custom", layers: [...current.layers, copy]}));
    setSelectedLayerId(copy.id);
  };

  const removeLayer = () => {
    if (!selectedLayer || recipe.layers.length === 1) return;
    const index = recipe.layers.findIndex((item) => item.id === selectedLayer.id);
    const nextLayers = recipe.layers.filter((item) => item.id !== selectedLayer.id);
    setRecipe((current) => ({...current, source: "custom", layers: nextLayers}));
    setSelectedLayerId(nextLayers[Math.max(0, index - 1)]?.id ?? "");
    if (soloLayerId === selectedLayer.id) setSoloLayerId(null);
  };

  const exportRecipe = () => {
    const blob = new Blob([`${JSON.stringify(recipe, null, 2)}\n`], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${recipe.id.replaceAll("/", "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const togglePlayback = async () => {
    const audioElement = audioRef.current;
    if (!audioElement || !song.audioSrc) return;
    if (audioElement.paused) await audioElement.play().catch(() => undefined);
    else audioElement.pause();
  };

  return (
    <main className="effect-lab">
      {song.audioSrc ? (
        <audio
          ref={audioRef}
          src={song.audioSrc}
          preload="metadata"
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || duration)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      ) : null}

      <section className="effect-lab-stage" aria-label="Composed visual effect preview">
        {selectedEntry.kind === "paper" ? (
          <PaperEffectStage effectId={selectedEntry.id} frame={frame} />
        ) : (
          <VisualEffectStage
            atoms={visualEffectAtoms}
            audio={audioFrame}
            className="effect-lab-canvas"
            mode="interactive"
            recipe={stageRecipe}
            seed={1307}
          />
        )}
        <div className="effect-lab-audio">
          <button disabled={!song.audioSrc} onClick={() => void togglePlayback()} type="button">
            {isPlaying ? "Pause" : "Play"}
          </button>
          <div>
            <strong>{song.title}</strong>
            <span>{song.artist}</span>
          </div>
          <input
            aria-label="Song position"
            max={Math.max(1, duration)}
            min={0}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              setCurrentTime(next);
              if (audioRef.current) audioRef.current.currentTime = next;
            }}
            step={0.01}
            type="range"
            value={Math.min(currentTime, duration)}
          />
          <output>{formatTime(currentTime)} / {formatTime(duration)}</output>
          {!song.audioFeatures?.frames.length ? <em>Audio features unavailable for this song.</em> : null}
        </div>
      </section>

      <div className="effect-lab-toolbar">
        <Link className="effect-lab-back" to="/studio">Studio</Link>
        <button className="effect-lab-picker" onClick={() => setEffectListOpen(true)} type="button">
          <span>{selectedEntry.kind === "recipe" ? selectedEntry.recipe.source : "paper"}</span>
          <strong>{selectedEntry.kind === "recipe" ? selectedEntry.recipe.title : selectedEntry.title}</strong>
        </button>
      </div>

      {effectListOpen ? (
        <div className="effect-lab-drawer-layer">
          <button aria-label="Close effect list" className="effect-lab-drawer-scrim" onClick={() => setEffectListOpen(false)} type="button" />
          <aside className="effect-lab-rail">
            <div className="effect-lab-drawer-head"><div><p className="effect-lab-kicker">Visual Lab</p><h1>23 Recipes</h1></div><button className="effect-lab-close" onClick={() => setEffectListOpen(false)} type="button">×</button></div>
            <nav className="effect-lab-tabs">
              {entries.map((entry) => (
                <button aria-pressed={entryId(entry) === selectedEntryId} key={entryId(entry)} onClick={() => selectEntry(entry)} type="button">
                  <span>{entry.kind === "recipe" ? entry.recipe.source : "paper"}</span>
                  <strong>{entry.kind === "recipe" ? entry.recipe.title : entry.title}</strong>
                </button>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}

      {selectedEntry.kind === "recipe" ? (
        <>
          <button className={`effect-lab-controls-toggle ${controlsOpen ? "is-open" : ""}`} onClick={() => setControlsOpen((open) => !open)} type="button">Layers</button>
          {controlsOpen ? (
            <aside className="effect-lab-panel effect-lab-panel--composer">
              <div className="effect-lab-panel__header"><div><span>Composition</span><strong>{recipe.layers.length} layers</strong></div><button className="effect-lab-panel__close" onClick={() => setControlsOpen(false)} type="button">×</button></div>
              <div className="effect-lab-compose-actions">
                <select aria-label="Add effect atom" defaultValue="" onChange={(event) => {if (event.currentTarget.value) addLayer(event.currentTarget.value); event.currentTarget.value = "";}}>
                  <option value="" disabled>Add atom...</option>
                  {visualEffectAtoms.map((atom) => <option key={atom.id} value={atom.id}>{atom.title}</option>)}
                </select>
                <button onClick={exportRecipe} type="button">Export JSON</button>
              </div>
              <div className="effect-lab-layer-list">
                {recipe.layers.map((item, index) => {
                  const atom = getVisualEffectAtom(item.atomId);
                  return <button aria-pressed={item.id === selectedLayer?.id} key={item.id} onClick={() => setSelectedLayerId(item.id)} type="button"><span>{String(index + 1).padStart(2, "0")}</span><strong>{atom.title}</strong><em>{item.visible ? "On" : "Off"}</em></button>;
                })}
              </div>
              {selectedLayer ? (
                <div className="effect-lab-layer-editor">
                  <div className="effect-lab-layer-actions">
                    <button onClick={() => updateLayer(selectedLayer.id, (item) => ({...item, visible: !item.visible}))} type="button">{selectedLayer.visible ? "Hide" : "Show"}</button>
                    <button onClick={() => setSoloLayerId((current) => current === selectedLayer.id ? null : selectedLayer.id)} type="button">{soloLayerId === selectedLayer.id ? "Unsolo" : "Solo"}</button>
                    <button onClick={() => moveLayer(-1)} type="button">Up</button>
                    <button onClick={() => moveLayer(1)} type="button">Down</button>
                    <button onClick={duplicateLayer} type="button">Duplicate</button>
                    <button disabled={recipe.layers.length === 1} onClick={removeLayer} type="button">Remove</button>
                  </div>
                  <label className="effect-lab-control"><span>Opacity</span><input min={0} max={1} step={0.01} type="range" value={selectedLayer.opacity} onChange={(event) => updateLayer(selectedLayer.id, (item) => ({...item, opacity: Number(event.currentTarget.value)}))}/><output>{selectedLayer.opacity.toFixed(2)}</output></label>
                  <label className="effect-lab-control"><span>Blend</span><select value={selectedLayer.blendMode} onChange={(event) => updateLayer(selectedLayer.id, (item) => ({...item, blendMode: event.currentTarget.value as RecipeLayer["blendMode"]}))}>{["normal", "add", "screen", "multiply"].map((value) => <option key={value}>{value}</option>)}</select></label>
                  {selectedAtom.controls.map((control) => {
                    const value = selectedLayer.config[control.field] ?? (selectedAtom.defaultConfig as Record<string, unknown>)[control.field];
                    if (control.kind === "color") return <label className="effect-lab-control" key={control.field}><span>{control.label}</span><input type="color" value={String(value)} onChange={(event) => updateLayer(selectedLayer.id, (item) => ({...item, config: {...item.config, [control.field]: event.currentTarget.value}}))}/></label>;
                    return <label className="effect-lab-control" key={control.field}><span>{control.label}</span><input type="range" min={control.min} max={control.max} step={control.step} value={Number(value)} onChange={(event) => updateLayer(selectedLayer.id, (item) => ({...item, config: {...item.config, [control.field]: Number(event.currentTarget.value)}}))}/><output>{Number(value).toFixed(2)}</output></label>;
                  })}
                </div>
              ) : null}
            </aside>
          ) : null}
        </>
      ) : null}
    </main>
  );
};
