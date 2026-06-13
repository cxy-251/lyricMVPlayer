import type {AudioFeatureTrack} from "../../modules/render-core/src";
import type {PreviewAssetMap, RawRenderInput, SelectedPreviewSongData} from "./preview-library/types";
import selectedAudioFeatures from "../../artifacts/songs/Like I'm Gonna Lose You - Meghan Trainor - b2gTGEeB12w/audio-features.json";
import selectedRenderInput from "../../artifacts/songs/Like I'm Gonna Lose You - Meghan Trainor - b2gTGEeB12w/render-input.json";

const loadJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load preview song data: ${response.status} ${url}`);
  }
  return (await response.json()) as T;
};

export const selectedSongData: SelectedPreviewSongData = {
  id: "Like I'm Gonna Lose You - Meghan Trainor - b2gTGEeB12w",
  renderInput: selectedRenderInput as RawRenderInput,
  audioFeatures: selectedAudioFeatures as AudioFeatureTrack,
};

export const previewAssetMap: PreviewAssetMap = {
  "Like I'm Gonna Lose You - Meghan Trainor - b2gTGEeB12w": {
    audioSrc: new URL("../../artifacts/songs/Like I'm Gonna Lose You - Meghan Trainor - b2gTGEeB12w/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Like I'm Gonna Lose You - Meghan Trainor - b2gTGEeB12w/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Like I'm Gonna Lose You - Meghan Trainor - b2gTGEeB12w/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Like I'm Gonna Lose You - Meghan Trainor - b2gTGEeB12w/audio-features.json", import.meta.url).href)
  }
};
