import React, {useEffect, useMemo, useState} from "react";
import {Player} from "@remotion/player";

import {MusicVideoComposition} from "../../modules/render-core/src";
import type {
  AudioFeatureTrack,
  LyricVideoCompositionProps,
  PlaylistSummary,
  QueueTrack,
  SongLibraryItem,
  TimedLyricLine,
} from "../../modules/render-core/src";

type ManifestSong = {
  id: string;
  title: string;
  artist: string;
  renderInputUrl: string;
  audioFeaturesUrl: string;
};

type WebManifest = {
  nickname: string;
  selectedPlaylistId: string | null;
  currentSongDirName: string;
  likedTrackIds: string[];
  customPlaylists: Array<{id: string; name: string; trackIds: string[] | "__ALL__"}>;
  songs: ManifestSong[];
};

type RenderInputPayload = {
  title: string;
  artist: string;
  audioSrc?: string;
  lyricOffsetMs?: number;
  renderTrimStartMs?: number;
  renderDurationInFrames?: number;
  durationInFrames: number;
  fps: number;
  background: {
    kind?: "image" | "video" | "color";
    src?: string;
    color?: string | null;
  };
  poetryFrame?: {
    nickname?: string | null;
    topLabel?: string | null;
    leftVertical?: string | null;
    rightVertical?: string | null;
    bottomLine?: string | null;
  };
  lyrics: TimedLyricLine[];
};

const ALL_TRACKS_SENTINEL = "__ALL__";

const buildQueue = (library: SongLibraryItem[]): QueueTrack[] =>
  library.map((song) => ({
    id: song.id,
    title: song.title,
    artist: song.artist,
    accent: "rgba(163, 206, 255, 0.7)",
  }));

const buildPlaylists = (
  library: SongLibraryItem[],
  manifest: WebManifest
): PlaylistSummary[] => {
  const libraryIds = library.map((song) => song.id);
  return [
    {id: "liked", name: "Liked Songs", count: manifest.likedTrackIds.length, accent: "rgba(255, 196, 170, 0.78)"},
    ...manifest.customPlaylists.map((playlist) => {
      const trackIds =
        playlist.trackIds === ALL_TRACKS_SENTINEL
          ? libraryIds
          : Array.isArray(playlist.trackIds)
            ? playlist.trackIds.filter((trackId) => libraryIds.includes(trackId))
            : [];

      return {
        id: playlist.id,
        name: playlist.name,
        count: trackIds.length,
        accent: "rgba(255,255,255,0.58)",
        trackIds,
      };
    }),
  ];
};

const normalizePoetryFrame = (
  poetryFrame: RenderInputPayload["poetryFrame"],
  nickname: string
) =>
  poetryFrame
    ? {
        nickname: poetryFrame.nickname ?? nickname,
        topLabel: poetryFrame.topLabel ?? `${nickname.toUpperCase()} · AUDIO DIARY`,
        leftVertical: poetryFrame.leftVertical ?? "",
        rightVertical: poetryFrame.rightVertical ?? "",
        bottomLine: poetryFrame.bottomLine ?? "",
      }
    : {
        nickname,
        topLabel: `${nickname.toUpperCase()} · AUDIO DIARY`,
        leftVertical: "",
        rightVertical: "",
        bottomLine: "",
      };

export const App: React.FC = () => {
  const [props, setProps] = useState<LyricVideoCompositionProps | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const manifestResponse = await fetch("/library-manifest.json");
        if (!manifestResponse.ok) {
          throw new Error(`Failed to load library-manifest.json: ${manifestResponse.status}`);
        }

        const manifest = (await manifestResponse.json()) as WebManifest;
        const library = await Promise.all(
          manifest.songs.map(async (song) => {
            const [renderInputResponse, audioFeaturesResponse] = await Promise.all([
              fetch(song.renderInputUrl),
              fetch(song.audioFeaturesUrl),
            ]);

            if (!renderInputResponse.ok) {
              throw new Error(`Failed to load ${song.renderInputUrl}: ${renderInputResponse.status}`);
            }
            if (!audioFeaturesResponse.ok) {
              throw new Error(`Failed to load ${song.audioFeaturesUrl}: ${audioFeaturesResponse.status}`);
            }

            const renderInput = (await renderInputResponse.json()) as RenderInputPayload;
            const audioFeatures = (await audioFeaturesResponse.json()) as AudioFeatureTrack;

            return {
              id: song.id,
              title: renderInput.title,
              artist: renderInput.artist,
              audioSrc: renderInput.audioSrc,
              lyricOffsetMs: renderInput.lyricOffsetMs ?? 0,
              renderTrimStartMs: renderInput.renderTrimStartMs ?? 0,
              renderDurationInFrames: renderInput.renderDurationInFrames ?? renderInput.durationInFrames,
              durationInFrames: renderInput.durationInFrames,
              fps: renderInput.fps,
              background: {
                kind: renderInput.background?.kind ?? (renderInput.background?.src ? "image" : "color"),
                src: renderInput.background?.src,
                color: renderInput.background?.color ?? "#101828",
              },
              poetryFrame: normalizePoetryFrame(renderInput.poetryFrame, manifest.nickname ?? "CleanKsen"),
              lyrics: renderInput.lyrics as TimedLyricLine[],
              audioFeatures,
            } satisfies SongLibraryItem;
          })
        );

        const queue = buildQueue(library);
        const playlists = buildPlaylists(library, manifest);
        const initialSong = library.find((item) => item.id === manifest.currentSongDirName) ?? library[0];

        if (!initialSong) {
          throw new Error("No songs available in web manifest.");
        }

        if (!cancelled) {
          setProps({
            title: initialSong.title,
            artist: initialSong.artist,
            audioSrc: initialSong.audioSrc,
            interactivePreview: true,
            lyricOffsetMs: initialSong.lyricOffsetMs ?? 0,
            renderTrimStartMs: initialSong.renderTrimStartMs ?? 0,
            renderDurationInFrames: initialSong.renderDurationInFrames ?? initialSong.durationInFrames,
            durationInFrames: initialSong.durationInFrames,
            fps: initialSong.fps,
            background: initialSong.background,
            poetryFrame: initialSong.poetryFrame,
            lyrics: initialSong.lyrics,
            audioFeatures: initialSong.audioFeatures,
            library,
            initialTrackId: initialSong.id,
            queue,
            playlists,
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const body = useMemo(() => {
    if (error) {
      return <div className="web-status">Failed to load player assets: {error}</div>;
    }

    if (!props) {
      return <div className="web-status">Loading player library...</div>;
    }

    return (
      <Player
        component={MusicVideoComposition}
        inputProps={props}
        durationInFrames={props.durationInFrames}
        fps={props.fps}
        compositionWidth={1080}
        compositionHeight={1920}
        controls={false}
        autoPlay={false}
        loop={false}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#000",
        }}
      />
    );
  }, [error, props]);

  return (
    <div className="web-shell">
      <div className="web-stage-frame">{body}</div>
    </div>
  );
};
