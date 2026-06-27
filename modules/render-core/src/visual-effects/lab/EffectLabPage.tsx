import React, {useMemo, useState} from "react";

import {DemoLayout} from "../web3d-lab/components/demo/DemoLayout";
import {Gallery} from "../web3d-lab/components/Gallery";
import {demos as web3dDemos} from "../web3d-lab/demos";
import "../web3d-lab/styles.css";

import type {AudioFeatureTrack} from "../../types";
import type {DemoDefinition} from "../web3d-lab/types";

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

const routeEntryId = () => {
  const segments = window.location.pathname.split("/").filter(Boolean);
  const marker = segments.indexOf("effects");
  if (marker < 0) return "";
  return decodeURIComponent(segments.slice(marker + 1).join("/"));
};

const normalizeDemoRoute = (route: string) => route.replace(/^\//, "");

const findDemo = (id: string): DemoDefinition | undefined => {
  const normalized = normalizeDemoRoute(id.replace(/^web3d\//, ""));
  return web3dDemos.find((demo) => demo.id === normalized || normalizeDemoRoute(demo.route) === normalized);
};

const web3dPath = (demo: DemoDefinition) => `${effectRoutePrefix}/web3d/${normalizeDemoRoute(demo.route)}`;

const pushRoute = (path: string) => {
  window.history.pushState({}, "", path);
};

export const EffectLabPage: React.FC<{song: LabSong}> = () => {
  const initialDemo = useMemo(() => findDemo(routeEntryId()), []);
  const [activeDemoId, setActiveDemoId] = useState(initialDemo?.id ?? "");
  const activeDemo = activeDemoId ? findDemo(activeDemoId) : undefined;

  const openGallery = () => {
    setActiveDemoId("");
    pushRoute(effectRoutePrefix);
  };

  const openDemo = (route: string) => {
    const demo = findDemo(route);
    if (!demo) return;
    setActiveDemoId(demo.id);
    pushRoute(web3dPath(demo));
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
