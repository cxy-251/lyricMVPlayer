import React from "react";
import {X} from "lucide-react";

import type {PlaylistSummary} from "../../types";
import {cn} from "../../lib/cn";

type PlaylistDrawerProps = {
  open: boolean;
  playlists: PlaylistSummary[];
  selectedPlaylistId: string | null;
  onClose: () => void;
  onSelectPlaylist: (playlistId: string) => void;
};

export const PlaylistDrawer: React.FC<PlaylistDrawerProps> = ({
  open,
  playlists,
  selectedPlaylistId,
  onClose,
  onSelectPlaylist
}) => {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50">
      <div className="absolute inset-0 bg-black/24 backdrop-blur-[18px]" onClick={onClose} />
      <div className="absolute left-[120px] top-[150px] h-[1420px] w-[560px] rounded-[30px] border border-white/10 bg-black/55 p-[28px] backdrop-blur-[26px]">
        <div className="flex items-center justify-between">
          <div className="text-[28px] font-semibold text-white/95">My Playlists</div>
          <button
            className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-white/6 text-white/92"
            onClick={onClose}
          >
            <X size={24} strokeWidth={1.8} />
          </button>
        </div>
        <div className="mt-[22px] flex max-h-[1280px] flex-col gap-[14px] overflow-y-auto pr-[6px]">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              className={cn(
                "rounded-[22px] border px-[20px] py-[18px] text-left transition",
                selectedPlaylistId === playlist.id
                  ? "border-blue-300/60 bg-blue-300/10"
                  : "border-white/8 bg-white/4"
              )}
              onClick={() => onSelectPlaylist(playlist.id)}
            >
              <div className="text-[20px] font-semibold text-white/94">{playlist.name}</div>
              <div className="mt-[6px] text-[15px] text-white/56">{playlist.count} tracks</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
