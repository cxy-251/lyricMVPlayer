import React from "react";
import {AbsoluteFill, Html5Audio} from "remotion";

import type {LyricVideoCompositionProps} from "../types";
import {VideoStage} from "../components/music-video/VideoStage";

export const MusicVideoComposition: React.FC<LyricVideoCompositionProps> = (props) => {
  const trimFrames = Math.max(0, Math.round((props.renderTrimStartMs ?? 0) / 1000 * props.fps));
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000"
      }}
    >
      {props.audioSrc ? <Html5Audio src={props.audioSrc} startFrom={trimFrames} /> : null}
      <VideoStage {...props} />
    </AbsoluteFill>
  );
};
