import type {LyricVideoCompositionProps} from "./types";

export const sampleCompositionProps: LyricVideoCompositionProps = {
  title: "Sample Song",
  artist: "Sample Artist",
  durationInFrames: 300,
  fps: 30,
  background: {
    kind: "color",
    color: "#1f3b73"
  },
  lyrics: [
    {startMs: 0, endMs: 2500, text: "This is the first sample lyric line"},
    {startMs: 2500, endMs: 5000, text: "This is the second sample lyric line"},
    {startMs: 5000, endMs: 9000, text: "This is the final sample lyric line"}
  ]
};
