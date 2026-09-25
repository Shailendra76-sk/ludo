import type { PlayerColor } from "@/lib/types";

export const TOKENS_PER_PLAYER = 4;
export const TRACK_LENGTH = 51;
export const FINISH_STEPS = 58;
export const ENTRY_ROLL = 6;

export const PLAYER_COLORS: PlayerColor[] = ["red", "green", "yellow", "blue"];

export const COLOR_NAMES: Record<PlayerColor, string> = {
  red: "Red",
  blue: "Blue",
  green: "Green",
  yellow: "Yellow",
};

export const START_OFFSETS: Record<PlayerColor, number> = {
  red: 0,
  green: 39,
  blue: 13,
  yellow: 26,
};

export const SAFE_TRACK_INDEXES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
