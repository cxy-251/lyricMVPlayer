import React from "react";
import {ListMusic, X} from "lucide-react";

import type {QueueTrack} from "../../../types";
import {cn} from "../../../lib/cn";

type QueuePanelProps = {
  open: boolean;
  queue: QueueTrack[];
  currentTrackId: string;
  onClose: () => void;
  onSelectTrack: (trackId: string) => void;
};

const formatAssetStatus = (track: QueueTrack) => {
  if (track.available === false) {
    return "missing public assets";
  }

  const status = track.assetStatus;
  if (!status) {
    return track.artist;
  }

  const parts = [
    status.audio ? "audio" : "no audio",
    status.background ? "background" : "no background",
    status.lyrics ? "lyrics" : "no lyrics",
  ];

  return `${track.artist} · ${parts.join(" · ")}`;
};

export const QueuePanel: React.FC<QueuePanelProps> = ({
  open,
  queue,
  currentTrackId,
  onClose,
  onSelectTrack
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50">
      <div className="absolute inset-0 bg-black/24 backdrop-blur-[18px]" onClick={onClose} />
      <div className="absolute right-[120px] top-[150px] h-[840px] w-[520px] rounded-[30px] border border-white/10 bg-black/50 p-[28px] backdrop-blur-[26px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[28px] font-semibold text-white/95">
            <ListMusic size={24} strokeWidth={1.8} />
            <span>Queue</span>
          </div>
          <button
            className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-white/6 text-white/92"
            onClick={onClose}
          >
            <X size={24} strokeWidth={1.8} />
          </button>
        </div>
        <div className="mt-[24px] flex max-h-[680px] flex-col gap-[14px] overflow-y-auto pr-[6px]">
          {queue.map((track) => (
            <button
              key={track.id}
              disabled={track.available === false}
              className={cn(
                "rounded-[22px] border bg-white/4 px-[20px] py-[18px] text-left transition",
                track.id === currentTrackId ? "border-blue-300/60 bg-blue-300/10" : "border-white/8",
                track.available === false ? "cursor-not-allowed opacity-55" : ""
              )}
              onClick={() => onSelectTrack(track.id)}
            >
              <div className="text-[20px] font-semibold text-white/94">{track.title}</div>
              <div className="mt-[6px] text-[15px] text-white/58">
                {formatAssetStatus(track)}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
