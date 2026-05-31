import type {AudioFeatureTrack} from "../../modules/render-core/src";

import audioSrc0 from "../../artifacts/songs/Likeable - Mina Okabe - 7Tgugf1-ymA/audio.mp3";
import rawAudioFeatures0 from "../../artifacts/songs/Likeable - Mina Okabe - 7Tgugf1-ymA/audio-features.json";
import backgroundSrc0 from "../../artifacts/songs/Likeable - Mina Okabe - 7Tgugf1-ymA/background.png";

export const previewAssetMap: Record<string, {audioSrc: string; audioFeatures?: AudioFeatureTrack; backgroundSrc?: string}> = {
  "Likeable - Mina Okabe - 7Tgugf1-ymA": {
    audioSrc: audioSrc0,
    audioFeatures: rawAudioFeatures0 as AudioFeatureTrack,
    backgroundSrc: backgroundSrc0
  }
};
