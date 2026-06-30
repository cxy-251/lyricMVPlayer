import React from "react";
import {Composition, registerRoot} from "remotion";
import "../styles/tailwind.css";

import {PreviewMusicVideoComposition} from "./PreviewMusicVideoComposition";
import {
  AlbumGalleryComposition,
  defaultAlbumGalleryCompositionProps,
  getAlbumGalleryDurationInFrames,
  getAlbumGallerySelectedTrack,
} from "../../packages/album-gallery";

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
        id="AlbumGallery"
        component={AlbumGalleryComposition}
        width={1920}
        height={1080}
        fps={defaultAlbumGalleryCompositionProps.fps ?? 30}
        durationInFrames={getAlbumGalleryDurationInFrames(defaultAlbumGalleryCompositionProps)}
        defaultProps={defaultAlbumGalleryCompositionProps}
        calculateMetadata={({props}) => {
          const selectedTrack = getAlbumGallerySelectedTrack(props);
          const fps = props.fps ?? selectedTrack.fps;
          return {
            fps,
            durationInFrames: getAlbumGalleryDurationInFrames({...props, fps}),
          };
        }}
      />
    </>
  );
};

registerRoot(RenderRoot);
