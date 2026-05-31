import React from "react";
import {
  Heart,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  SkipBack,
  SkipForward
} from "lucide-react";
import {cn} from "../../../lib/cn";

type RepeatMode = "none" | "one" | "list";

type ControlBarProps = {
  isPlaying: boolean;
  liked: boolean;
  repeatMode: RepeatMode;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleLike: () => void;
  onToggleRepeatOne: () => void;
  onToggleRepeatList: () => void;
  onAddToPlaylist: () => void;
  addPanelOpen: boolean;
};

export const ControlBar: React.FC<ControlBarProps> = ({
  isPlaying,
  liked,
  repeatMode,
  canGoPrevious,
  canGoNext,
  onTogglePlay,
  onPrevious,
  onNext,
  onToggleLike,
  onToggleRepeatOne,
  onToggleRepeatList,
  onAddToPlaylist,
  addPanelOpen
}) => {
  const baseButton =
    "flex h-[60px] w-[60px] items-center justify-center rounded-full text-white/70 transition active:scale-95";

  return (
    <div className="absolute left-[120px] top-[1648px] z-40 flex h-[120px] w-[840px] items-center justify-between">
      <button
        className={cn(baseButton, repeatMode === "one" ? "text-blue-300" : "text-white/70")}
        onClick={onToggleRepeatOne}
        title="单曲循环"
      >
        <Repeat1 size={38} strokeWidth={1.8} />
      </button>
      <button
        className={cn(baseButton, !canGoPrevious && "opacity-40")}
        onClick={onPrevious}
        disabled={!canGoPrevious}
        title="上一首"
      >
        <SkipBack size={38} strokeWidth={1.8} />
      </button>
      <button
        className="flex h-[96px] w-[96px] items-center justify-center rounded-full border border-blue-300/70 bg-black/20 text-white/95 shadow-[0_0_36px_rgba(90,150,255,0.42)] backdrop-blur-sm transition active:scale-95"
        onClick={onTogglePlay}
        title={isPlaying ? "暂停" : "播放"}
      >
        {isPlaying ? <Pause size={44} strokeWidth={1.9} /> : <Play size={44} strokeWidth={1.9} />}
      </button>
      <button
        className={cn(baseButton, !canGoNext && "opacity-40")}
        onClick={onNext}
        disabled={!canGoNext}
        title="下一首"
      >
        <SkipForward size={38} strokeWidth={1.8} />
      </button>
      <button
        className={cn(baseButton, repeatMode === "list" ? "text-blue-300" : "text-white/70")}
        onClick={onToggleRepeatList}
        title="列表循环"
      >
        <Repeat size={38} strokeWidth={1.8} />
      </button>
      <button
        className={cn(baseButton, liked ? "text-red-300" : "text-white/70")}
        onClick={onToggleLike}
        title="喜欢"
      >
        <Heart size={38} strokeWidth={1.8} fill={liked ? "currentColor" : "none"} />
      </button>
      <button
        className={cn(baseButton, addPanelOpen ? "text-blue-200" : "text-white/70")}
        onClick={onAddToPlaylist}
        title="添加到歌单"
      >
        <Plus size={38} strokeWidth={1.8} />
      </button>
    </div>
  );
};
