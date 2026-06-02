import React from "react";
import {RemotionThreeLifeLayer} from "./effects/three-life";
import type {ThreeLifeEffectProps} from "./three-life-effect.types";

export const ThreeLifeEffect: React.FC<ThreeLifeEffectProps> = (props) => <RemotionThreeLifeLayer {...props} />;
