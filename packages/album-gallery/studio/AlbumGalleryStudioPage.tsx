import React from "react";
import {Link} from "react-router";

import {AlbumGalleryExperience} from "../components/AlbumGalleryExperience";
import {buildAlbumGalleryTimeline, clamp, normalizeTrackIndex} from "../utils/timing";
import type {AlbumGalleryTrack, PublicRenderInput} from "../types";
import {fetchLibraryIndex, fetchAlbumManifest, getAlbumCoverUrl, getTrackAudioUrl, LibraryAlbum} from "../data/api";

type ViewLayer = "gallery" | "album" | "player";

const FAKE_ALBUMS = [
  {album: "Midnight Reverie", artist: "The Midnight", color: "#FF5E3A"},
  {album: "Neon Horizons", artist: "Synthwave Club", color: "#833ab4"},
  {album: "Silent Echoes", artist: "Aurora", color: "#11998e"},
  {album: "Velvet Skies", artist: "Jazz Trio", color: "#FC466B"},
  {album: "Urban Symphony", artist: "Lofi Beats", color: "#00b09b"},
  {album: "Crystal Dreams", artist: "Chillwave", color: "#f857a6"},
  {album: "Electric Whisper", artist: "Dream Pop", color: "#4facfe"},
  {album: "Golden Hour", artist: "Indie Rock", color: "#ff0844"},
  {album: "Lunar Phases", artist: "Synth Pop", color: "#a18cd1"},
  {album: "Solar Flares", artist: "Future Bass", color: "#ff9a9e"}
];

