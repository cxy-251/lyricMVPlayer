import React from "react";
import type { EffectAtomRuntimeProps } from "../simulations/types";
import { baseLayerStyle, getAuroraBackground, getGridDriftBackground, getNoiseBloomBackground } from "./styles";
const AuroraAtom: React.FC = () => {
  return <div style={{...baseLayerStyle, ...getAuroraBackground()}} />;
};

const GridDriftAtom: React.FC<Pick<EffectAtomRuntimeProps, "absoluteFrame">> = ({absoluteFrame}) => {
  return <div style={{...baseLayerStyle, opacity: 0.38, ...getGridDriftBackground(absoluteFrame)}} />;
};

const NoiseBloomAtom: React.FC<Pick<EffectAtomRuntimeProps, "absoluteFrame">> = ({absoluteFrame}) => {
  return <div style={{...baseLayerStyle, opacity: 0.92, ...getNoiseBloomBackground(absoluteFrame)}} />;
};

export { AuroraAtom, GridDriftAtom, NoiseBloomAtom };
