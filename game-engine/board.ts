import {
  CENTER,
  HOME_LANES,
  PLAYER_ROUTES,
  SHARED_TRACK,
  START_POSITIONS,
  getRoutePosition,
  isSafeCell,
} from "./paths";

export type Cell = { x: number; y: number };

export {
  CENTER,
  HOME_LANES,
  PLAYER_ROUTES,
  START_POSITIONS,
  SHARED_TRACK as TRACK,
  getRoutePosition,
  isSafeCell,
};

export function trackCell(trackIndex: number): Cell {
  return SHARED_TRACK[((trackIndex % SHARED_TRACK.length) + SHARED_TRACK.length) % SHARED_TRACK.length];
}
