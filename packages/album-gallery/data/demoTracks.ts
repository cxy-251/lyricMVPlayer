import blankRenderInput from "../../../artifacts/songs/Blank Space (Taylor's Version) - Taylor Swift - -MtKC5wXqdQ/render-input.json";
import goodGracesRenderInput from "../../../artifacts/songs/Good Graces - Sabrina Carpenter - Fq_LG6SPSFU/render-input.json";
import peopleYouKnowRenderInput from "../../../artifacts/songs/People You Know - Selena Gomez - o6RkncuPKT0/render-input.json";
import loseYouRenderInput from "../../../artifacts/songs/Like I'm Gonna Lose You - Meghan Trainor - b2gTGEeB12w/render-input.json";
import timeTravelingRenderInput from "../../../artifacts/songs/Time Traveling - Anthony Lazaro - pzYFPxEXSU8/render-input.json";
import alrightRenderInput from "../../../artifacts/songs/Alright - Couch - yjzNbYpPOKE/render-input.json";
import youDearRenderInput from "../../../artifacts/songs/You- Dear - Eloise - SpDVSZIbQms/render-input.json";
import adventureRenderInput from "../../../artifacts/songs/Adventure with You (feat. Cy Leo) - Sarah Kang Music - wI33QEo2SbQ/render-input.json";
import stumblinRenderInput from "../../../artifacts/songs/Stumblin' in (Acoustic Cover) - Audrey Stclair Acoustic Covers on Spotify - dqsxlYtWM-k/render-input.json";
import worthItRenderInput from "../../../artifacts/songs/Worth It. - RAYE - Y4_l-9Uxvhg/render-input.json";

import {createAlbumTrack} from "./albumTracks";
import type {AlbumGalleryTrack, PublicRenderInput} from "../types";

const demoDefs = [
  {
    id: "Blank Space (Taylor's Version) - Taylor Swift - -MtKC5wXqdQ",
    renderInput: blankRenderInput,
    audioSrc: new URL("../../../artifacts/songs/Blank Space (Taylor's Version) - Taylor Swift - -MtKC5wXqdQ/audio.mp3", import.meta.url).href,
    coverSrc: new URL("../../../artifacts/songs/Blank Space (Taylor's Version) - Taylor Swift - -MtKC5wXqdQ/background.png", import.meta.url).href,
  },
  {
    id: "Good Graces - Sabrina Carpenter - Fq_LG6SPSFU",
    renderInput: goodGracesRenderInput,
    audioSrc: new URL("../../../artifacts/songs/Good Graces - Sabrina Carpenter - Fq_LG6SPSFU/audio.mp3", import.meta.url).href,
    coverSrc: new URL("../../../artifacts/songs/Good Graces - Sabrina Carpenter - Fq_LG6SPSFU/background.png", import.meta.url).href,
  },
  {
    id: "People You Know - Selena Gomez - o6RkncuPKT0",
    renderInput: peopleYouKnowRenderInput,
    audioSrc: new URL("../../../artifacts/songs/People You Know - Selena Gomez - o6RkncuPKT0/audio.mp3", import.meta.url).href,
    coverSrc: new URL("../../../artifacts/songs/People You Know - Selena Gomez - o6RkncuPKT0/background.png", import.meta.url).href,
  },
  {
    id: "Like I'm Gonna Lose You - Meghan Trainor - b2gTGEeB12w",
    renderInput: loseYouRenderInput,
    audioSrc: new URL("../../../artifacts/songs/Like I'm Gonna Lose You - Meghan Trainor - b2gTGEeB12w/audio.mp3", import.meta.url).href,
    coverSrc: new URL("../../../artifacts/songs/Like I'm Gonna Lose You - Meghan Trainor - b2gTGEeB12w/background.png", import.meta.url).href,
  },
  {
    id: "Time Traveling - Anthony Lazaro - pzYFPxEXSU8",
    renderInput: timeTravelingRenderInput,
    audioSrc: new URL("../../../artifacts/songs/Time Traveling - Anthony Lazaro - pzYFPxEXSU8/audio.mp3", import.meta.url).href,
    coverSrc: new URL("../../../artifacts/songs/Time Traveling - Anthony Lazaro - pzYFPxEXSU8/background.png", import.meta.url).href,
  },
  {
    id: "Alright - Couch - yjzNbYpPOKE",
    renderInput: alrightRenderInput,
    audioSrc: new URL("../../../artifacts/songs/Alright - Couch - yjzNbYpPOKE/audio.mp3", import.meta.url).href,
    coverSrc: new URL("../../../artifacts/songs/Alright - Couch - yjzNbYpPOKE/background.png", import.meta.url).href,
  },
  {
    id: "You- Dear - Eloise - SpDVSZIbQms",
    renderInput: youDearRenderInput,
    audioSrc: new URL("../../../artifacts/songs/You- Dear - Eloise - SpDVSZIbQms/audio.mp3", import.meta.url).href,
    coverSrc: new URL("../../../artifacts/songs/You- Dear - Eloise - SpDVSZIbQms/background.png", import.meta.url).href,
  },
  {
    id: "Adventure with You (feat. Cy Leo) - Sarah Kang Music - wI33QEo2SbQ",
    renderInput: adventureRenderInput,
    audioSrc: new URL("../../../artifacts/songs/Adventure with You (feat. Cy Leo) - Sarah Kang Music - wI33QEo2SbQ/audio.mp3", import.meta.url).href,
    coverSrc: new URL("../../../artifacts/songs/Adventure with You (feat. Cy Leo) - Sarah Kang Music - wI33QEo2SbQ/background.png", import.meta.url).href,
  },
  {
    id: "Stumblin' in (Acoustic Cover) - Audrey Stclair Acoustic Covers on Spotify - dqsxlYtWM-k",
    renderInput: stumblinRenderInput,
    audioSrc: new URL("../../../artifacts/songs/Stumblin' in (Acoustic Cover) - Audrey Stclair Acoustic Covers on Spotify - dqsxlYtWM-k/audio.mp3", import.meta.url).href,
    coverSrc: new URL("../../../artifacts/songs/Stumblin' in (Acoustic Cover) - Audrey Stclair Acoustic Covers on Spotify - dqsxlYtWM-k/background.png", import.meta.url).href,
  },
  {
    id: "Worth It. - RAYE - Y4_l-9Uxvhg",
    renderInput: worthItRenderInput,
    audioSrc: new URL("../../../artifacts/songs/Worth It. - RAYE - Y4_l-9Uxvhg/audio.mp3", import.meta.url).href,
    coverSrc: new URL("../../../artifacts/songs/Worth It. - RAYE - Y4_l-9Uxvhg/background.png", import.meta.url).href,
  },
] as const;

export const demoAlbumTracks: AlbumGalleryTrack[] = demoDefs.map((definition, index) => ({
  ...createAlbumTrack({
    id: definition.id,
    index,
    renderInput: definition.renderInput as PublicRenderInput,
  }),
  audioSrc: definition.audioSrc,
  coverSrc: definition.coverSrc,
}));

export const defaultAlbumGalleryTrackId = demoAlbumTracks[0].id;
