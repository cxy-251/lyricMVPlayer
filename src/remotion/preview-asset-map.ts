import type {AudioFeatureTrack} from "../../modules/render-core/src";
import type {PreviewAssetMap, RawRenderInput, SelectedPreviewSongData} from "./preview-library/types";
import selectedAudioFeatures from "../../artifacts/songs/Likeable - Mina Okabe - 7Tgugf1-ymA/audio-features.json";
import selectedRenderInput from "../../artifacts/songs/Likeable - Mina Okabe - 7Tgugf1-ymA/render-input.json";

const loadJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load preview song data: ${response.status} ${url}`);
  }
  return (await response.json()) as T;
};

export const selectedSongData: SelectedPreviewSongData = {
  id: "Likeable - Mina Okabe - 7Tgugf1-ymA",
  renderInput: selectedRenderInput as RawRenderInput,
  audioFeatures: selectedAudioFeatures as AudioFeatureTrack,
};

export const previewAssetMap: PreviewAssetMap = {
  "Likeable - Mina Okabe - 7Tgugf1-ymA": {
    audioSrc: new URL("../../artifacts/songs/Likeable - Mina Okabe - 7Tgugf1-ymA/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Likeable - Mina Okabe - 7Tgugf1-ymA/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Likeable - Mina Okabe - 7Tgugf1-ymA/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Likeable - Mina Okabe - 7Tgugf1-ymA/audio-features.json", import.meta.url).href)
  },
  "Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ": {
    audioSrc: new URL("../../artifacts/songs/Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Never Gonna Give You Up (Official Video) (4K Remaster) - Rick Astley - dQw4w9WgXcQ/audio-features.json", import.meta.url).href)
  },
  "Take On Me (Official Video) [4K] - a-ha - djV11Xbc914": {
    audioSrc: new URL("../../artifacts/songs/Take On Me (Official Video) [4K] - a-ha - djV11Xbc914/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Take On Me (Official Video) [4K] - a-ha - djV11Xbc914/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Take On Me (Official Video) [4K] - a-ha - djV11Xbc914/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Take On Me (Official Video) [4K] - a-ha - djV11Xbc914/audio-features.json", import.meta.url).href)
  },
  "I Want It That Way (Official HD Video) - Backstreet Boys - 4fndeDfaWCg": {
    audioSrc: new URL("../../artifacts/songs/I Want It That Way (Official HD Video) - Backstreet Boys - 4fndeDfaWCg/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/I Want It That Way (Official HD Video) - Backstreet Boys - 4fndeDfaWCg/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/I Want It That Way (Official HD Video) - Backstreet Boys - 4fndeDfaWCg/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/I Want It That Way (Official HD Video) - Backstreet Boys - 4fndeDfaWCg/audio-features.json", import.meta.url).href)
  },
  "Hey There Delilah - Plain White Ts - oEeet9t--tI": {
    audioSrc: new URL("../../artifacts/songs/Hey There Delilah - Plain White Ts - oEeet9t--tI/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Hey There Delilah - Plain White Ts - oEeet9t--tI/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Hey There Delilah - Plain White Ts - oEeet9t--tI/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Hey There Delilah - Plain White Ts - oEeet9t--tI/audio-features.json", import.meta.url).href)
  },
  "From The Start (Official Music Video) - Laufey - lSD_L-xic9o": {
    audioSrc: new URL("../../artifacts/songs/From The Start (Official Music Video) - Laufey - lSD_L-xic9o/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/From The Start (Official Music Video) - Laufey - lSD_L-xic9o/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/From The Start (Official Music Video) - Laufey - lSD_L-xic9o/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/From The Start (Official Music Video) - Laufey - lSD_L-xic9o/audio-features.json", import.meta.url).href)
  },
  "Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY": {
    audioSrc: new URL("../../artifacts/songs/Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Be Around Me (feat. chloe moriondo) - Will Joseph Cook - TtEG06uuJKY/audio-features.json", import.meta.url).href)
  },
  "24 - sundial - Topic - wlg7dhAJkrA": {
    audioSrc: new URL("../../artifacts/songs/24 - sundial - Topic - wlg7dhAJkrA/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/24 - sundial - Topic - wlg7dhAJkrA/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/24 - sundial - Topic - wlg7dhAJkrA/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/24 - sundial - Topic - wlg7dhAJkrA/audio-features.json", import.meta.url).href)
  },
  "If We Ever Broke Up (Official Video) - Mae Stephens - TbGT3d0pHgo": {
    audioSrc: new URL("../../artifacts/songs/If We Ever Broke Up (Official Video) - Mae Stephens - TbGT3d0pHgo/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/If We Ever Broke Up (Official Video) - Mae Stephens - TbGT3d0pHgo/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/If We Ever Broke Up (Official Video) - Mae Stephens - TbGT3d0pHgo/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/If We Ever Broke Up (Official Video) - Mae Stephens - TbGT3d0pHgo/audio-features.json", import.meta.url).href)
  },
  "Rema - Selena Gomez - Calm Down (Official Music Video) - Selena Gomez - WcIcVapfqXw": {
    audioSrc: new URL("../../artifacts/songs/Rema - Selena Gomez - Calm Down (Official Music Video) - Selena Gomez - WcIcVapfqXw/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Rema - Selena Gomez - Calm Down (Official Music Video) - Selena Gomez - WcIcVapfqXw/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Rema - Selena Gomez - Calm Down (Official Music Video) - Selena Gomez - WcIcVapfqXw/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Rema - Selena Gomez - Calm Down (Official Music Video) - Selena Gomez - WcIcVapfqXw/audio-features.json", import.meta.url).href)
  },
  "blue - yung kai - MHCsrKA9gh8": {
    audioSrc: new URL("../../artifacts/songs/blue - yung kai - MHCsrKA9gh8/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/blue - yung kai - MHCsrKA9gh8/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/blue - yung kai - MHCsrKA9gh8/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/blue - yung kai - MHCsrKA9gh8/audio-features.json", import.meta.url).href)
  },
  "I Got Better - Morgan Wallen - Xc-dEsMbQJM": {
    audioSrc: new URL("../../artifacts/songs/I Got Better - Morgan Wallen - Xc-dEsMbQJM/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/I Got Better - Morgan Wallen - Xc-dEsMbQJM/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/I Got Better - Morgan Wallen - Xc-dEsMbQJM/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/I Got Better - Morgan Wallen - Xc-dEsMbQJM/audio-features.json", import.meta.url).href)
  },
  "Towards The Sun (From The -Home- Soundtrack) - Rihanna - mhPDe4IyqeU": {
    audioSrc: new URL("../../artifacts/songs/Towards The Sun (From The -Home- Soundtrack) - Rihanna - mhPDe4IyqeU/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Towards The Sun (From The -Home- Soundtrack) - Rihanna - mhPDe4IyqeU/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Towards The Sun (From The -Home- Soundtrack) - Rihanna - mhPDe4IyqeU/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Towards The Sun (From The -Home- Soundtrack) - Rihanna - mhPDe4IyqeU/audio-features.json", import.meta.url).href)
  },
  "Made You Look (Official Music Video) - Meghan Trainor - gPCCYMeXin0": {
    audioSrc: new URL("../../artifacts/songs/Made You Look (Official Music Video) - Meghan Trainor - gPCCYMeXin0/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Made You Look (Official Music Video) - Meghan Trainor - gPCCYMeXin0/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Made You Look (Official Music Video) - Meghan Trainor - gPCCYMeXin0/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Made You Look (Official Music Video) - Meghan Trainor - gPCCYMeXin0/audio-features.json", import.meta.url).href)
  },
  "Price Tag - Jessie J - 5rcmr-eX2-Y": {
    audioSrc: new URL("../../artifacts/songs/Price Tag - Jessie J - 5rcmr-eX2-Y/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Price Tag - Jessie J - 5rcmr-eX2-Y/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Price Tag - Jessie J - 5rcmr-eX2-Y/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Price Tag - Jessie J - 5rcmr-eX2-Y/audio-features.json", import.meta.url).href)
  },
  "Without Me - Halsey - Tk7WFyHUr1E": {
    audioSrc: new URL("../../artifacts/songs/Without Me - Halsey - Tk7WFyHUr1E/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Without Me - Halsey - Tk7WFyHUr1E/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Without Me - Halsey - Tk7WFyHUr1E/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Without Me - Halsey - Tk7WFyHUr1E/audio-features.json", import.meta.url).href)
  },
  "Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY": {
    audioSrc: new URL("../../artifacts/songs/Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Run Wild (向风而野) - 是晚星呀 - Topic - bHPwcS2IquY/audio-features.json", import.meta.url).href)
  },
  "Drama King - Bellah Mae - zlF-KFWf6c4": {
    audioSrc: new URL("../../artifacts/songs/Drama King - Bellah Mae - zlF-KFWf6c4/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Drama King - Bellah Mae - zlF-KFWf6c4/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Drama King - Bellah Mae - zlF-KFWf6c4/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Drama King - Bellah Mae - zlF-KFWf6c4/audio-features.json", import.meta.url).href)
  },
  "Shivers (Acoustic Version) - Ed Sheeran - IunRmLHucC4": {
    audioSrc: new URL("../../artifacts/songs/Shivers (Acoustic Version) - Ed Sheeran - IunRmLHucC4/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Shivers (Acoustic Version) - Ed Sheeran - IunRmLHucC4/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Shivers (Acoustic Version) - Ed Sheeran - IunRmLHucC4/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Shivers (Acoustic Version) - Ed Sheeran - IunRmLHucC4/audio-features.json", import.meta.url).href)
  },
  "Call Me Maybe - Carly Rae Jepsen - fWNaR-rxAic": {
    audioSrc: new URL("../../artifacts/songs/Call Me Maybe - Carly Rae Jepsen - fWNaR-rxAic/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Call Me Maybe - Carly Rae Jepsen - fWNaR-rxAic/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Call Me Maybe - Carly Rae Jepsen - fWNaR-rxAic/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Call Me Maybe - Carly Rae Jepsen - fWNaR-rxAic/audio-features.json", import.meta.url).href)
  },
  "Pump It - Black Eyed Peas - d77gTBvX0K8": {
    audioSrc: new URL("../../artifacts/songs/Pump It - Black Eyed Peas - d77gTBvX0K8/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Pump It - Black Eyed Peas - d77gTBvX0K8/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Pump It - Black Eyed Peas - d77gTBvX0K8/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Pump It - Black Eyed Peas - d77gTBvX0K8/audio-features.json", import.meta.url).href)
  },
  "What Makes You Beautiful - One Direction - d57qSDCxVA4": {
    audioSrc: new URL("../../artifacts/songs/What Makes You Beautiful - One Direction - d57qSDCxVA4/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/What Makes You Beautiful - One Direction - d57qSDCxVA4/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/What Makes You Beautiful - One Direction - d57qSDCxVA4/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/What Makes You Beautiful - One Direction - d57qSDCxVA4/audio-features.json", import.meta.url).href)
  },
  "My Humps - Black Eyed Peas - opnZlnd3d7U": {
    audioSrc: new URL("../../artifacts/songs/My Humps - Black Eyed Peas - opnZlnd3d7U/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/My Humps - Black Eyed Peas - opnZlnd3d7U/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/My Humps - Black Eyed Peas - opnZlnd3d7U/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/My Humps - Black Eyed Peas - opnZlnd3d7U/audio-features.json", import.meta.url).href)
  },
  "Party In The U.S.A. - Miley Cyrus - R1kOdTm9FBk": {
    audioSrc: new URL("../../artifacts/songs/Party In The U.S.A. - Miley Cyrus - R1kOdTm9FBk/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Party In The U.S.A. - Miley Cyrus - R1kOdTm9FBk/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Party In The U.S.A. - Miley Cyrus - R1kOdTm9FBk/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Party In The U.S.A. - Miley Cyrus - R1kOdTm9FBk/audio-features.json", import.meta.url).href)
  },
  "Just the Way You Are - Bruno Mars - GnUW4AF1LZo": {
    audioSrc: new URL("../../artifacts/songs/Just the Way You Are - Bruno Mars - GnUW4AF1LZo/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Just the Way You Are - Bruno Mars - GnUW4AF1LZo/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Just the Way You Are - Bruno Mars - GnUW4AF1LZo/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Just the Way You Are - Bruno Mars - GnUW4AF1LZo/audio-features.json", import.meta.url).href)
  },
  "We Don't Talk Anymore (feat. Selena Gomez) - Charlie Puth - yN6JgL0IUJg": {
    audioSrc: new URL("../../artifacts/songs/We Don't Talk Anymore (feat. Selena Gomez) - Charlie Puth - yN6JgL0IUJg/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/We Don't Talk Anymore (feat. Selena Gomez) - Charlie Puth - yN6JgL0IUJg/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/We Don't Talk Anymore (feat. Selena Gomez) - Charlie Puth - yN6JgL0IUJg/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/We Don't Talk Anymore (feat. Selena Gomez) - Charlie Puth - yN6JgL0IUJg/audio-features.json", import.meta.url).href)
  },
  "Ho Hey (Official Video) - The Lumineers - zvCBSSwgtg4": {
    audioSrc: new URL("../../artifacts/songs/Ho Hey (Official Video) - The Lumineers - zvCBSSwgtg4/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Ho Hey (Official Video) - The Lumineers - zvCBSSwgtg4/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Ho Hey (Official Video) - The Lumineers - zvCBSSwgtg4/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Ho Hey (Official Video) - The Lumineers - zvCBSSwgtg4/audio-features.json", import.meta.url).href)
  },
  "2002 [Official Video] - Anne-Marie - Il-an3K9pjg": {
    audioSrc: new URL("../../artifacts/songs/2002 [Official Video] - Anne-Marie - Il-an3K9pjg/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/2002 [Official Video] - Anne-Marie - Il-an3K9pjg/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/2002 [Official Video] - Anne-Marie - Il-an3K9pjg/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/2002 [Official Video] - Anne-Marie - Il-an3K9pjg/audio-features.json", import.meta.url).href)
  },
  "Mad at Disney - salem ilese - 4cLaxFWT9iI": {
    audioSrc: new URL("../../artifacts/songs/Mad at Disney - salem ilese - 4cLaxFWT9iI/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Mad at Disney - salem ilese - 4cLaxFWT9iI/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Mad at Disney - salem ilese - 4cLaxFWT9iI/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Mad at Disney - salem ilese - 4cLaxFWT9iI/audio-features.json", import.meta.url).href)
  },
  "Backyard Boy - Claire Rosinkranz - 72L5HWbutzI": {
    audioSrc: new URL("../../artifacts/songs/Backyard Boy - Claire Rosinkranz - 72L5HWbutzI/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Backyard Boy - Claire Rosinkranz - 72L5HWbutzI/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Backyard Boy - Claire Rosinkranz - 72L5HWbutzI/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Backyard Boy - Claire Rosinkranz - 72L5HWbutzI/audio-features.json", import.meta.url).href)
  },
  "Cheap Thrills - Sia - K_idN3P5_yk": {
    audioSrc: new URL("../../artifacts/songs/Cheap Thrills - Sia - K_idN3P5_yk/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Cheap Thrills - Sia - K_idN3P5_yk/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Cheap Thrills - Sia - K_idN3P5_yk/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Cheap Thrills - Sia - K_idN3P5_yk/audio-features.json", import.meta.url).href)
  },
  "girls like me don't cry - thủy - T4gmE2nHA_M": {
    audioSrc: new URL("../../artifacts/songs/girls like me don't cry - thủy - T4gmE2nHA_M/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/girls like me don't cry - thủy - T4gmE2nHA_M/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/girls like me don't cry - thủy - T4gmE2nHA_M/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/girls like me don't cry - thủy - T4gmE2nHA_M/audio-features.json", import.meta.url).href)
  },
  "Hotel - Claire Rosinkranz - R5dAVAkwpUU": {
    audioSrc: new URL("../../artifacts/songs/Hotel - Claire Rosinkranz - R5dAVAkwpUU/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Hotel - Claire Rosinkranz - R5dAVAkwpUU/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Hotel - Claire Rosinkranz - R5dAVAkwpUU/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Hotel - Claire Rosinkranz - R5dAVAkwpUU/audio-features.json", import.meta.url).href)
  },
  "Are You Bored Yet- (feat. Clairo) - Wallows - nt4_p9Pz0RI": {
    audioSrc: new URL("../../artifacts/songs/Are You Bored Yet- (feat. Clairo) - Wallows - nt4_p9Pz0RI/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Are You Bored Yet- (feat. Clairo) - Wallows - nt4_p9Pz0RI/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Are You Bored Yet- (feat. Clairo) - Wallows - nt4_p9Pz0RI/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Are You Bored Yet- (feat. Clairo) - Wallows - nt4_p9Pz0RI/audio-features.json", import.meta.url).href)
  },
  "Too Sweet (Official Video) - Hozier - NTpbbQUBbuo": {
    audioSrc: new URL("../../artifacts/songs/Too Sweet (Official Video) - Hozier - NTpbbQUBbuo/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Too Sweet (Official Video) - Hozier - NTpbbQUBbuo/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Too Sweet (Official Video) - Hozier - NTpbbQUBbuo/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Too Sweet (Official Video) - Hozier - NTpbbQUBbuo/audio-features.json", import.meta.url).href)
  },
  "Clairo - Sofia - Claire Cottrill - L9l8zCOwEII": {
    audioSrc: new URL("../../artifacts/songs/Clairo - Sofia - Claire Cottrill - L9l8zCOwEII/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Clairo - Sofia - Claire Cottrill - L9l8zCOwEII/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Clairo - Sofia - Claire Cottrill - L9l8zCOwEII/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Clairo - Sofia - Claire Cottrill - L9l8zCOwEII/audio-features.json", import.meta.url).href)
  },
  "Go Away (Official Music Video) - weezer - pnTIsubYbCU": {
    audioSrc: new URL("../../artifacts/songs/Go Away (Official Music Video) - weezer - pnTIsubYbCU/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Go Away (Official Music Video) - weezer - pnTIsubYbCU/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Go Away (Official Music Video) - weezer - pnTIsubYbCU/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Go Away (Official Music Video) - weezer - pnTIsubYbCU/audio-features.json", import.meta.url).href)
  },
  "One Thing - One Direction - Y1xs_xPb46M": {
    audioSrc: new URL("../../artifacts/songs/One Thing - One Direction - Y1xs_xPb46M/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/One Thing - One Direction - Y1xs_xPb46M/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/One Thing - One Direction - Y1xs_xPb46M/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/One Thing - One Direction - Y1xs_xPb46M/audio-features.json", import.meta.url).href)
  },
  "To All the Boys I’ve Loved Before - JAX - Sdf0UxuN7uY": {
    audioSrc: new URL("../../artifacts/songs/To All the Boys I’ve Loved Before - JAX - Sdf0UxuN7uY/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/To All the Boys I’ve Loved Before - JAX - Sdf0UxuN7uY/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/To All the Boys I’ve Loved Before - JAX - Sdf0UxuN7uY/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/To All the Boys I’ve Loved Before - JAX - Sdf0UxuN7uY/audio-features.json", import.meta.url).href)
  },
  "Billie Jean - Michael Jackson - 7CTJcHjkq0E": {
    audioSrc: new URL("../../artifacts/songs/Billie Jean - Michael Jackson - 7CTJcHjkq0E/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Billie Jean - Michael Jackson - 7CTJcHjkq0E/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Billie Jean - Michael Jackson - 7CTJcHjkq0E/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Billie Jean - Michael Jackson - 7CTJcHjkq0E/audio-features.json", import.meta.url).href)
  },
  "Who Says - Selena Gomez - m4p0WNN9p-Y": {
    audioSrc: new URL("../../artifacts/songs/Who Says - Selena Gomez - m4p0WNN9p-Y/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Who Says - Selena Gomez - m4p0WNN9p-Y/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Who Says - Selena Gomez - m4p0WNN9p-Y/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Who Says - Selena Gomez - m4p0WNN9p-Y/audio-features.json", import.meta.url).href)
  },
  "Sad Girl Summer - Maisie Peters - EKDEIlVUPjI": {
    audioSrc: new URL("../../artifacts/songs/Sad Girl Summer - Maisie Peters - EKDEIlVUPjI/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Sad Girl Summer - Maisie Peters - EKDEIlVUPjI/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Sad Girl Summer - Maisie Peters - EKDEIlVUPjI/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Sad Girl Summer - Maisie Peters - EKDEIlVUPjI/audio-features.json", import.meta.url).href)
  },
  "Dracula - Tame Impala - cuMuMnCRfqk": {
    audioSrc: new URL("../../artifacts/songs/Dracula - Tame Impala - cuMuMnCRfqk/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Dracula - Tame Impala - cuMuMnCRfqk/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Dracula - Tame Impala - cuMuMnCRfqk/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Dracula - Tame Impala - cuMuMnCRfqk/audio-features.json", import.meta.url).href)
  },
  "As It Was (Official Video) - Harry Styles - H5v3kku4y6Q": {
    audioSrc: new URL("../../artifacts/songs/As It Was (Official Video) - Harry Styles - H5v3kku4y6Q/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/As It Was (Official Video) - Harry Styles - H5v3kku4y6Q/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/As It Was (Official Video) - Harry Styles - H5v3kku4y6Q/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/As It Was (Official Video) - Harry Styles - H5v3kku4y6Q/audio-features.json", import.meta.url).href)
  },
  "A Thousand Years [Official Music Video] - Christina Perri - rtOvBOTyX00": {
    audioSrc: new URL("../../artifacts/songs/A Thousand Years [Official Music Video] - Christina Perri - rtOvBOTyX00/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/A Thousand Years [Official Music Video] - Christina Perri - rtOvBOTyX00/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/A Thousand Years [Official Music Video] - Christina Perri - rtOvBOTyX00/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/A Thousand Years [Official Music Video] - Christina Perri - rtOvBOTyX00/audio-features.json", import.meta.url).href)
  },
  "Summer Is for Falling in Love - Sarah Kang Music - zXbqad3UPCk": {
    audioSrc: new URL("../../artifacts/songs/Summer Is for Falling in Love - Sarah Kang Music - zXbqad3UPCk/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Summer Is for Falling in Love - Sarah Kang Music - zXbqad3UPCk/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Summer Is for Falling in Love - Sarah Kang Music - zXbqad3UPCk/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Summer Is for Falling in Love - Sarah Kang Music - zXbqad3UPCk/audio-features.json", import.meta.url).href)
  },
  "lazy afternoon - Sarah Kang Music - uk5-xGTAuL0": {
    audioSrc: new URL("../../artifacts/songs/lazy afternoon - Sarah Kang Music - uk5-xGTAuL0/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/lazy afternoon - Sarah Kang Music - uk5-xGTAuL0/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/lazy afternoon - Sarah Kang Music - uk5-xGTAuL0/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/lazy afternoon - Sarah Kang Music - uk5-xGTAuL0/audio-features.json", import.meta.url).href)
  },
  "old timers (feat. Nieman) - Sarah Kang Music - 6gj53-F8ztY": {
    audioSrc: new URL("../../artifacts/songs/old timers (feat. Nieman) - Sarah Kang Music - 6gj53-F8ztY/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/old timers (feat. Nieman) - Sarah Kang Music - 6gj53-F8ztY/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/old timers (feat. Nieman) - Sarah Kang Music - 6gj53-F8ztY/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/old timers (feat. Nieman) - Sarah Kang Music - 6gj53-F8ztY/audio-features.json", import.meta.url).href)
  },
  "goodbye and godspeed - Sarah Kang Music - oPZjm2eQAlQ": {
    audioSrc: new URL("../../artifacts/songs/goodbye and godspeed - Sarah Kang Music - oPZjm2eQAlQ/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/goodbye and godspeed - Sarah Kang Music - oPZjm2eQAlQ/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/goodbye and godspeed - Sarah Kang Music - oPZjm2eQAlQ/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/goodbye and godspeed - Sarah Kang Music - oPZjm2eQAlQ/audio-features.json", import.meta.url).href)
  },
  "easy to love - Sarah Kang Music - RvL2FHWsOLM": {
    audioSrc: new URL("../../artifacts/songs/easy to love - Sarah Kang Music - RvL2FHWsOLM/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/easy to love - Sarah Kang Music - RvL2FHWsOLM/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/easy to love - Sarah Kang Music - RvL2FHWsOLM/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/easy to love - Sarah Kang Music - RvL2FHWsOLM/audio-features.json", import.meta.url).href)
  },
  "no reason - Sarah Kang Music - F8XAs_m8qZ8": {
    audioSrc: new URL("../../artifacts/songs/no reason - Sarah Kang Music - F8XAs_m8qZ8/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/no reason - Sarah Kang Music - F8XAs_m8qZ8/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/no reason - Sarah Kang Music - F8XAs_m8qZ8/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/no reason - Sarah Kang Music - F8XAs_m8qZ8/audio-features.json", import.meta.url).href)
  },
  "bittersweet (feat. Luke Chiang) - Sarah Kang Music - -xQUUgAaRoE": {
    audioSrc: new URL("../../artifacts/songs/bittersweet (feat. Luke Chiang) - Sarah Kang Music - -xQUUgAaRoE/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/bittersweet (feat. Luke Chiang) - Sarah Kang Music - -xQUUgAaRoE/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/bittersweet (feat. Luke Chiang) - Sarah Kang Music - -xQUUgAaRoE/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/bittersweet (feat. Luke Chiang) - Sarah Kang Music - -xQUUgAaRoE/audio-features.json", import.meta.url).href)
  },
  "i miss the old me - Sarah Kang Music - 0JY4Dz2LpEA": {
    audioSrc: new URL("../../artifacts/songs/i miss the old me - Sarah Kang Music - 0JY4Dz2LpEA/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/i miss the old me - Sarah Kang Music - 0JY4Dz2LpEA/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/i miss the old me - Sarah Kang Music - 0JY4Dz2LpEA/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/i miss the old me - Sarah Kang Music - 0JY4Dz2LpEA/audio-features.json", import.meta.url).href)
  },
  "i'll never be loved like this again (feat. Takahiro Izumikawa) - Sarah Kang Music - p144b6sj084": {
    audioSrc: new URL("../../artifacts/songs/i'll never be loved like this again (feat. Takahiro Izumikawa) - Sarah Kang Music - p144b6sj084/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/i'll never be loved like this again (feat. Takahiro Izumikawa) - Sarah Kang Music - p144b6sj084/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/i'll never be loved like this again (feat. Takahiro Izumikawa) - Sarah Kang Music - p144b6sj084/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/i'll never be loved like this again (feat. Takahiro Izumikawa) - Sarah Kang Music - p144b6sj084/audio-features.json", import.meta.url).href)
  },
  "before & after - Sarah Kang Music - hRzD3oXRkyM": {
    audioSrc: new URL("../../artifacts/songs/before & after - Sarah Kang Music - hRzD3oXRkyM/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/before & after - Sarah Kang Music - hRzD3oXRkyM/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/before & after - Sarah Kang Music - hRzD3oXRkyM/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/before & after - Sarah Kang Music - hRzD3oXRkyM/audio-features.json", import.meta.url).href)
  },
  "Maybe One Day - Mina Okabe - nsMnVJ2XDdw": {
    audioSrc: new URL("../../artifacts/songs/Maybe One Day - Mina Okabe - nsMnVJ2XDdw/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Maybe One Day - Mina Okabe - nsMnVJ2XDdw/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Maybe One Day - Mina Okabe - nsMnVJ2XDdw/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Maybe One Day - Mina Okabe - nsMnVJ2XDdw/audio-features.json", import.meta.url).href)
  },
  "Always Hurts - Mina Okabe - lH1xJUDMm2Q": {
    audioSrc: new URL("../../artifacts/songs/Always Hurts - Mina Okabe - lH1xJUDMm2Q/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Always Hurts - Mina Okabe - lH1xJUDMm2Q/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Always Hurts - Mina Okabe - lH1xJUDMm2Q/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Always Hurts - Mina Okabe - lH1xJUDMm2Q/audio-features.json", import.meta.url).href)
  },
  "Strong - Mina Okabe - MBTPzfvEXe8": {
    audioSrc: new URL("../../artifacts/songs/Strong - Mina Okabe - MBTPzfvEXe8/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Strong - Mina Okabe - MBTPzfvEXe8/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Strong - Mina Okabe - MBTPzfvEXe8/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Strong - Mina Okabe - MBTPzfvEXe8/audio-features.json", import.meta.url).href)
  },
  "A Little Bit More - Mina Okabe - P4mV6ncdB1Q": {
    audioSrc: new URL("../../artifacts/songs/A Little Bit More - Mina Okabe - P4mV6ncdB1Q/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/A Little Bit More - Mina Okabe - P4mV6ncdB1Q/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/A Little Bit More - Mina Okabe - P4mV6ncdB1Q/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/A Little Bit More - Mina Okabe - P4mV6ncdB1Q/audio-features.json", import.meta.url).href)
  },
  "Making Plans - Mina Okabe - zAEz4WycIo8": {
    audioSrc: new URL("../../artifacts/songs/Making Plans - Mina Okabe - zAEz4WycIo8/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Making Plans - Mina Okabe - zAEz4WycIo8/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Making Plans - Mina Okabe - zAEz4WycIo8/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Making Plans - Mina Okabe - zAEz4WycIo8/audio-features.json", import.meta.url).href)
  },
  "Stranger - Mina Okabe - LjJIrgB9WJk": {
    audioSrc: new URL("../../artifacts/songs/Stranger - Mina Okabe - LjJIrgB9WJk/audio.mp3", import.meta.url).href,
    backgroundSrc: new URL("../../artifacts/songs/Stranger - Mina Okabe - LjJIrgB9WJk/background.png", import.meta.url).href,
    loadRenderInput: () => loadJson<RawRenderInput>(new URL("../../artifacts/songs/Stranger - Mina Okabe - LjJIrgB9WJk/render-input.json", import.meta.url).href),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Stranger - Mina Okabe - LjJIrgB9WJk/audio-features.json", import.meta.url).href)
  },
  "summer after senior year (feat. Michael Carreon) - Sarah Kang Music - 8LovM2oVqPM": {
    audioSrc: new URL("../../artifacts/songs/summer after senior year (feat. Michael Carreon) - Sarah Kang Music - 8LovM2oVqPM/audio.mp3", import.meta.url).href,
    loadRenderInput: async () => ({}),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/summer after senior year (feat. Michael Carreon) - Sarah Kang Music - 8LovM2oVqPM/audio-features.json", import.meta.url).href)
  },
  "i have a crush on you (feat. Kazuki Isogai) - Sarah Kang Music - Sa_uktkOmMk": {
    audioSrc: new URL("../../artifacts/songs/i have a crush on you (feat. Kazuki Isogai) - Sarah Kang Music - Sa_uktkOmMk/audio.mp3", import.meta.url).href,
    loadRenderInput: async () => ({}),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/i have a crush on you (feat. Kazuki Isogai) - Sarah Kang Music - Sa_uktkOmMk/audio-features.json", import.meta.url).href)
  },
  "loml (feat. HOHYUN) - Sarah Kang Music - waeNhS9yAdk": {
    audioSrc: new URL("../../artifacts/songs/loml (feat. HOHYUN) - Sarah Kang Music - waeNhS9yAdk/audio.mp3", import.meta.url).href,
    loadRenderInput: async () => ({}),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/loml (feat. HOHYUN) - Sarah Kang Music - waeNhS9yAdk/audio-features.json", import.meta.url).href)
  },
  "Mean Too Much - Mina Okabe - CR5Mowi1rL8": {
    audioSrc: new URL("../../artifacts/songs/Mean Too Much - Mina Okabe - CR5Mowi1rL8/audio.mp3", import.meta.url).href,
    loadRenderInput: async () => ({}),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Mean Too Much - Mina Okabe - CR5Mowi1rL8/audio-features.json", import.meta.url).href)
  },
  "Dancing Around The Truth - Mina Okabe - mjk_8HeYack": {
    audioSrc: new URL("../../artifacts/songs/Dancing Around The Truth - Mina Okabe - mjk_8HeYack/audio.mp3", import.meta.url).href,
    loadRenderInput: async () => ({}),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Dancing Around The Truth - Mina Okabe - mjk_8HeYack/audio-features.json", import.meta.url).href)
  },
  "Forever - Mina Okabe - ke_3MpO1m_o": {
    audioSrc: new URL("../../artifacts/songs/Forever - Mina Okabe - ke_3MpO1m_o/audio.mp3", import.meta.url).href,
    loadRenderInput: async () => ({}),
    loadAudioFeatures: () => loadJson<AudioFeatureTrack>(new URL("../../artifacts/songs/Forever - Mina Okabe - ke_3MpO1m_o/audio-features.json", import.meta.url).href)
  }
};
