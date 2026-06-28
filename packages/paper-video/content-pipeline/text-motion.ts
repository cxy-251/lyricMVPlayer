import type {TextMotionConfig} from "@paper-to-video/shared-types";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const getTextMotionState = ({
  frame,
  durationInFrames,
  delayFrames = 0,
  config,
}: {
  frame: number;
  durationInFrames: number;
  delayFrames?: number;
  config: TextMotionConfig;
}) => {
  const enterProgress = clamp(
    (frame - delayFrames) / Math.max(1, config.enterFrames),
    0,
    1,
  );
  const exitStart = Math.max(0, durationInFrames - config.exitFrames);
  const exitProgress = clamp(
    (frame - delayFrames - exitStart) / Math.max(1, config.exitFrames),
    0,
    1,
  );

  const enterOpacity = config.minOpacity + (1 - config.minOpacity) * enterProgress;
  const exitOpacity = 1 - (1 - config.exitOpacity) * exitProgress;
  const opacity = clamp(Math.min(enterOpacity, exitOpacity), 0, 1);

  const enterLift = config.maxLiftPx * (1 - enterProgress);
  const exitLift = config.exitLiftPx * exitProgress;

  return {
    opacity,
    translateY: Math.max(0, enterLift + exitLift),
  };
};
