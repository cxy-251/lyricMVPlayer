import React, {useMemo, useEffect} from "react";
import {useParams, useNavigate, Link} from "react-router";

import {DemoLayout} from "./demo/DemoLayout";
import {demos as web3dDemos} from "../demos";
import "../styles.css";

import type {AudioFeatureTrack} from "@lyric-mv/lyric-video";
import type {DemoDefinition} from "../types";

const getDemoNumberLabel = (index: number) => String(index + 1).padStart(3, "0");

export function Gallery({
  demos,
  onNavigate,
}: {
  demos: DemoDefinition[];
  onNavigate: (route: string) => void;
}) {
  return (
    <main className="gallery-page">
      <section className="gallery-shell" aria-labelledby="gallery-title">
        <header className="gallery-header">
          <div>
            <Link className="studio-back-link" to="/studio">Studio</Link>
            <p className="eyebrow">Web3D Lab</p>
            <h1 id="gallery-title">Real-time 3D experiments</h1>
          </div>
          <p className="gallery-intro">
            A focused creative coding lab for shader-heavy, interactive, browser-native 3D studies.
          </p>
        </header>

        <div className="gallery-grid">
          {demos.map((demo, index) => (
            <article className="demo-card" key={demo.id}>
              <a
                className="demo-card-link"
                href={demo.route}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(demo.route);
                }}
              >
                <div className="demo-card-body">
                  <div className="tag-row">
                    {demo.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <h2>
                    <span className="demo-number">{getDemoNumberLabel(index)}</span>
                    <span>{demo.title}</span>
                  </h2>
                  <p>{demo.description}</p>
                  <span className="open-label">Open demo</span>
                </div>
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

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
    <DemoLayout metadata={activeDemo} onBack={openGallery}>
      <ActiveDemo />
    </DemoLayout>
  );
};
