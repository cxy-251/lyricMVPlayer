import React from "react";
import {Player} from "@remotion/player";

import {MusicVideoComposition} from "../../modules/render-core/src";
import {previewCompositionProps} from "../remotion/preview-composition-props";

export const App: React.FC = () => {
  return (
    <div className="web-shell">
      <div className="web-stage-frame">
        <Player
          component={MusicVideoComposition}
          inputProps={{
            ...previewCompositionProps,
            interactivePreview: true,
          }}
          durationInFrames={previewCompositionProps.durationInFrames}
          fps={previewCompositionProps.fps}
          compositionWidth={1080}
          compositionHeight={1920}
          controls={false}
          autoPlay={false}
          loop={false}
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#000",
          }}
        />
      </div>
    </div>
  );
};
