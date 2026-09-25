export type BoardPoint = { x: number; y: number };

const RED_ROUTE: BoardPoint[] = [
  { x: 6, y: 1 }, { x: 6, y: 2 }, { x: 6, y: 3 }, { x: 6, y: 4 }, { x: 6, y: 5 },
  { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 3, y: 6 }, { x: 2, y: 6 }, { x: 1, y: 6 },
  { x: 0, y: 6 }, { x: 0, y: 7 }, { x: 0, y: 8 }, { x: 1, y: 8 }, { x: 2, y: 8 },
  { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 }, { x: 6, y: 9 }, { x: 6, y: 10 },
  { x: 6, y: 11 }, { x: 6, y: 12 }, { x: 6, y: 13 }, { x: 6, y: 14 }, { x: 7, y: 14 },
  { x: 8, y: 14 }, { x: 8, y: 13 }, { x: 8, y: 12 }, { x: 8, y: 11 }, { x: 8, y: 10 },
  { x: 8, y: 9 }, { x: 9, y: 8 }, { x: 10, y: 8 }, { x: 11, y: 8 }, { x: 12, y: 8 },
  { x: 13, y: 8 }, { x: 14, y: 8 }, { x: 14, y: 7 }, { x: 14, y: 6 }, { x: 13, y: 6 },
  { x: 12, y: 6 }, { x: 11, y: 6 }, { x: 10, y: 6 }, { x: 9, y: 6 }, { x: 8, y: 5 },
  { x: 8, y: 4 }, { x: 8, y: 3 }, { x: 8, y: 2 }, { x: 8, y: 1 }, { x: 8, y: 0 },
  { x: 7, y: 0 },
  { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 7, y: 6 },
];

const rotateClockwise = (point: BoardPoint): BoardPoint => ({
  x: 14 - point.y,
  y: point.x,
});

const rotateRoute = (route: BoardPoint[], turns: number) =>
  route.map((point) => {
    let next = point;
    for (let i = 0; i < turns; i += 1) next = rotateClockwise(next);
    return next;
  });

export const PLAYER_ROUTES: Record<"red" | "green" | "yellow" | "blue", BoardPoint[]> = {
  red: RED_ROUTE,
  green: rotateRoute(RED_ROUTE, 1),
  yellow: rotateRoute(RED_ROUTE, 2),
  blue: rotateRoute(RED_ROUTE, 3),
};

export const SHARED_TRACK = RED_ROUTE.slice(0, 51);
export const HOME_LANES = {
  red: RED_ROUTE.slice(51),
  green: rotateRoute(RED_ROUTE, 1).slice(51),
  yellow: rotateRoute(RED_ROUTE, 2).slice(51),
  blue: rotateRoute(RED_ROUTE, 3).slice(51),
} as const;

export const START_POSITIONS = {
  red: RED_ROUTE[0],
  green: rotateRoute(RED_ROUTE, 1)[0],
  yellow: rotateRoute(RED_ROUTE, 2)[0],
  blue: rotateRoute(RED_ROUTE, 3)[0],
} as const;

export const CENTER: BoardPoint = { x: 7, y: 7 };

const SAFE_BASE = [
  RED_ROUTE[0],
  RED_ROUTE[8],
  RED_ROUTE[13],
  RED_ROUTE[21],
  RED_ROUTE[26],
  RED_ROUTE[34],
  RED_ROUTE[39],
  RED_ROUTE[47],
];

export const SAFE_CELLS = new Set(
  [0, 1, 2, 3].flatMap((turns) =>
    SAFE_BASE.map((point) => {
      let rotated = point;
      for (let i = 0; i < turns; i += 1) rotated = rotateClockwise(rotated);
      return rotated.x + "," + rotated.y;
    }),
  ),
);

const SHARED_INDEX = new Map(SHARED_TRACK.map((point, index) => [point.x + "," + point.y, index]));

export function getRoutePosition(
  color: keyof typeof PLAYER_ROUTES,
  steps: number,
): BoardPoint | null {
  if (steps < 1 || steps > 57) return null;
  return PLAYER_ROUTES[color][steps - 1] ?? null;
}

export function getSharedTrackIndex(
  color: keyof typeof PLAYER_ROUTES,
  steps: number,
): number | null {
  const position = getRoutePosition(color, steps);
  if (!position || steps > 51) return null;
  return SHARED_INDEX.get(position.x + "," + position.y) ?? null;
}

export function isSafeCell(point: BoardPoint | null): boolean {
  return point ? SAFE_CELLS.has(point.x + "," + point.y) : false;
}
