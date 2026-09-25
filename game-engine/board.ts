export type Cell = { x: number; y: number };

/**
 * Classic 15x15 Ludo board geometry.
 * The path starts at the red player's entry square and proceeds clockwise.
 */
export const TRACK: Cell[] = [
  { x: 1, y: 6 }, { x: 0, y: 6 }, { x: 0, y: 7 }, { x: 0, y: 8 },
  { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 },
  { x: 6, y: 9 }, { x: 6, y: 10 }, { x: 6, y: 11 }, { x: 6, y: 12 },
  { x: 6, y: 13 }, { x: 6, y: 14 }, { x: 7, y: 14 }, { x: 8, y: 14 },
  { x: 8, y: 13 }, { x: 8, y: 12 }, { x: 8, y: 11 }, { x: 8, y: 10 }, { x: 8, y: 9 },
  { x: 9, y: 8 }, { x: 10, y: 8 }, { x: 11, y: 8 }, { x: 12, y: 8 }, { x: 13, y: 8 },
  { x: 14, y: 8 }, { x: 14, y: 7 }, { x: 14, y: 6 },
  { x: 13, y: 6 }, { x: 12, y: 6 }, { x: 11, y: 6 }, { x: 10, y: 6 }, { x: 9, y: 6 },
  { x: 8, y: 5 }, { x: 8, y: 4 }, { x: 8, y: 3 }, { x: 8, y: 2 }, { x: 8, y: 1 },
  { x: 8, y: 0 }, { x: 7, y: 0 }, { x: 6, y: 0 },
  { x: 6, y: 1 }, { x: 6, y: 2 }, { x: 6, y: 3 }, { x: 6, y: 4 }, { x: 6, y: 5 },
  { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 3, y: 6 }, { x: 2, y: 6 },
];

export const HOME_LANES: Record<string, Cell[]> = {
  red: [
    { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 },
    { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 },
  ],
  green: [
    { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 },
    { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 7, y: 6 },
  ],
  yellow: [
    { x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 },
    { x: 10, y: 7 }, { x: 9, y: 7 }, { x: 8, y: 7 },
  ],
  blue: [
    { x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 },
    { x: 7, y: 10 }, { x: 7, y: 9 }, { x: 7, y: 8 },
  ],
};

export const CENTER: Cell = { x: 7, y: 7 };

export function trackCell(trackIndex: number): Cell {
  return TRACK[((trackIndex % TRACK.length) + TRACK.length) % TRACK.length];
}
