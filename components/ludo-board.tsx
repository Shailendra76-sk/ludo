"use client";

import { useMemo } from "react";
import { CENTER, HOME_LANES, TRACK } from "@/game-engine/board";
import { FINISH_STEPS, SAFE_TRACK_INDEXES } from "@/game-engine/constants";
import { globalTrackIndex } from "@/game-engine/ludo-engine";
import type { GameState, PlayerColor } from "@/lib/types";

type Palette = {
  home: string;
  homeSoft: string;
  lane: string;
  token: string;
  tokenBorder: string;
};

const PALETTE: Record<PlayerColor, Palette> = {
  red: { home: "#ef2222", homeSoft: "#ffdddd", lane: "#ef2222", token: "#e51e2a", tokenBorder: "#ffffff" },
  green: { home: "#16a34a", homeSoft: "#dcfce7", lane: "#16a34a", token: "#159947", tokenBorder: "#ffffff" },
  blue: { home: "#2f5fd7", homeSoft: "#dce8ff", lane: "#2f5fd7", token: "#2d63d8", tokenBorder: "#ffffff" },
  yellow: { home: "#f2c400", homeSoft: "#fff6bf", lane: "#f2c400", token: "#e8bb00", tokenBorder: "#ffffff" },
};

const HOME_ZONES: Record<PlayerColor, { x0: number; y0: number; title: string }> = {
  red: { x0: 0, y0: 0, title: "Red" },
  green: { x0: 9, y0: 0, title: "Green" },
  blue: { x0: 0, y0: 9, title: "Blue" },
  yellow: { x0: 9, y0: 9, title: "Yellow" },
};

const BASE_SPOTS: Record<PlayerColor, Array<{ x: number; y: number }>> = {
  red: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 4 }, { x: 4, y: 4 }],
  green: [{ x: 10, y: 2 }, { x: 12, y: 2 }, { x: 10, y: 4 }, { x: 12, y: 4 }],
  blue: [{ x: 2, y: 10 }, { x: 4, y: 10 }, { x: 2, y: 12 }, { x: 4, y: 12 }],
  yellow: [{ x: 10, y: 10 }, { x: 12, y: 10 }, { x: 10, y: 12 }, { x: 12, y: 12 }],
};

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

function homeOwner(x: number, y: number): PlayerColor | null {
  if (x <= 5 && y <= 5) return "red";
  if (x >= 9 && y <= 5) return "green";
  if (x <= 5 && y >= 9) return "blue";
  if (x >= 9 && y >= 9) return "yellow";
  return null;
}

function laneOwner(x: number, y: number): PlayerColor | null {
  for (const color of Object.keys(HOME_LANES) as PlayerColor[]) {
    if (HOME_LANES[color].some((cell) => cell.x === x && cell.y === y)) return color;
  }
  return null;
}

function isCenterCell(x: number, y: number) {
  return x >= 6 && x <= 8 && y >= 6 && y <= 8;
}

function isSafeTrack(trackIndex: number) {
  return SAFE_TRACK_INDEXES.has(trackIndex);
}

