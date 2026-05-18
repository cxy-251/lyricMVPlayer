import React from "react";
import {AbsoluteFill} from "remotion";

import type {LyricVideoCompositionProps} from "../types";
import {VideoStage} from "../components/music-video/VideoStage";

export const MusicVideoComposition: React.FC<LyricVideoCompositionProps> = (props) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000"
      }}
    >
      <VideoStage {...props} />
    </AbsoluteFill>
  );
};
