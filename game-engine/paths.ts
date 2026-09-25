export type BoardPoint = { x: number; y: number };

/**
 * Standard 15×15 Ludo route geometry.
 * Coordinates are [row, column]-style board cells represented as { x: column, y: row }.
 *
 * The reference board uses one fixed 57-position route per colour:
 * 52 shared-track cells + 5 private home-lane cells.
 * The centre is handled by the engine as the final finish position.
 */
const RED_HOME_ROUTE: BoardPoint[] = [
  { x: 6, y: 1 }, { x: 6, y: 2 }, { x: 6, y: 3 }, { x: 6, y: 4 }, { x: 6, y: 5 },
  { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 3, y: 6 }, { x: 2, y: 6 }, { x: 1, y: 6 }, { x: 0, y: 6 }, { x: 0, y: 7 },
  { x: 0, y: 8 }, { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 },
  { x: 6, y: 9 }, { x: 6, y: 10 }, { x: 6, y: 11 }, { x: 6, y: 12 }, { x: 6, y: 13 }, { x: 6, y: 14 },
  { x: 7, y: 14 }, { x: 8, y: 14 }, { x: 8, y: 13 }, { x: 8, y: 12 }, { x: 8, y: 11 }, { x: 8, y: 10 }, { x: 8, y: 9 },
  { x: 9, y: 8 }, { x: 10, y: 8 }, { x: 11, y: 8 }, { x: 12, y: 8 }, { x: 13, y: 8 }, { x: 14, y: 8 }, { x: 14, y: 7 }, { x: 14, y: 6 },
  { x: 13, y: 6 }, { x: 12, y: 6 }, { x: 11, y: 6 }, { x: 10, y: 6 }, { x: 9, y: 6 },
  { x: 8, y: 5 }, { x: 8, y: 4 }, { x: 8, y: 3 }, { x: 8, y: 2 }, { x: 8, y: 1 }, { x: 8, y: 0 },
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

/**
 * Visual colour order on the Ludo Play board:
 * red top-left → green top-right → yellow bottom-right → blue bottom-left.
 *
 * These map to four rotated copies of the same clockwise geometry.
 */
export const PLAYER_ROUTES = {
  red: RED_HOME_ROUTE,
  green: rotateRoute(RED_HOME_ROUTE, 3),
  yellow: rotateRoute(RED_HOME_ROUTE, 2),
  blue: rotateRoute(RED_HOME_ROUTE, 1),
} as const;

export const SHARED_TRACK = RED_HOME_ROUTE.slice(0, 52);

export const HOME_LANES = {
  red: RED_HOME_ROUTE.slice(52),
  green: rotateRoute(RED_HOME_ROUTE, 3).slice(52),
  yellow: rotateRoute(RED_HOME_ROUTE, 2).slice(52),
  blue: rotateRoute(RED_HOME_ROUTE, 1).slice(52),
} as const;

export const START_POSITIONS = {
  red: PLAYER_ROUTES.red[0],
  green: PLAYER_ROUTES.green[0],
  yellow: PLAYER_ROUTES.yellow[0],
  blue: PLAYER_ROUTES.blue[0],
} as const;

export const CENTER: BoardPoint = { x: 7, y: 7 };

/**
 * Exact safe/star cells from the classic board:
 * red start plus seven additional stars around the shared loop.
 */
const SAFE_CELLS_ARRAY: BoardPoint[] = [
  { x: 6, y: 1 },
  { x: 2, y: 6 },
  { x: 1, y: 8 },
  { x: 6, y: 12 },
  { x: 8, y: 13 },
  { x: 12, y: 8 },
  { x: 13, y: 6 },
  { x: 8, y: 2 },
];

export const SAFE_CELLS = new Set(SAFE_CELLS_ARRAY.map((point) => point.x + "," + point.y));

const SHARED_INDEX = new Map(
  SHARED_TRACK.map((point, index) => [point.x + "," + point.y, index]),
);

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
  if (!position || steps > 52) return null;
  return SHARED_INDEX.get(position.x + "," + position.y) ?? null;
}

export function isSafeCell(point: BoardPoint | null): boolean {
  return point ? SAFE_CELLS.has(point.x + "," + point.y) : false;
}
