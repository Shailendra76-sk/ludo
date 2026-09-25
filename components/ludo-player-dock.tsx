"use client";

import type { GameState, PlayerColor } from "@/lib/types";

const PLAYER_STYLE: Record<PlayerColor, { label: string; solid: string; soft: string; border: string }> = {
  red: { label: "Red", solid: "bg-red-500", soft: "bg-red-50", border: "border-red-300" },
  green: { label: "Green", solid: "bg-emerald-500", soft: "bg-emerald-50", border: "border-emerald-300" },
  blue: { label: "Blue", solid: "bg-blue-600", soft: "bg-blue-50", border: "border-blue-300" },
  yellow: { label: "Yellow", solid: "bg-amber-400", soft: "bg-amber-50", border: "border-amber-300" },
};

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

function DiceFace({ value }: { value: number | null }) {
  const spots = value && PIPS[value] ? PIPS[value] : [];
  return (
    <div className="grid h-16 w-16 grid-cols-3 grid-rows-3 gap-1 rounded-xl border-2 border-slate-300 bg-white p-2 shadow-lg sm:h-20 sm:w-20">
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={cx("grid place-items-center", spots.includes(index) && "rounded-full bg-slate-900")} />
      ))}
    </div>
  );
}

export default function LudoPlayerDock({
  state,
  userId,
  playerId,
  legalMoves,
  onRoll,
  onToken,
  local = false,
}: {
  state: GameState;
  userId?: string | null;
  playerId?: number | null;
  legalMoves: number[];
  onRoll: () => void;
  onToken: (tokenId: number) => void;
  local?: boolean;
}) {
  const current = state.players[state.currentPlayerIndex];
  const myPlayer = playerId == null ? undefined : state.players.find((p) => p.id === playerId);
  const myTurn = local || Boolean(myPlayer && current?.id === myPlayer.id);

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white/95 p-3 text-slate-900 shadow-2xl backdrop-blur sm:p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Turn</div>
          <div className="mt-1 flex items-center gap-2 text-lg font-black">
            <span className={cx("h-4 w-4 rounded-full", PLAYER_STYLE[current.color].solid)} />
            {current.name}
          </div>
          <div className="mt-0.5 text-sm text-slate-500">{state.message}</div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <DiceFace value={state.dice} />
          <button
            type="button"
            onClick={onRoll}
            disabled={!myTurn || state.dice !== null || state.status !== "playing"}
            className="min-w-32 rounded-2xl bg-slate-900 px-5 py-4 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35 sm:min-w-40"
          >
            🎲 ROLL
          </button>
        </div>
      </div>

      <div className="my-4 h-px bg-slate-200" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {state.players.map((player) => {
          const palette = PLAYER_STYLE[player.color];
          const mine = local ? player.id === playerId : player.userId === userId;
          const active = mine && current.id === player.id && state.dice !== null;

          return (
            <div
              key={player.id}
              className={cx(
                "rounded-2xl border p-3 transition",
                palette.soft,
                palette.border,
                player.id === current.id && "ring-2 ring-slate-900/10",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={cx("grid h-8 w-8 place-items-center rounded-full text-xs font-black text-white shadow", palette.solid)}>
                    {player.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <div className="text-sm font-black">{player.name}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {mine ? "You" : player.isBot ? "Bot" : "Player"}
                    </div>
                  </div>
                </div>
                {player.id === current.id && <span className="rounded-full bg-slate-900 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">Turn</span>}
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {player.tokens.map((token) => {
                  const canMove = active && legalMoves.includes(token.id);
                  return (
                    <button
                      key={token.id}
                      type="button"
                      disabled={!canMove}
                      onClick={() => onToken(token.id)}
                      className={cx(
                        "aspect-square rounded-xl border-2 text-sm font-black text-white shadow-sm transition",
                        palette.solid,
                        canMove ? "scale-105 border-white ring-2 ring-slate-900 animate-pulse" : "border-white/70 opacity-55",
                      )}
                      title={token.steps === 0 ? "Home" : token.steps >= 58 ? "Finished" : "Token " + (token.id + 1)}
                    >
                      {token.steps >= 58 ? "✓" : token.id + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
