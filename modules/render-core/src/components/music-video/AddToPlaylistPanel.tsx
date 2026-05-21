import React from "react";
import {Check, X} from "lucide-react";

import type {PlaylistSummary} from "../../types";
import {cn} from "../../lib/cn";

type AddToPlaylistPanelProps = {
  open: boolean;
  playlists: PlaylistSummary[];
  trackPlaylistIds: string[];
  onClose: () => void;
  onSelectPlaylist: (playlistId: string) => void;
};

export const AddToPlaylistPanel: React.FC<AddToPlaylistPanelProps> = ({
  open,
  playlists,
  trackPlaylistIds,
  onClose,
  onSelectPlaylist
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50">
      <div className="absolute inset-0 bg-black/24 backdrop-blur-[18px]" onClick={onClose} />
      <div className="absolute left-1/2 top-[1120px] w-[560px] -translate-x-1/2 rounded-[28px] border border-white/10 bg-black/55 p-[28px] backdrop-blur-[26px]">
        <div className="flex items-center justify-between">
          <div className="text-[26px] font-semibold text-white/95">Add to Playlist</div>
          <button
            className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-white/6 text-white/92"
            onClick={onClose}
          >
            <X size={22} strokeWidth={1.8} />
          </button>
        </div>
        <div className="mt-[20px] flex flex-col gap-[10px]">
          {playlists.map((playlist) => (
            (() => {
              const isIncluded = trackPlaylistIds.includes(playlist.id);

              return (
                <button
                  key={playlist.id}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[20px] border px-[18px] py-[16px] text-left transition",
                    isIncluded ? "border-blue-300/60 bg-blue-300/10" : "border-white/8 bg-white/4"
                  )}
                  onClick={() => onSelectPlaylist(playlist.id)}
                >
                  <div>
                    <div className="text-[18px] text-white/94">{playlist.name}</div>
                    <div className="mt-[4px] text-[14px] text-white/54">{playlist.count} tracks</div>
                  </div>
                  {isIncluded ? <Check size={18} strokeWidth={2} className="text-blue-300" /> : null}
                </button>
              );
            })()
          ))}
        </div>
      </div>
    </div>
  );
};
