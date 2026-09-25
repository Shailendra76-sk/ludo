"use client";

import { useState } from "react";
import LudoBoard from "@/components/ludo-board";
import LudoPlayerDock from "@/components/ludo-player-dock";
import { applyDice, createInitialState, getCurrentPlayer, getLegalMoves, moveToken } from "@/game-engine/ludo-engine";
import { secureLocalDice } from "@/lib/random";
import type { GameState } from "@/lib/types";

export default function LudoPlay() {
  const [state, setState] = useState<GameState>(() => createInitialState(4));

  const current = getCurrentPlayer(state);
  const legalMoves = getLegalMoves(state);

  function roll() {
    if (state.dice !== null || state.status !== "playing") return;
    setState((previous) => applyDice(previous, secureLocalDice()));
  }

  function selectToken(tokenId: number) {
    setState((previous) => moveToken(previous, tokenId));
  }

  function reset(players: 2 | 3 | 4) {
    setState(createInitialState(players));
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#18345c_0,#08111f_48%,#040914_100%)] px-3 py-4 text-white sm:px-6 sm:py-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.06] px-4 py-3 backdrop-blur-xl">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.3em] text-sky-300">Ludo Play</p>
            <h1 className="text-xl font-black sm:text-2xl">Classic Ludo</h1>
          </div>
          <div className="flex gap-2">
            {[2, 3, 4].map((players) => (
              <button
                key={players}
                type="button"
                onClick={() => reset(players as 2 | 3 | 4)}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/15"
              >
                {players}P
              </button>
            ))}
          </div>
        </header>

        <section className="rounded-[30px] border border-white/10 bg-black/20 p-2 shadow-2xl sm:p-4">
          <LudoBoard state={state} playerId={current.id} legalMoves={legalMoves} onToken={selectToken} />
        </section>

        <LudoPlayerDock
          state={state}
          playerId={current.id}
          legalMoves={legalMoves}
          onRoll={roll}
          onToken={selectToken}
          local
        />

        {state.status === "finished" && (
          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-6 text-center">
            <div className="text-xs font-black uppercase tracking-[.25em] text-emerald-300">Game Over</div>
            <div className="mt-2 text-3xl font-black">
              🏆 {state.players.find((player) => player.id === state.winnerId)?.name} wins!
            </div>
            <button type="button" onClick={() => reset(state.config.playerCount)} className="mt-4 rounded-xl bg-white px-5 py-3 font-black text-slate-900">
              Play Again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
