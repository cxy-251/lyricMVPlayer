import React from "react";
import {AbsoluteFill, Audio} from "remotion";

import type {LyricVideoCompositionProps} from "../types";
import {VideoStage} from "../components/music-video/VideoStage";

export const MusicVideoComposition: React.FC<LyricVideoCompositionProps> = (props) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000"
      }}
    >
      {props.audioSrc ? <Audio src={props.audioSrc} /> : null}
      <VideoStage {...props} />
    </AbsoluteFill>
  );
};