export default function LudoBoard({
  state,
  playerId,
  legalMoves,
  onToken,
}: {
  state: GameState;
  playerId?: number | null;
  legalMoves: number[];
  onToken?: (tokenId: number) => void;
}) {
  const cells = useMemo(() => Array.from({ length: 225 }), []);
  const tokenCells = useMemo(() => {
    const result = new Map<number, Array<{ playerId: number; tokenId: number; finished: boolean; color: PlayerColor }>>();
    const add = (x: number, y: number, item: { playerId: number; tokenId: number; finished: boolean; color: PlayerColor }) => {
      const key = y * 15 + x;
      result.set(key, [...(result.get(key) ?? []), item]);
    };

    for (const player of state.players) {
      for (const token of player.tokens) {
        if (token.steps === 0) {
          const spot = BASE_SPOTS[player.color][token.id];
          add(spot.x, spot.y, { playerId: player.id, tokenId: token.id, finished: false, color: player.color });
          continue;
        }
        if (token.steps >= FINISH_STEPS) {
          add(7, 7, { playerId: player.id, tokenId: token.id, finished: true, color: player.color });
          continue;
        }
        const trackIndex = globalTrackIndex(player, token.steps);
        if (trackIndex !== null) {
          const cell = TRACK[trackIndex];
          add(cell.x, cell.y, { playerId: player.id, tokenId: token.id, finished: false, color: player.color });
          continue;
        }
        if (token.steps >= 53) {
          const lane = HOME_LANES[player.color][Math.min(5, token.steps - 53)];
          if (lane) add(lane.x, lane.y, { playerId: player.id, tokenId: token.id, finished: false, color: player.color });
        }
      }
    }
    return result;
  }, [state]);

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <div className="overflow-hidden rounded-[14px] border-[4px] border-slate-900 bg-white shadow-2xl">
        <div className="relative grid aspect-square grid-cols-15 grid-rows-15">
          {cells.map((_, index) => {
            const x = index % 15;
            const y = Math.floor(index / 15);
            const trackIndex = TRACK.findIndex((cell) => cell.x === x && cell.y === y);
            const home = homeOwner(x, y);
            const lane = laneOwner(x, y);
            const centerCell = isCenterCell(x, y);
            const items = tokenCells.get(index) ?? [];
            const isBaseSpot = home ? BASE_SPOTS[home].some((spot) => spot.x === x && spot.y === y) : false;
            const safe = trackIndex >= 0 && isSafeTrack(trackIndex);
            const startColor =
              trackIndex === 0 ? "red" :
              trackIndex === 13 ? "blue" :
              trackIndex === 26 ? "yellow" :
              trackIndex === 39 ? "green" : null;

            return (
              <div
                key={index}
                className={cx(
                  "relative flex items-center justify-center border border-slate-300/80 overflow-visible",
                  home ? "" : "bg-white",
                  lane ? "" : "",
                  centerCell ? "bg-white" : "",
                )}
                style={{
                  background: home ? PALETTE[home].home : lane ? PALETTE[lane].homeSoft : undefined,
                }}
              >
                {home && x === HOME_ZONES[home].x0 + 1 && y === HOME_ZONES[home].y0 + 1 && (
                  <div
                    className="pointer-events-none absolute left-[3%] top-[3%] z-[1] h-[394%] w-[394%] rounded-[4px] border border-slate-200 bg-white shadow-inner"
                  />
                )}

                {home && isBaseSpot && (
                  <div
                    className="pointer-events-none absolute z-[2] h-[58%] w-[58%] rounded-full border-2 bg-white shadow-sm"
                    style={{ borderColor: PALETTE[home].home }}
                  />
                )}

                {lane && (
                  <div
                    className={cx(
                      "absolute inset-[8%] rounded-[3px]",
                      lane === startColor ? "ring-2 ring-white/80" : "",
                    )}
                    style={{ background: PALETTE[lane].lane }}
                  />
                )}

                {trackIndex >= 0 && !lane && !home && (
                  <div
                    className={cx(
                      "absolute inset-0 bg-white",
                      startColor ? "shadow-inner" : "",
                    )}
                  />
                )}

                {safe && !home && !lane && !centerCell && (
                  <span className="relative z-[1] text-[15px] font-black leading-none text-slate-500 sm:text-lg">★</span>
                )}

                {startColor && !centerCell && (
                  <span
                    className="absolute inset-[9%] rounded-[3px] border-2"
                    style={{ borderColor: PALETTE[startColor].home }}
                  />
                )}

                {centerCell && x === 6 && y === 6 && (
                  <div className="pointer-events-none absolute inset-0 z-[2] h-[300%] w-[300%]">
                    <div className="absolute inset-0 bg-white" />
                    <div className="absolute inset-0 bg-red-500 [clip-path:polygon(0_0,50%_50%,0_50%)]" />
                    <div className="absolute inset-0 bg-green-500 [clip-path:polygon(100%_0,50%_50%,50%_0)]" />
                    <div className="absolute inset-0 bg-blue-600 [clip-path:polygon(0_100%,50%_50%,0_50%)]" />
                    <div className="absolute inset-0 bg-yellow-400 [clip-path:polygon(100%_100%,50%_50%,50%_100%)]" />
                    <div className="absolute inset-[2px] border-2 border-slate-400/60" />
                  </div>
                )}

                {items.length > 0 && (
                  <div className="relative z-[3] flex flex-wrap items-center justify-center gap-0.5">
                    {items.map((item) => {
                      const active = item.playerId === playerId && legalMoves.includes(item.tokenId) && Boolean(onToken);
                      return (
                        <button
                          key={item.playerId + "-" + item.tokenId}
                          type="button"
                          onClick={() => onToken?.(item.tokenId)}
                          disabled={!active}
                          aria-label={item.color + " token " + (item.tokenId + 1)}
                          className={cx(
                            "grid h-7 w-7 place-items-center rounded-full border-2 text-[10px] font-black text-white shadow-md transition sm:h-9 sm:w-9 sm:text-xs",
                            active ? "animate-pulse ring-4 ring-white" : "",
                            item.finished ? "scale-75" : "",
                          )}
                          style={{
                            background: PALETTE[item.color].token,
                            borderColor: PALETTE[item.color].tokenBorder,
                          }}
                        >
                          {item.finished ? "✓" : item.tokenId + 1}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 rounded-2xl border border-slate-300 bg-white p-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-700 sm:text-xs">
        {(Object.keys(HOME_ZONES) as PlayerColor[]).map((color) => (
          <div key={color} className="flex items-center justify-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ background: PALETTE[color].home }} />
            {HOME_ZONES[color].title}
          </div>
        ))}
      </div>
    </div>
  );
}
