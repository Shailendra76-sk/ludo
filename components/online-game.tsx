"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HOME_LANES, CENTER, TRACK } from "@/game-engine/board";
import { COLOR_NAMES, FINISH_STEPS } from "@/game-engine/constants";
import { getCurrentPlayer, getLegalMoves, globalTrackIndex } from "@/game-engine/ludo-engine";
import { useLudoRealtime } from "@/hooks/use-ludo-realtime";
import type { GameState, PlayerColor } from "@/lib/types";

const DOT: Record<PlayerColor, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-amber-400",
};

const LANE: Record<PlayerColor, string> = {
  red: "bg-red-100",
  blue: "bg-blue-100",
  green: "bg-green-100",
  yellow: "bg-amber-100",
};

type GameResponse = { game: GameState; roomId: string | null };

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

function actionId() {
  return crypto.randomUUID();
}

export default function OnlineGame({ gameId }: { gameId: string }) {
  const [state, setState] = useState<GameState | null>(null);
  const [roomId, setRoomId] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/games/" + gameId, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Unable to load game.");
    const data = body as GameResponse;
    setState(data.game);
    setRoomId(data.roomId ?? "");
  }, [gameId]);

  const { status: realtimeStatus } = useLudoRealtime({
    roomId,
    onEvent: () => {
      void refresh().catch((e) => setError(e instanceof Error ? e.message : "Unable to sync game."));
    },
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((body) => setUserId(body.user?.id ?? ""))
      .catch(() => undefined);
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Unable to load game."));
  }, [refresh]);

  useEffect(() => {
    if (!roomId || realtimeStatus === "connected") return;
    const id = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(id);
  }, [roomId, realtimeStatus, refresh]);

  const current = state ? getCurrentPlayer(state) : null;
  const legalMoves = state ? getLegalMoves(state) : [];
  const myTurn = Boolean(current?.userId && current.userId === userId);

  async function mutate(url: string, payload: Record<string, unknown>) {
    setError("");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Game action failed.");
    setState(body.game);
  }

  async function roll() {
    try {
      await mutate("/api/games/" + gameId + "/roll", { actionId: actionId() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to roll dice.");
    }
  }

  async function move(tokenId: number) {
    try {
      await mutate("/api/games/" + gameId + "/move", { actionId: actionId(), tokenId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to move token.");
    }
  }

  const boardCells = useMemo(() => Array.from({ length: 225 }), []);

  if (!state) {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[.06] px-8 py-6 text-center">
          <div className="text-xs font-bold uppercase tracking-[.25em] text-sky-300">Ludo Play</div>
          <div className="mt-2 text-xl font-black">Loading game…</div>
          {error && <div className="mt-3 text-sm text-amber-300">{error}</div>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-3 py-5 sm:px-6 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="rounded-3xl border border-white/10 bg-white/[.06] p-5 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.3em] text-sky-300">Ludo Play • Online Game</p>
              <h1 className="mt-1 text-3xl font-black">Multiplayer Table</h1>
              <p className="mt-1 text-sm text-slate-400">Authoritative game state with realtime synchronization.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold uppercase tracking-wider">
              Realtime: {realtimeStatus}
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="rounded-3xl border border-white/10 bg-white/[.05] p-2 sm:p-4">
            <div className="mx-auto grid aspect-square w-full max-w-[760px] grid-cols-[repeat(15,minmax(0,1fr))] grid-rows-[repeat(15,minmax(0,1fr))] overflow-hidden rounded-2xl border-4 border-slate-900/30 bg-slate-200 shadow-2xl">
              {boardCells.map((_, index) => {
                const x = index % 15;
                const y = Math.floor(index / 15);
                const trackIndex = TRACK.findIndex((cell) => cell.x === x && cell.y === y);
                const laneColor = (Object.keys(HOME_LANES) as PlayerColor[]).find((color) =>
                  HOME_LANES[color].some((cell) => cell.x === x && cell.y === y),
                );
                const isCenter = x === CENTER.x && y === CENTER.y;

                const tokensHere = state.players.flatMap((player) =>
                  player.tokens
                    .filter((token) => token.steps > 0 && token.steps < FINISH_STEPS)
                    .filter((token) => {
                      const mapped = globalTrackIndex(player, token.steps);
                      return mapped !== null && mapped === trackIndex;
                    })
                    .map((token) => ({ player, token })),
                );

                return (
                  <div
                    key={index}
                    className={cx(
                      "relative flex items-center justify-center border border-slate-300/70 text-[7px] sm:text-[9px]",
                      trackIndex >= 0 ? "bg-white" : "bg-slate-100",
                      laneColor ? LANE[laneColor] : "",
                      isCenter ? "bg-gradient-to-br from-fuchsia-500 via-sky-400 to-emerald-400" : "",
                    )}
                  >
                    {trackIndex >= 0 && <span className="absolute left-0.5 top-0.5 text-slate-400">{trackIndex + 1}</span>}
                    {isCenter && <span className="text-xl font-black text-white sm:text-4xl">🏠</span>}

                    {tokensHere.length > 0 && (
                      <div className="z-10 flex -space-x-1">
                        {tokensHere.map(({ player, token }) => {
                          const active = myTurn && player.id === current?.id && legalMoves.includes(token.id);
                          return (
                            <button
                              key={player.id + "-" + token.id}
                              onClick={() => move(token.id)}
                              disabled={!active}
                              aria-label={COLOR_NAMES[player.color] + " token " + (token.id + 1)}
                              className={cx(
                                "grid h-6 w-6 place-items-center rounded-full border-2 border-white text-[9px] font-black text-white shadow sm:h-8 sm:w-8",
                                DOT[player.color],
                                active ? "animate-bounce ring-2 ring-white" : "opacity-80",
                              )}
                            >
                              {token.id + 1}
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

          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/[.06] p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Current turn</div>
              <div className="mt-2 flex items-center gap-3">
                {current && <span className={cx("h-4 w-4 rounded-full", DOT[current.color])} />}
                <div>
                  <div className="text-xl font-black">{current?.name}</div>
                  <div className="text-sm text-slate-400">{state.message}</div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/20 p-3">
                  <div className="text-xs text-slate-400">Dice</div>
                  <div className="mt-1 text-4xl font-black">{state.dice ?? "—"}</div>
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  <div className="text-xs text-slate-400">Version</div>
                  <div className="mt-1 text-2xl font-black">{state.stateVersion}</div>
                </div>
              </div>

              <button
                onClick={roll}
                disabled={!myTurn || state.dice !== null || state.status !== "playing"}
                className="mt-4 w-full rounded-2xl bg-white px-5 py-4 text-base font-black text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                🎲 ROLL DICE
              </button>

              {error && <div className="mt-4 rounded-xl bg-amber-300/10 p-3 text-sm text-amber-200">{error}</div>}
            </div>

            <div className="space-y-3">
              {state.players.map((player) => (
                <div key={player.id} className={cx("rounded-2xl border border-white/10 bg-white/[.04] p-4", player.userId === userId ? "ring-2 ring-sky-300/50" : "")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cx("h-3 w-3 rounded-full", DOT[player.color])} />
                      <span className="font-bold">{player.name}</span>
                    </div>
                    <span className="text-xs text-slate-400">{player.isBot ? "BOT" : player.userId ? "ONLINE" : "OPEN"}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {player.tokens.map((token) => (
                      <div key={token.id} className={cx("aspect-square rounded-xl border border-white/10 grid place-items-center text-sm font-black text-white", DOT[player.color], token.steps >= FINISH_STEPS ? "opacity-100" : "opacity-60")}>
                        {token.steps >= FINISH_STEPS ? "✓" : token.id + 1}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {state.status === "finished" && (
              <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-5 text-center">
                <div className="text-sm font-bold uppercase tracking-widest text-emerald-300">Game Over</div>
                <div className="mt-2 text-3xl font-black">🏆 {state.players.find((p) => p.id === state.winnerId)?.name} wins!</div>
                <a href="/rooms" className="mt-4 inline-block rounded-xl bg-white px-4 py-2 font-bold text-slate-900">Back to Rooms</a>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
