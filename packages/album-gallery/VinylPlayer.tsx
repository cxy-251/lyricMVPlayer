import React from "react";
import {ChevronLeft, Pause, SkipBack, SkipForward} from "lucide-react";

import {CoverImage} from "./CoverImage";
import type {AlbumGalleryPlayerTheme} from "./album-gallery-visuals";
import {formatDuration, lerp} from "./timing";
import type {AlbumGalleryTimeline, AlbumGalleryTrack} from "./types";

type VinylPlayerProps = {
  track: AlbumGalleryTrack;
  timeline: AlbumGalleryTimeline;
  fps: number;
  playFrame: number;
  playProgress: number;
  playerPresence: number;
  returnProgress: number;
  theme: AlbumGalleryPlayerTheme;
  themeIndex: number;
  themes: AlbumGalleryPlayerTheme[];
  interactive: boolean;
  onBackToGallery?: () => void;
};

const vinylRotationSpeed = 1.1;

export const VinylPlayer: React.FC<VinylPlayerProps> = ({
  track,
  timeline,
  fps,
  playFrame,
  playProgress,
  playerPresence,
  returnProgress,
  theme,
  themeIndex,
  themes,
  interactive,
  onBackToGallery,
}) => {
  const lightMode = theme.ink === "dark";
  const tonearmAngle = lerp(-18, 13, playerPresence * (1 - returnProgress) * (0.35 + playProgress * 0.65));

  return (
    <section
      className="absolute left-1/2 top-[72px] z-20 h-[min(900px,calc(100%-104px))] w-[min(1500px,calc(100%-72px))]"
      style={{
        opacity: playerPresence,
        pointerEvents: playerPresence > 0.55 ? "auto" : "none",
        transform: `translate3d(-50%, ${lerp(70, 0, playerPresence)}px, 0) scale(${lerp(0.94, 1, playerPresence)})`,
      }}
    >
      <div className="grid h-full grid-cols-[minmax(640px,1.06fr)_minmax(360px,0.72fr)] items-center gap-10 max-[940px]:grid-cols-1 max-[940px]:gap-4">
        <div className="relative h-full min-h-[560px]">
          <div
            className="vinyl-disc absolute left-[42%] top-1/2 aspect-square w-[min(45vw,700px)] rounded-full shadow-[0_46px_100px_rgba(0,0,0,0.24)]"
            style={{
              transform: `translate3d(${lerp(-100, 58, playerPresence)}px, -50%, 0) rotate(${playFrame * vinylRotationSpeed}deg)`,
            }}
          >
            <div className="vinyl-rings absolute inset-[7%] rounded-full" />
            <span className="vinyl-highlight absolute inset-[8%] rounded-full" />
            <div className="vinyl-label absolute left-1/2 top-1/2 grid aspect-square w-[31%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full p-6 text-center shadow-inner">
              <span className="min-w-0">
                <strong className="block truncate text-sm font-semibold text-neutral-900">{track.title}</strong>
                <small className="mt-1 block truncate text-xs font-medium text-neutral-700">{track.artist}</small>
              </span>
            </div>
          </div>

          <div
            className="absolute left-[6%] top-1/2 aspect-square w-[min(35vw,560px)] rounded-lg bg-neutral-950 p-3 shadow-[0_42px_95px_rgba(0,0,0,0.26)]"
            style={{transform: `translateY(-50%) scale(${lerp(0.96, 1, playerPresence)})`}}
          >
            <CoverImage track={track} className="h-full w-full rounded-md object-cover" />
            <span className="pointer-events-none absolute inset-3 rounded-md bg-[linear-gradient(130deg,rgba(255,255,255,0.22),transparent_44%,rgba(0,0,0,0.22))]" />
          </div>

          <div
            className="album-gallery-tonearm absolute right-[7%] top-[8%] h-[430px] w-[230px]"
            style={{transform: `rotate(${tonearmAngle}deg)`}}
          >
            <span className="absolute left-[51%] top-[18%] h-[78%] w-3 origin-top rounded-full bg-[linear-gradient(90deg,#f6efe4,#a48f75_62%,#5b5149)] shadow-[0_12px_24px_rgba(0,0,0,0.22)]" />
            <i className="absolute left-[42%] top-[7%] h-20 w-20 rounded-full border border-white/45 bg-[radial-gradient(circle,#f8f1e8_0%,#bca98f_62%,#6c5f53_100%)] shadow-[0_16px_32px_rgba(0,0,0,0.2)]" />
            <b className="absolute left-[47%] bottom-[7%] h-16 w-10 rounded-b-full bg-neutral-800 shadow-[0_12px_24px_rgba(0,0,0,0.26)]" />
          </div>

          <div className="absolute bottom-8 left-[13%] grid grid-cols-[auto_auto] items-center gap-4 rounded-lg border border-black/10 bg-white/60 px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.16)] backdrop-blur-xl">
            <span className="text-sm font-semibold text-neutral-700">{formatDuration(playFrame, fps)}</span>
            <span className="flex items-center gap-2" aria-hidden="true">
              {themes.map((playerTheme, index) => (
                <i
                  key={playerTheme.swatch}
                  className={`h-4 w-4 rounded-full border ${index === themeIndex ? "border-neutral-950" : "border-white/60"}`}
                  style={{background: playerTheme.swatch}}
                />
              ))}
            </span>
          </div>
        </div>

        <aside
          className={`relative z-20 flex min-w-0 flex-col gap-7 rounded-lg border p-8 shadow-[0_26px_90px_rgba(0,0,0,0.18)] backdrop-blur-2xl ${
            lightMode ? "border-black/10 bg-white/70 text-neutral-950" : "border-white/10 bg-black/20 text-white"
          }`}
        >
          <div className="min-w-0">
            <span className={`text-sm font-semibold ${lightMode ? "text-neutral-500" : "text-white/60"}`}>Now Playing</span>
            <h1 className="mt-3 line-clamp-3 text-5xl font-semibold leading-[1.02] max-[940px]:text-4xl">{track.title}</h1>
            <p className={`mt-4 truncate text-xl font-medium ${lightMode ? "text-neutral-600" : "text-white/70"}`}>
              {track.artist}
            </p>
          </div>

          <div className="grid gap-3">
            <div className={`flex items-center justify-between text-sm font-semibold ${lightMode ? "text-neutral-500" : "text-white/60"}`}>
              <span>{formatDuration(playFrame, fps)}</span>
              <span>{formatDuration(timeline.audioFrames, fps)}</span>
            </div>
            <div className={`h-2 overflow-hidden rounded-full ${lightMode ? "bg-black/10" : "bg-white/20"}`}>
              <span className="block h-full rounded-full bg-current" style={{width: `${Math.round(playProgress * 1000) / 10}%`}} />
            </div>
          </div>

          {interactive ? (
            <button
              className={`inline-flex w-fit items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-transform duration-200 hover:scale-[1.02] ${
                lightMode ? "border-black/10 bg-white/60 text-neutral-900" : "border-white/10 bg-white/10 text-white"
              }`}
              type="button"
              onClick={onBackToGallery}
            >
              <ChevronLeft size={16} strokeWidth={2.4} />
              Gallery
            </button>
          ) : null}

          <div className={`grid grid-cols-3 items-center gap-4 rounded-lg p-3 ${lightMode ? "bg-white/60" : "bg-white/10"}`}>
            <button className="grid h-12 place-items-center rounded-lg text-current" type="button" aria-label="Previous">
              <SkipBack size={19} strokeWidth={2.3} />
            </button>
            <button
              className={`grid h-14 place-items-center rounded-full shadow-lg ${lightMode ? "bg-neutral-950 text-white" : "bg-white text-neutral-950"}`}
              type="button"
              aria-label="Pause"
            >
              <Pause size={22} fill="currentColor" strokeWidth={0} />
            </button>
            <button className="grid h-12 place-items-center rounded-lg text-current" type="button" aria-label="Next">
              <SkipForward size={19} strokeWidth={2.3} />
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
};
