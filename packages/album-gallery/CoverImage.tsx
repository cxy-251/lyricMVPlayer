import React from "react";

import type {AlbumGalleryTrack} from "./types";

type CoverImageProps = {
  track: AlbumGalleryTrack;
  className?: string;
};

export const CoverImage: React.FC<CoverImageProps> = ({track, className}) => {
  if (track.coverSrc) {
    return <img className={className} src={track.coverSrc} alt="" draggable={false} />;
  }

  return (
    <div
      className={`${className ?? ""} flex items-center justify-center bg-neutral-200 text-2xl font-semibold text-neutral-950`}
      style={{background: track.themeColor}}
    >
      {track.title.slice(0, 2).toUpperCase()}
    </div>
  );
};
