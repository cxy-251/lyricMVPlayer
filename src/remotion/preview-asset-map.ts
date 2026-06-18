import type {AudioFeatureTrack} from "../../modules/render-core/src";
import type {PreviewAssetMap, RawRenderInput, SelectedPreviewSongData} from "./preview-library/types";
import selectedAudioFeatures from "../../artifacts/songs/Blank Space (Taylor's Version) - Taylor Swift - -MtKC5wXqdQ/audio-features.json";
import selectedRenderInput from "../../artifacts/songs/Blank Space (Taylor's Version) - Taylor Swift - -MtKC5wXqdQ/render-input.json";

const loadJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load preview song data: ${response.status} ${url}`);
  }
  return (await response.json()) as T;
};

export const selectedSongData: SelectedPreviewSongData = {
  id: "Blank Space (Taylor's Version) - Taylor Swift - -MtKC5wXqdQ",
  renderInput: selectedRenderInput as RawRenderInput,
  audioFeatures: selectedAudioFeatures as AudioFeatureTrack,
};

export const previewAssetMap: PreviewAssetMap = {
  "Blank Space (Taylor's Version) - Taylor Swift - -MtKC5wXqdQ": {
    audioSrc: new URL("../../artifacts/songs/Blank Space (Taylor's Version) - Taylor Swift - -MtKC5wXqdQ/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Blank Space (Taylor's Version) - Taylor Swift - -MtKC5wXqdQ/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Blank Space (Taylor's Version) - Taylor Swift - -MtKC5wXqdQ/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Blank Space (Taylor's Version) - Taylor Swift - -MtKC5wXqdQ/audio-features.json", import.meta.url).href)
  }
};
