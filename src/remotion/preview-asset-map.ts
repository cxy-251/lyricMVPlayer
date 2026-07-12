import type {AudioFeatureTrack} from "@lyric-mv/lyric-video";
import type {PreviewAssetMap, RawRenderInput, SelectedPreviewSongData} from "./preview-library/types";
import selectedAudioFeatures from "../../artifacts/songs/Never Goes Away - Claire Rosinkranz - LPSPUFeNQ0I/audio-features.json";
import selectedRenderInput from "../../artifacts/songs/Never Goes Away - Claire Rosinkranz - LPSPUFeNQ0I/render-input.json";

const loadJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load preview song data: ${response.status} ${url}`);
  }
  return (await response.json()) as T;
};

export const selectedSongData: SelectedPreviewSongData = {
  id: "Never Goes Away - Claire Rosinkranz - LPSPUFeNQ0I",
  renderInput: selectedRenderInput as RawRenderInput,
  audioFeatures: selectedAudioFeatures as AudioFeatureTrack,
};

export const previewAssetMap: PreviewAssetMap = {
  "Never Goes Away - Claire Rosinkranz - LPSPUFeNQ0I": {
    audioSrc: new URL("../../artifacts/songs/Never Goes Away - Claire Rosinkranz - LPSPUFeNQ0I/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Never Goes Away - Claire Rosinkranz - LPSPUFeNQ0I/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Never Goes Away - Claire Rosinkranz - LPSPUFeNQ0I/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Never Goes Away - Claire Rosinkranz - LPSPUFeNQ0I/audio-features.json", import.meta.url).href)
  }
};
