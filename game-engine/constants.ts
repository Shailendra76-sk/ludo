import type { PlayerColor } from "@/lib/types";

export const TOKENS_PER_PLAYER = 4;
export const TRACK_LENGTH = 52;
export const FINISH_STEPS = 58;
export const ENTRY_ROLL = 6;

export const PLAYER_COLORS: PlayerColor[] = ["red", "blue", "green", "yellow"];

export const COLOR_NAMES: Record<PlayerColor, string> = {
  red: "Red",
  blue: "Blue",
  green: "Green",
  yellow: "Yellow",
};

export const START_OFFSETS: Record<PlayerColor, number> = {
  red: 39,
  green: 0,
  blue: 26,
  yellow: 13,
};

export const SAFE_TRACK_INDEXES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
