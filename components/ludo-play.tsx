"use client";

import { useState } from "react";
import LudoBoard from "@/components/ludo-board";
import { applyDice, createInitialState, getCurrentPlayer, getLegalMoves, globalTrackIndex, moveToken } from "@/game-engine/ludo-engine";
import { COLOR_NAMES } from "@/game-engine/constants";
import { secureLocalDice } from "@/lib/random";
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

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

export default function LudoPlay() {
  const [state, setState] = useState<GameState>(() => createInitialState(4));
  const current = getCurrentPlayer(state);
  const legalMoves = getLegalMoves(state);

  function roll() {
    if (state.dice !== null || state.status !== "playing") return;
    setState((s) => applyDice(s, secureLocalDice()));
  }

  function selectToken(tokenId: number) {
    setState((s) => moveToken(s, tokenId));
  }

  function reset(players: 2 | 3 | 4) {
    setState(createInitialState(players));
  }

  const cellCount = 225;

  return (
    <main className="min-h-screen px-3 py-5 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="rounded-3xl border border-white/10 bg-white/[.06] p-5 shadow-2xl backdrop-blur">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.3em] text-sky-300">Ludo Play • Phase 1</p>
              <h1 className="mt-1 text-3xl font-black sm:text-4xl">Classic Ludo Foundation</h1>
              <p className="mt-1 text-sm text-slate-400">Playable board, deterministic rules, legal-move validation and turn engine.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[2, 3, 4].map((players) => (
                <button key={players} onClick={() => reset(players as 2 | 3 | 4)} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/15">
                  New {players}P
                </button>
              ))}
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="rounded-3xl border border-white/10 bg-white/[.05] p-2 sm:p-4">
            <LudoBoard state={state} playerId={current.id} legalMoves={legalMoves} onToken={selectToken} />
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/[.06] p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Current turn</div>
              <div className="mt-2 flex items-center gap-3">
                <span className={cx("h-4 w-4 rounded-full", DOT[current.color])} />
                <div>
                  <div className="text-xl font-black">{current.name}</div>
                  <div className="text-sm text-slate-400">{state.message}</div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/20 p-3">
                  <div className="text-xs text-slate-400">Dice</div>
                  <div className="mt-1 text-4xl font-black">{state.dice ?? "—"}</div>
                </div>
                <div className="rounded-2xl bg-black/20 p-3">
                  <div className="text-xs text-slate-400">Turn</div>
                  <div className="mt-1 text-4xl font-black">{state.turnNumber}</div>
                </div>
              </div>

              <button
                onClick={roll}
                disabled={state.dice !== null || state.status !== "playing"}
                className="mt-4 w-full rounded-2xl bg-white px-5 py-4 text-base font-black text-slate-900 shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
              >
                🎲 ROLL DICE
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {state.players.map((player) => (
                <div key={player.id} className={cx("rounded-2xl border border-white/10 bg-white/[.04] p-4", player.id === current.id ? "ring-2 ring-white/30" : "")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cx("h-3 w-3 rounded-full", DOT[player.color])} />
                      <span className="font-bold">{player.name}</span>
                    </div>
                    {player.id === current.id && <span className="text-xs font-bold text-emerald-300">YOUR TURN</span>}
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {player.tokens.map((token) => {
                      const active = player.id === current.id && legalMoves.includes(token.id);
                      return (
                        <button
                          key={token.id}
                          disabled={!active}
                          onClick={() => selectToken(token.id)}
                          className={cx("aspect-square rounded-xl border border-white/10 grid place-items-center text-sm font-black text-white", DOT[player.color], active ? "ring-2 ring-white" : "opacity-40")}
                          title={token.steps >= FINISH_STEPS ? "Finished" : token.steps === 0 ? "Base" : "Step " + token.steps}
                        >
                          {token.steps >= FINISH_STEPS ? "✓" : token.id + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {state.status === "finished" && (
              <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-5 text-center">
                <div className="text-sm font-bold uppercase tracking-widest text-emerald-300">Game Over</div>
                <div className="mt-2 text-3xl font-black">🏆 {state.players.find((p) => p.id === state.winnerId)?.name} wins!</div>
                <button onClick={() => reset(state.config.playerCount)} className="mt-4 rounded-xl bg-white px-4 py-2 font-bold text-slate-900">
                  Play Again
                </button>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
