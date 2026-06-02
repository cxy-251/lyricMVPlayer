import {useEffect, useMemo, useRef, useState} from "react";

type SurfaceSize = {
  renderHeight: number;
  renderWidth: number;
};

/**
 * The template preview should lay out content in the same coordinate space as
 * the final video, then scale that surface down for the browser shell.
 * This prevents long titles from reflowing differently in the web preview.
 */
export const usePreviewSurfaceScale = ({
  renderHeight,
  renderWidth,
}: SurfaceSize) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({height: 0, width: 0});

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const {height, width} = entry.contentRect;
      setViewportSize({height, width});
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  const scale = useMemo(() => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0) {
      return 1;
    }

    return Math.min(
      viewportSize.width / renderWidth,
      viewportSize.height / renderHeight,
    );
  }, [renderHeight, renderWidth, viewportSize.height, viewportSize.width]);

  return {
    scale,
    viewportRef,
  };
};
