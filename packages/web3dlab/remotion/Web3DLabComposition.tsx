import React from "react";
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion";

import {demos} from "../demos";
import type {DemoDefinition} from "../types";
import "../styles.css";

export type Web3DLabCompositionProps = {
  demoId?: string;
  durationInFrames?: number;
  fps?: number;
};

const defaultDemoId = "cinematic-style-sequence";
const defaultDurationInFrames = 30 * 10;

const normalizeDemoKey = (value: string) =>
  value
    .replace(/^\/+/, "")
    .replace(/^studio\/effects\/web3d\//, "")
    .replace(/^web3d\//, "")
    .replace(/^demos\//, "")
    .replace(/^\/+/, "");

export const findWeb3DLabDemo = (demoId?: string): DemoDefinition => {
  const normalized = normalizeDemoKey(demoId || defaultDemoId);
  return (
    demos.find((demo) => demo.id === normalized || normalizeDemoKey(demo.route) === normalized) ??
    demos.find((demo) => demo.id === defaultDemoId) ??
    demos[0]
  );
};

export const getWeb3DLabDurationInFrames = (props: Web3DLabCompositionProps) => (
  Math.max(1, Math.round(props.durationInFrames ?? defaultDurationInFrames))
);

export const defaultWeb3DLabCompositionProps: Web3DLabCompositionProps = {
  demoId: defaultDemoId,
  durationInFrames: defaultDurationInFrames,
  fps: 30,
};

export const Web3DLabComposition: React.FC<Web3DLabCompositionProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const activeDemo = findWeb3DLabDemo(props.demoId);
  const ActiveDemo = activeDemo.Component;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#03040b",
        color: "#f8fafc",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <div className="demo-page" style={{position: "absolute", inset: 0, minHeight: "100%", width: "100%", height: "100%"}}>
        <ActiveDemo />
      </div>
      <div
        style={{
          position: "absolute",
          left: 24,
          bottom: 24,
          zIndex: 20,
          display: "flex",
          gap: 12,
          alignItems: "center",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 8,
          background: "rgba(3,4,11,0.58)",
          padding: "10px 12px",
          color: "rgba(248,250,252,0.78)",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.02em",
          backdropFilter: "blur(14px)",
        }}
      >
        <span>{activeDemo.id}</span>
        <span>{Math.floor(frame / Math.max(1, fps))}s</span>
      </div>
    </AbsoluteFill>
  );
};