export const AlbumGalleryStudioPage: React.FC = () => {
  const [albums, setAlbums] = React.useState<(LibraryAlbum & {_isFake?: boolean, _color?: string})[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = React.useState<string>("");
  
  const [albumTracks, setAlbumTracks] = React.useState<AlbumGalleryTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = React.useState<string>("");
  
  const [viewLayer, setViewLayer] = React.useState<ViewLayer>("gallery");
  const [galleryIndex, setGalleryIndex] = React.useState(0);
  
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [frame, setFrame] = React.useState(0);
  const frameRef = React.useRef(0);
  
  const [tracklistRendered, setTracklistRendered] = React.useState(false);
  
  // Audio playback ref
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    fetchLibraryIndex().then(data => {
      let loadedAlbums: (LibraryAlbum & {_isFake?: boolean, _color?: string})[] = [...data.albums];
      let i = 0;
      while (loadedAlbums.length < 10) {
        const fake = FAKE_ALBUMS[i % FAKE_ALBUMS.length];
        loadedAlbums.push({
          id: `fake-${i}`,
          artist: fake.artist,
          album: fake.album,
          representativeCover: "",
          trackCount: 12,
          _isFake: true,
          _color: fake.color
        });
        i++;
      }
      setAlbums(loadedAlbums);
      if (loadedAlbums.length > 0) {
        setSelectedAlbumId(loadedAlbums[0].id);
      }
    }).catch(console.error);
  }, []);

  const albumMockTracks = React.useMemo<AlbumGalleryTrack[]>(() => {
    return albums.map((a, i) => ({
      id: a.id,
      index: i,
      title: a.album,
      artist: a.artist,
      themeColor: a._color || "#222",
      fps: 30,
      durationInFrames: 300,
      audioSrc: "",
      coverSrc: a._isFake ? "" : getAlbumCoverUrl(a.id, a.representativeCover),
      renderInput: {} as PublicRenderInput
    }));
  }, [albums]);

  // Audio Sync & Ticker
  React.useEffect(() => {
    if (viewLayer !== "player" || !albumTracks.length || !selectedTrackId) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return undefined;
    }
    
    const selected = albumTracks[normalizeTrackIndex(albumTracks, selectedTrackId)] ?? albumTracks[0];
    const timeline = buildAlbumGalleryTimeline(selected, 30);
    
    if (audioRef.current) {
      if (audioRef.current.src !== selected.audioSrc) {
        audioRef.current.src = selected.audioSrc;
        audioRef.current.currentTime = 0;
        frameRef.current = 0;
      }
      if (isPlaying) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
    }

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const deltaFrames = ((now - last) / 1000) * 30;
      last = now;
      if (isPlaying) {
        // Sync visual frame with actual audio playback if available
        if (audioRef.current && !audioRef.current.paused) {
          frameRef.current = audioRef.current.currentTime * 30;
        } else {
          frameRef.current = Math.min(frameRef.current + deltaFrames, timeline.audioFrames);
        }
      }
      setFrame(Math.floor(frameRef.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [viewLayer, isPlaying, selectedTrackId, albumTracks]);

  React.useEffect(() => {
    if (viewLayer === "album") {
      setTracklistRendered(true);
    } else {
      const t = setTimeout(() => setTracklistRendered(false), 500);
      return () => clearTimeout(t);
    }
  }, [viewLayer]);

  const updateGalleryIndex = React.useCallback((nextIndex: number) => {
    if (!albumMockTracks.length) return;
    const next = clamp(nextIndex, 0, albumMockTracks.length - 1);
    setGalleryIndex(next);
    setSelectedAlbumId(albumMockTracks[Math.round(next)]?.id || albumMockTracks[0].id);
  }, [albumMockTracks]);

  const openAlbum = React.useCallback(async (albumId: string) => {
    const albumMeta = albums.find(a => a.id === albumId);
    
    if (albumMeta?._isFake) {
      const mappedTracks: AlbumGalleryTrack[] = Array.from({length: 12}).map((_, i) => ({
        id: `${albumId}-track-${i}`,
        index: i,
        title: `Track ${i + 1}`,
        artist: albumMeta.artist,
        themeColor: albumMeta._color || "#333",
        fps: 30,
        durationInFrames: 180 * 30,
        audioSrc: "",
        coverSrc: "",
        renderInput: {} as PublicRenderInput
      }));
      setAlbumTracks(mappedTracks);
      setSelectedAlbumId(albumId);
      setViewLayer("album");
      return;
    }

    try {
      const manifest = await fetchAlbumManifest(albumId);
      const mappedTracks: AlbumGalleryTrack[] = manifest.tracks.map((t, i) => ({
        id: t.filename,
        index: i,
        title: t.title,
        artist: manifest.artist,
        themeColor: "#333",
        fps: 30,
        durationInFrames: (t.duration || 180) * 30,
        audioSrc: getTrackAudioUrl(albumId, t.filename),
        coverSrc: getAlbumCoverUrl(albumId, t.cover || manifest.representativeCover || "cover.jpg"),
        renderInput: {} as PublicRenderInput
      }));
      setAlbumTracks(mappedTracks);
      setSelectedAlbumId(albumId);
      setViewLayer("album");
    } catch (err) {
      console.error(err);
    }
  }, [albums]);

  const openTrack = React.useCallback((trackId: string) => {
    setSelectedTrackId(trackId);
    setViewLayer("player");
    setIsPlaying(true);
    frameRef.current = 0;
    setFrame(0);
  }, []);

  const backToGallery = React.useCallback(() => {
    if (viewLayer === "player") {
      setViewLayer("album");
      frameRef.current = 0;
      setFrame(0);
    } else if (viewLayer === "album") {
      setViewLayer("gallery");
    }
  }, [viewLayer]);

  const togglePlay = React.useCallback(() => setIsPlaying(p => !p), []);
  
  const handleNextTrack = React.useCallback(() => {
    if (!albumTracks.length) return;
    const currentIndex = normalizeTrackIndex(albumTracks, selectedTrackId);
    const nextIndex = (currentIndex + 1) % albumTracks.length;
    setSelectedTrackId(albumTracks[nextIndex].id);
    frameRef.current = 0;
    setFrame(0);
  }, [albumTracks, selectedTrackId]);

  const handlePrevTrack = React.useCallback(() => {
    if (!albumTracks.length) return;
    const currentIndex = normalizeTrackIndex(albumTracks, selectedTrackId);
    const prevIndex = (currentIndex - 1 + albumTracks.length) % albumTracks.length;
    setSelectedTrackId(albumTracks[prevIndex].id);
    frameRef.current = 0;
    setFrame(0);
  }, [albumTracks, selectedTrackId]);

  const formatDuration = (frames: number) => {
    const totalSeconds = Math.floor(frames / 30);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!albums.length) {
    return (
      <main className="relative min-h-screen bg-[#f5f2ea] text-neutral-900">
        <div className="flex min-h-screen items-center justify-center p-8 text-center text-sm font-semibold text-neutral-500">
          Loading library...
        </div>
      </main>
    );
  }

  const selectedAlbumData = albums.find(a => a.id === selectedAlbumId);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5f2ea] text-neutral-900 font-sans">
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} onEnded={handleNextTrack} />
      
      {viewLayer !== "player" && (
        <Link className="absolute left-5 top-5 z-50 rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm backdrop-blur-xl hover:text-neutral-950 transition-colors" to="/studio">Studio</Link>
      )}
      
      {(viewLayer === "gallery" || viewLayer === "album" || tracklistRendered) && (
        <div className={`absolute inset-0 transition-transform duration-700 cubic-bezier(0.16, 1, 0.3, 1) ${viewLayer === "album" ? "-translate-x-1/4 scale-95 opacity-80" : "translate-x-0 scale-100 opacity-100"}`}>
          <AlbumGalleryExperience
            tracks={albumMockTracks}
            selectedTrackId={selectedAlbumId}
            frame={0}
            fps={30}
            galleryIndex={galleryIndex}
            playerOpen={false}
            showPreviewChrome={false}
            isPlaying={false}
            onGalleryIndexChange={updateGalleryIndex}
            onSelectTrack={setSelectedAlbumId}
            onOpenTrack={openAlbum}
            onBackToGallery={() => {}}
          />
        </div>
      )}

      {(viewLayer === "album" || tracklistRendered) && (
        <div 
          className={`absolute inset-y-0 right-0 w-[500px] max-w-full bg-white/40 backdrop-blur-[60px] border-l border-white/50 shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col z-40
            ${viewLayer === "album" ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
        >
          <div className="flex-none p-8 pt-20">
            <button 
              onClick={backToGallery} 
              className="group mb-8 flex items-center gap-2 text-sm font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-black/5 group-hover:bg-black/10 transition-colors">&larr;</span>
              Back to Gallery
            </button>
            
            <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 mb-2 leading-tight">
              {selectedAlbumData?.album}
            </h1>
            <p className="text-lg font-medium text-neutral-500 mb-6">
              {selectedAlbumData?.artist} &middot; {selectedAlbumData?.trackCount} tracks
            </p>
            
            <button 
              onClick={() => albumTracks.length > 0 && openTrack(albumTracks[0].id)}
              className="w-full rounded-2xl bg-neutral-900 py-4 text-sm font-bold text-white shadow-xl hover:bg-neutral-800 hover:scale-[1.02] active:scale-95 transition-all"
            >
              Play Album
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-1 mask-image-b">
            {albumTracks.map((t, i) => (
              <div 
                key={t.id} 
                onClick={() => openTrack(t.id)}
                className="group flex cursor-pointer items-center gap-4 rounded-xl p-3 hover:bg-white/60 transition-all hover:shadow-sm"
              >
                <div className="w-8 text-center text-sm font-bold text-neutral-400 group-hover:text-neutral-900">
                  {i + 1}
                </div>
                {t.coverSrc ? (
                  <img src={t.coverSrc} className="h-10 w-10 rounded-md object-cover shadow-sm" />
                ) : (
                  <div 
                    className="h-10 w-10 flex items-center justify-center rounded-md shadow-sm text-xs font-bold text-white/90"
                    style={{backgroundColor: t.themeColor}}
                  >
                    {t.title.slice(0,2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 truncate">
                  <div className="truncate text-sm font-bold text-neutral-900 group-hover:text-neutral-950">{t.title}</div>
                  <div className="truncate text-xs font-semibold text-neutral-500">{t.artist}</div>
                </div>
                <div className="text-xs font-semibold text-neutral-400 group-hover:text-neutral-600">
                  {formatDuration(t.durationInFrames)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewLayer === "player" && (
        <div className="absolute inset-0 z-50 animate-in fade-in zoom-in-95 duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
          <AlbumGalleryExperience
            tracks={albumTracks}
            selectedTrackId={selectedTrackId}
            frame={frame}
            fps={30}
            galleryIndex={normalizeTrackIndex(albumTracks, selectedTrackId)}
            playerOpen={true}
            showPreviewChrome={true}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            onPreviousTrack={handlePrevTrack}
            onNextTrack={handleNextTrack}
            onGalleryIndexChange={() => {}}
            onSelectTrack={setSelectedTrackId}
            onOpenTrack={() => {}}
            onBackToGallery={backToGallery}
          />
        </div>
      )}
    </main>
  );
};
