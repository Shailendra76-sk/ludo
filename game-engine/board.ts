export type Cell = { x: number; y: number };

export const TRACK: Cell[] = [
  ...Array.from({ length: 13 }, (_, x) => ({ x: x + 1, y: 0 })),
  ...Array.from({ length: 13 }, (_, i) => ({ x: 14, y: i + 1 })),
  ...Array.from({ length: 13 }, (_, i) => ({ x: 13 - i, y: 14 })),
  ...Array.from({ length: 13 }, (_, i) => ({ x: 0, y: 13 - i })),
];

export const HOME_LANES: Record<string, Cell[]> = {
  red: [1, 2, 3, 4, 5].map((y) => ({ x: 7, y })),
  blue: [9, 10, 11, 12, 13].map((x) => ({ x, y: 7 })),
  green: [13, 12, 11, 10, 9].map((y) => ({ x: 7, y })),
  yellow: [5, 4, 3, 2, 1].map((x) => ({ x, y: 7 })),
};

export const CENTER: Cell = { x: 7, y: 7 };

export function trackCell(trackIndex: number): Cell {
  return TRACK[((trackIndex % TRACK.length) + TRACK.length) % TRACK.length];
}
