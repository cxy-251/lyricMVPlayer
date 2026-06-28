import type {AudioFeatureTrack} from "@lyric-mv/lyric-video";
import type {PreviewAssetMap, RawRenderInput, SelectedPreviewSongData} from "./preview-library/types";
import selectedAudioFeatures from "../../artifacts/songs/Cruel Summer - Taylor Swift - aC9HkZW2hZk/audio-features.json";
import selectedRenderInput from "../../artifacts/songs/Cruel Summer - Taylor Swift - aC9HkZW2hZk/render-input.json";

const loadJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load preview song data: ${response.status} ${url}`);
  }
  return (await response.json()) as T;
};

export const selectedSongData: SelectedPreviewSongData = {
  id: "Cruel Summer - Taylor Swift - aC9HkZW2hZk",
  renderInput: selectedRenderInput as RawRenderInput,
  audioFeatures: selectedAudioFeatures as AudioFeatureTrack,
};

export const previewAssetMap: PreviewAssetMap = {
  "Cruel Summer - Taylor Swift - aC9HkZW2hZk": {
    audioSrc: new URL("../../artifacts/songs/Cruel Summer - Taylor Swift - aC9HkZW2hZk/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Cruel Summer - Taylor Swift - aC9HkZW2hZk/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Cruel Summer - Taylor Swift - aC9HkZW2hZk/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Cruel Summer - Taylor Swift - aC9HkZW2hZk/audio-features.json", import.meta.url).href)
  }
};
