import React from "react";

import {MusicVideoComposition} from "@lyric-mv/lyric-video";
import type {LyricVideoCompositionProps} from "@lyric-mv/lyric-video";
import {loadPreviewSong} from "./preview-library/song-loader";

export const PreviewMusicVideoComposition: React.FC<LyricVideoCompositionProps> = (props) => (
  <MusicVideoComposition {...props} loadLibraryItem={loadPreviewSong} />
);
