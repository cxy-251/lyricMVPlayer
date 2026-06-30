export type AlbumGalleryTrack = {
  id: string;
  title: string;
  artist: string;
  coverSrc?: string;
  audioSrc: string;
  durationInFrames: number;
  fps: number;
  themeColor: string;
};

export type AlbumGalleryCompositionProps = {
  selectedTrackId: string;
  tracks?: AlbumGalleryTrack[];
  fps?: number;
};

export type AlbumGalleryTimeline = {
  galleryIntroFrames: number;
  slideToTrackFrames: number;
  enterPlayerFrames: number;
  audioFrames: number;
  returnGalleryFrames: number;
  audioStartFrame: number;
  returnStartFrame: number;
  totalFrames: number;
};

export type PublicLibraryManifestSong = {
  id: string;
  title: string;
  artist: string;
  renderInputUrl: string;
  audioFeaturesUrl: string;
  assetStatus?: {
    audio?: boolean;
    audioFeatures?: boolean;
    background?: boolean;
    lyrics?: boolean;
    renderInput?: boolean;
  };
};

export type PublicLibraryManifest = {
  currentSongDirName: string;
  songs: PublicLibraryManifestSong[];
};

export type PublicRenderInput = {
  title?: string;
  artist?: string;
  audioSrc?: string;
  durationInFrames?: number;
  fps?: number;
  background?: {
    kind?: string;
    src?: string;
    color?: string | null;
  };
};
