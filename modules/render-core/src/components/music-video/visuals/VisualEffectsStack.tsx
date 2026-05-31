import React from "react";

import type {AudioFeatureFrame, SongLibraryItem} from "../../../types";
import {DEFAULT_NICKNAME} from "../../../domain/songs";
import {AudioReactiveBackground} from "./AudioReactiveBackground";
import {BackgroundLayer} from "./BackgroundLayer";
import {EnergyRing} from "./EnergyRing";
import {LyricShockwave} from "./LyricShockwave";
import {ParticleOrbit} from "./ParticleOrbit";
import {ReadabilityLayer} from "./ReadabilityLayer";
import {SafePoetryFrame} from "./SafePoetryFrame";
import {SparkleLayer} from "./SparkleLayer";
import {WaveformEnergyCanvas} from "./WaveformEnergyCanvas";

type VisualEffectsStackProps = {
  currentFrame: number;
  currentSong: SongLibraryItem;
  currentTimeMs: number;
  fallbackEnergy: number;
  isPlaying: boolean;
  lineProgress: number;
  reactiveBass: number;
  reactiveBeat: number;
  reactiveEnergy: number;
  reactiveHigh: number;
  reactiveMid: number;
  reactiveOnset: number;
  sampledFeature: AudioFeatureFrame | null;
  waveformEnergy: number;
};

export const VisualEffectsStack: React.FC<VisualEffectsStackProps> = ({
  currentFrame,
  currentSong,
  currentTimeMs,
  fallbackEnergy,
  isPlaying,
  lineProgress,
  reactiveBass,
  reactiveBeat,
  reactiveEnergy,
  reactiveHigh,
  reactiveMid,
  reactiveOnset,
  sampledFeature,
  waveformEnergy,
}) => {
  return (
    <>
      <BackgroundLayer kind={currentSong.background.kind} src={currentSong.background.src} color={currentSong.background.color} />
      <AudioReactiveBackground bass={reactiveBass} energy={reactiveEnergy} onset={reactiveOnset} />
      <ReadabilityLayer />
      <EnergyRing
        currentFrame={currentFrame}
        bass={reactiveBass}
        mid={reactiveMid}
        energy={reactiveEnergy}
        beat={reactiveBeat}
        onset={reactiveOnset}
        lineProgress={lineProgress}
      />
      <ParticleOrbit
        currentFrame={currentFrame}
        energy={reactiveEnergy}
        high={reactiveHigh}
        beat={reactiveBeat}
        onset={reactiveOnset}
      />
      <LyricShockwave lineProgress={lineProgress} onset={reactiveOnset} />
      <SparkleLayer currentFrame={currentFrame} high={reactiveHigh} beat={reactiveBeat} onset={reactiveOnset} />
      <WaveformEnergyCanvas
        currentTimeMs={currentTimeMs}
        bass={sampledFeature ? reactiveBass : fallbackEnergy * 0.8}
        mid={sampledFeature ? reactiveMid : fallbackEnergy * 0.6}
        high={sampledFeature ? reactiveHigh : fallbackEnergy * 0.36}
        energy={waveformEnergy}
        onset={sampledFeature ? reactiveOnset : 0}
        isPlaying={isPlaying}
      />
      <SafePoetryFrame
        nickname={currentSong.poetryFrame?.nickname ?? DEFAULT_NICKNAME}
        topLabel={currentSong.poetryFrame?.topLabel}
        leftVertical={currentSong.poetryFrame?.leftVertical}
        rightVertical={currentSong.poetryFrame?.rightVertical}
        bottomLine={currentSong.poetryFrame?.bottomLine}
      />
    </>
  );
};
