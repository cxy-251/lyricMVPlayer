import React from "react";
import {AbsoluteFill, Html5Audio, Sequence, useCurrentFrame, useVideoConfig} from "remotion";

import {AlbumGalleryExperience} from "./AlbumGalleryExperience";
import {demoAlbumTracks, defaultAlbumGalleryTrackId} from "./demo-tracks";
import {buildAlbumGalleryTimeline, normalizeTrackIndex} from "./timing";
import type {AlbumGalleryCompositionProps} from "./types";

export const getAlbumGalleryCompositionTracks = (tracks?: AlbumGalleryCompositionProps["tracks"]) => (
  tracks && tracks.length > 0 ? tracks : demoAlbumTracks
);

export const getAlbumGallerySelectedTrack = (props: AlbumGalleryCompositionProps) => {
  const tracks = getAlbumGalleryCompositionTracks(props.tracks);
  const selectedIndex = normalizeTrackIndex(tracks, props.selectedTrackId || defaultAlbumGalleryTrackId);
  return tracks[selectedIndex] ?? tracks[0];
};

export const getAlbumGalleryDurationInFrames = (props: AlbumGalleryCompositionProps) => {
  const track = getAlbumGallerySelectedTrack(props);
  const fps = props.fps ?? track.fps;
  return buildAlbumGalleryTimeline(track, fps).totalFrames;
};

export const defaultAlbumGalleryCompositionProps: AlbumGalleryCompositionProps = {
  selectedTrackId: defaultAlbumGalleryTrackId,
  tracks: demoAlbumTracks,
  fps: 30,
};

export const AlbumGalleryComposition: React.FC<AlbumGalleryCompositionProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tracks = getAlbumGalleryCompositionTracks(props.tracks);
  const selectedTrack = getAlbumGallerySelectedTrack(props);
  const timeline = buildAlbumGalleryTimeline(selectedTrack, props.fps ?? fps);

  return (
    <AbsoluteFill style={{backgroundColor: "#030305"}}>
      <AlbumGalleryExperience
        tracks={tracks}
        selectedTrackId={selectedTrack.id}
        frame={frame}
        fps={props.fps ?? fps}
      />
      {selectedTrack.audioSrc ? (
        <Sequence from={timeline.audioStartFrame} durationInFrames={timeline.audioFrames}>
          <Html5Audio src={selectedTrack.audioSrc} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
