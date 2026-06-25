import React from "react";
import {Composition, registerRoot} from "remotion";
import "../styles/tailwind.css";

import {PreviewMusicVideoComposition} from "./PreviewMusicVideoComposition";
import {VisualEffectTestComposition} from "./VisualEffectTestComposition";
import {previewCompositionProps} from "./preview-composition-props";

const lyricsMusicCompositionIds = ["MusicVideo", "LyricsMusic"] as const;

export const RenderRoot: React.FC = () => {
  return (
    <>
      {lyricsMusicCompositionIds.map((id) => (
        <Composition
          key={id}
          id={id}
          component={PreviewMusicVideoComposition}
          width={1080}
          height={1920}
          fps={previewCompositionProps.fps}
          durationInFrames={
            previewCompositionProps.renderDurationInFrames ?? previewCompositionProps.durationInFrames
          }
          defaultProps={previewCompositionProps}
        />
      ))}
      <Composition
        id="VisualEffectTest30"
        component={VisualEffectTestComposition}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={300}
      />
      <Composition
        id="VisualEffectTest60"
        component={VisualEffectTestComposition}
        width={1920}
        height={1080}
        fps={60}
        durationInFrames={600}
      />
    </>
  );
};

registerRoot(RenderRoot);
