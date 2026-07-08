import React from "react";
import {AnimatePresence, motion} from "framer-motion";

import type {GradientPreset} from "../data/gradients";

type GradientCanvasProps = {
  preset: GradientPreset;
  cssGradient: string;
};

export const GradientCanvas: React.FC<GradientCanvasProps> = ({preset, cssGradient}) => {
  return (
    <div className="gradient-canvas" aria-hidden="true">
      <AnimatePresence mode="sync">
        <motion.div
          key={`${preset.id}-${cssGradient}`}
          className="gradient-canvas__paint"
          style={{backgroundImage: cssGradient, backgroundColor: preset.colors[0]}}
          initial={{opacity: 0, scale: 1.015}}
          animate={{opacity: 1, scale: 1}}
          exit={{opacity: 0, scale: 0.985}}
          transition={{duration: 0.58, ease: [0.16, 1, 0.3, 1]}}
        />
      </AnimatePresence>
      <div className="gradient-canvas__glow gradient-canvas__glow--a" />
      <div className="gradient-canvas__glow gradient-canvas__glow--b" />
      <div className="gradient-canvas__vignette" />
      <div className="gradient-canvas__grain" />
    </div>
  );
};
