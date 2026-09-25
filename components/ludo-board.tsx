"use client";

import { useMemo } from "react";
import { CENTER, HOME_LANES, TRACK } from "@/game-engine/board";
import { FINISH_STEPS } from "@/game-engine/constants";
import { globalTrackIndex } from "@/game-engine/ludo-engine";
import type { GameState, PlayerColor } from "@/lib/types";

const COLORS: Record<PlayerColor, { cell: string; ring: string; text: string }> = {
  red: { cell: "bg-red-500", ring: "ring-red-200", text: "text-red-700" },
  blue: { cell: "bg-blue-500", ring: "ring-blue-200", text: "text-blue-700" },
  green: { cell: "bg-emerald-500", ring: "ring-emerald-200", text: "text-emerald-700" },
  yellow: { cell: "bg-amber-400", ring: "ring-amber-100", text: "text-amber-700" },
};

const HOME_ZONES: Record<PlayerColor, { x0: number; y0: number; className: string; title: string }> = {
  red: { x0: 0, y0: 0, className: "bg-red-50", title: "Red" },
  blue: { x0: 10, y0: 0, className: "bg-blue-50", title: "Blue" },
  green: { x0: 10, y0: 10, className: "bg-emerald-50", title: "Green" },
  yellow: { x0: 0, y0: 10, className: "bg-amber-50", title: "Yellow" },
};

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

function laneOwner(x: number, y: number): PlayerColor | null {
  for (const color of Object.keys(HOME_LANES) as PlayerColor[]) {
    if (HOME_LANES[color].some((cell) => cell.x === x && cell.y === y)) return color;
  }
  return null;
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
    const result = new Map<number, { x: number; y: number; playerId: number; tokenId: number; finished: boolean }[]>();
    const add = (x: number, y: number, item: { playerId: number; tokenId: number; finished: boolean }) => {
      const key = y * 15 + x;
      result.set(key, [...(result.get(key) ?? []), { x, y, ...item }]);
    };

    const baseSpots: Record<PlayerColor, Array<{ x: number; y: number }>> = {
      red: [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 4 }, { x: 4, y: 4 }],
      blue: [{ x: 10, y: 2 }, { x: 12, y: 2 }, { x: 10, y: 4 }, { x: 12, y: 4 }],
      green: [{ x: 10, y: 10 }, { x: 12, y: 10 }, { x: 10, y: 12 }, { x: 12, y: 12 }],
      yellow: [{ x: 2, y: 10 }, { x: 4, y: 10 }, { x: 2, y: 12 }, { x: 4, y: 12 }],
    };

    for (const player of state.players) {
      player.tokens.forEach((token) => {
        if (token.steps === 0) {
          const spot = baseSpots[player.color][token.id];
          add(spot.x, spot.y, { playerId: player.id, tokenId: token.id, finished: false });
          return;
        }

        if (token.steps >= FINISH_STEPS) {
          add(CENTER.x, CENTER.y, { playerId: player.id, tokenId: token.id, finished: true });
          return;
        }

        const track = globalTrackIndex(player, token.steps);
        if (track !== null) {
          const cell = TRACK[track];
          add(cell.x, cell.y, { playerId: player.id, tokenId: token.id, finished: false });
          return;
        }

        if (token.steps >= 53) {
          const lane = HOME_LANES[player.color][Math.min(4, token.steps - 53)];
          if (lane) add(lane.x, lane.y, { playerId: player.id, tokenId: token.id, finished: false });
        }
      });
    }
    return result;
  }, [state]);

  const playerTokens = state.players.flatMap((player) =>
    player.tokens.map((token) => ({ player, token })),
  );

  return (
    <div className="mx-auto w-full max-w-[760px] overflow-hidden rounded-[28px] border-[5px] border-slate-900 bg-white shadow-2xl">
      <div className="relative grid aspect-square grid-cols-15 grid-rows-15">
        {cells.map((_, index) => {
          const x = index % 15;
          const y = Math.floor(index / 15);
          const trackIndex = TRACK.findIndex((cell) => cell.x === x && cell.y === y);
          const owner = laneOwner(x, y);
          const zone = (Object.keys(HOME_ZONES) as PlayerColor[]).find((color) => {
            const z = HOME_ZONES[color];
            return x >= z.x0 && x <= z.x0 + 4 && y >= z.y0 && y <= z.y0 + 4;
          });
          const center = x === CENTER.x && y === CENTER.y;
          const items = tokenCells.get(index) ?? [];

          return (
            <div
              key={index}
              className={cx(
                "relative flex items-center justify-center border border-slate-200",
                zone ? HOME_ZONES[zone].className : "bg-white",
                trackIndex >= 0 ? "bg-white" : "",
                owner ? COLORS[owner].cell.replace("bg-", "bg-opacity-20 bg-") : "",
                center ? "bg-gradient-to-br from-fuchsia-500 via-sky-500 to-emerald-500" : "",
              )}
            >
              {zone && x === HOME_ZONES[zone].x0 + 2 && y === HOME_ZONES[zone].y0 + 2 && (
                <div className={cx("absolute inset-1 rounded-[24px] border-4 border-white/80 shadow-inner", COLORS[zone].cell, "opacity-95")}><div className="absolute inset-[10%] rounded-full bg-white/95" /></div>
              )}

              {trackIndex >= 0 && (
                <span className="absolute left-0.5 top-0.5 text-[6px] font-bold text-slate-300 sm:text-[8px]">
                  {trackIndex + 1}
                </span>
              )}

              {owner && !center && <span className={cx("grid h-6 w-6 place-items-center rounded-full border-2 border-white/70 shadow-sm sm:h-7 sm:w-7", COLORS[owner].cell)}>{trackIndex + 1}</span>}
              {center && <div className="relative grid h-full w-full place-items-center"><div className="absolute inset-1 rotate-45 bg-red-500" /><div className="absolute inset-1 rotate-[135deg] bg-blue-500" /><span className="relative z-10 text-3xl font-black text-white drop-shadow sm:text-5xl">★</span></div>}

              {items.length > 0 && (
                <div className="relative z-10 flex flex-wrap justify-center gap-0.5">
                  {items.map((item) => {
                    const player = state.players.find((p) => p.id === item.playerId);
                    if (!player) return null;
                    const active = player.id === playerId && legalMoves.includes(item.tokenId) && Boolean(onToken);
                    return (
                      <button
                        key={player.id + "-" + item.tokenId}
                        type="button"
                        onClick={() => onToken?.(item.tokenId)}
                        disabled={!active}
                        aria-label={player.color + " token " + (item.tokenId + 1)}
                        className={cx(
                          "grid h-7 w-7 place-items-center rounded-full border-2 border-white text-[10px] font-black text-white shadow-md sm:h-9 sm:w-9 sm:text-xs",
                          COLORS[player.color].cell,
                          active ? "ring-4 ring-white animate-pulse" : "opacity-90",
                          item.finished ? "scale-75" : "",
                        )}
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
      <div className="grid grid-cols-4 gap-2 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 sm:text-xs">
        {(Object.keys(HOME_ZONES) as PlayerColor[]).map((color) => (
          <div key={color} className="flex items-center justify-center gap-2">
            <span className={cx("h-3 w-3 rounded-full", COLORS[color].cell)} />
            {HOME_ZONES[color].title}
          </div>
        ))}
      </div>
    </div>
  );
}
