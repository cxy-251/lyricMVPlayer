import React from "react";

import {MusicVideoComposition} from "../../modules/render-core/src";
import type {LyricVideoCompositionProps} from "../../modules/render-core/src";
import {loadPreviewSong} from "./preview-library/song-loader";

export const PreviewMusicVideoComposition: React.FC<LyricVideoCompositionProps> = (props) => (
  <MusicVideoComposition {...props} loadLibraryItem={loadPreviewSong} />
);
