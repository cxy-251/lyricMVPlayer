import React from "react";

type SafeAreaDebugOverlayProps = {
  visible: boolean;
};

export const SafeAreaDebugOverlay: React.FC<SafeAreaDebugOverlayProps> = ({visible}) => {
  if (!visible) {
    return null;
  }

  return <div className="music-hud-debug" />;
};
