import React, {useMemo, useEffect} from "react";
import {useParams, useNavigate} from "react-router";

import {DemoLayout} from "./components/demo/DemoLayout";
import {Gallery} from "./components/Gallery";
import {demos as web3dDemos} from "./demos";
import "./styles.css";

import type {AudioFeatureTrack} from "@lyric-mv/lyric-video";
import type {DemoDefinition} from "./types";

type LabSong = {
  id: string;
  title: string;
  artist: string;
  audioSrc?: string;
  audioFeatures?: AudioFeatureTrack;
  fps: number;
  durationInFrames: number;
};

const effectRoutePrefix = "/studio/effects";

const normalizeDemoRoute = (route: string) => route.replace(/^\//, "");

const findDemo = (id: string): DemoDefinition | undefined => {
  if (!id) return undefined;
  const normalized = normalizeDemoRoute(id.replace(/^web3d\//, ""));
  return web3dDemos.find((demo) => demo.id === normalized || normalizeDemoRoute(demo.route) === normalized);
};

const web3dPath = (demo: DemoDefinition) => `${effectRoutePrefix}/web3d/${normalizeDemoRoute(demo.route)}`;

export const EffectLabPage: React.FC<{song: LabSong}> = () => {
  const params = useParams();
  const navigate = useNavigate();
  const splatParam = params["*"] ?? "";
  
  const activeDemo = useMemo(() => findDemo(splatParam), [splatParam]);

  const openGallery = () => {
    navigate(effectRoutePrefix);
  };

  const openDemo = (route: string) => {
    const demo = findDemo(route);
    if (!demo) return;
    navigate(web3dPath(demo));
  };

  if (!activeDemo) {
    return <Gallery demos={web3dDemos} onNavigate={openDemo} />;
  }

  const ActiveDemo = activeDemo.Component;

  return (
    <DemoLayout controlsCollapsed={false} metadata={activeDemo} onBack={openGallery}>
      <ActiveDemo />
    </DemoLayout>
  );
};
