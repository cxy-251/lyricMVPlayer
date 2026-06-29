import type {AudioFeatureTrack} from "@lyric-mv/lyric-video";
import type {PreviewAssetMap, RawRenderInput, SelectedPreviewSongData} from "./preview-library/types";
import selectedAudioFeatures from "../../artifacts/songs/White Flag - Claire Cottrill - aR-HiYvqS_A/audio-features.json";
import selectedRenderInput from "../../artifacts/songs/White Flag - Claire Cottrill - aR-HiYvqS_A/render-input.json";

const loadJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load preview song data: ${response.status} ${url}`);
  }
  return (await response.json()) as T;
};

export const selectedSongData: SelectedPreviewSongData = {
  id: "White Flag - Claire Cottrill - aR-HiYvqS_A",
  renderInput: selectedRenderInput as RawRenderInput,
  audioFeatures: selectedAudioFeatures as AudioFeatureTrack,
};

export const previewAssetMap: PreviewAssetMap = {
  "White Flag - Claire Cottrill - aR-HiYvqS_A": {
    audioSrc: new URL("../../artifacts/songs/White Flag - Claire Cottrill - aR-HiYvqS_A/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/White Flag - Claire Cottrill - aR-HiYvqS_A/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/White Flag - Claire Cottrill - aR-HiYvqS_A/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/White Flag - Claire Cottrill - aR-HiYvqS_A/audio-features.json", import.meta.url).href)
  }
};
