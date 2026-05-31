import React from "react";
import {Composition, registerRoot} from "remotion";
import "../styles/tailwind.css";

import {PreviewMusicVideoComposition} from "./PreviewMusicVideoComposition";
import {previewCompositionProps} from "./preview-composition-props";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MusicVideo"
        component={PreviewMusicVideoComposition}
        width={1080}
        height={1920}
        fps={previewCompositionProps.fps}
        durationInFrames={previewCompositionProps.durationInFrames}
        defaultProps={previewCompositionProps}
      />
    </>
  );
};

registerRoot(RemotionRoot);
