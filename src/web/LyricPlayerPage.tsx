import React, {useMemo} from "react";
import {Link} from "react-router";
import {Player} from "@remotion/player";

import {MusicVideoComposition} from "@lyric-mv/lyric-video";
import {useLyricData} from "./LyricDataLayout";

/**
 * The main lyric video player page, served at / and /LyricsMusic.
 * Consumes lyric library data from LyricDataLayout via outlet context.
 */
export const LyricPlayerPage: React.FC = () => {
  const {props, error, splashText, showSplash} = useLyricData();

  const body = useMemo(() => {
    if (error) {
      return <div className="web-status">Failed to load player assets: {error}</div>;
    }
    if (!props) {
      return <div className="web-status">Loading player library...</div>;
    }
    return (
      <Player
        component={MusicVideoComposition}
        inputProps={props}
        durationInFrames={props.durationInFrames}
        fps={props.fps}
        compositionWidth={1080}
        compositionHeight={1920}
        controls={false}
        clickToPlay={false}
        autoPlay={false}
        loop={false}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#000",
        }}
      />
    );
  }, [error, props]);

  return (
    <div className="web-shell">
      <div className="web-stage-frame">
        <Link className="web-studio-link" to="/studio" title="Studio" aria-label="Open studio">
          <span>Lab</span>
        </Link>
        {body}
        <div className={`web-splash ${showSplash ? "is-visible" : "is-hidden"}`}>
          <div className="web-splash__inner">
            <div className="web-splash__label">CLEANKSEN · AUDIO DIARY</div>
            <div className="web-splash__text">{splashText}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
