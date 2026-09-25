"use client";

import type { GameState, PlayerColor } from "@/lib/types";

const COLORS: Record<PlayerColor, { solid: string; glow: string }> = {
  red: { solid: "bg-red-500", glow: "ring-red-300" },
  green: { solid: "bg-emerald-500", glow: "ring-emerald-300" },
  blue: { solid: "bg-blue-600", glow: "ring-blue-300" },
  yellow: { solid: "bg-amber-400", glow: "ring-amber-200" },
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

function DiceFace({ value, disabled }: { value: number | null; disabled: boolean }) {
  const dots = value && PIPS[value] ? PIPS[value] : [];
  return (
    <div
      className={cx(
        "grid h-[68px] w-[68px] grid-cols-3 grid-rows-3 gap-1 rounded-2xl border-2 border-slate-300 bg-white p-2 shadow-[0_8px_20px_rgba(15,23,42,.18)] transition sm:h-[76px] sm:w-[76px]",
        !disabled && "hover:scale-[1.04]",
      )}
      aria-label={value ? "Dice " + value : "Roll dice"}
    >
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={cx("grid place-items-center", dots.includes(index) && "rounded-full bg-slate-900")} />
      ))}
    </div>
  );
}

export default function LudoGameBar({
  state,
  players,
  userId,
  playerId,
  onRoll,
  local = false,
}: {
  state: GameState;
  players: GameState["players"];
  userId?: string | null;
  playerId?: number | null;
  onRoll: () => void;
  local?: boolean;
}) {
  const current = state.players[state.currentPlayerIndex];
  const mine = local
    ? current?.id === playerId
    : Boolean(current?.userId && current.userId === userId);
  const canRoll = Boolean(mine && state.dice === null && state.status === "playing");

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-3 text-slate-900 shadow-xl sm:p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full items-center justify-center gap-3 sm:gap-4">
          <div className="min-w-0 flex-1 text-right">
            <div className="text-[10px] font-black uppercase tracking-[.22em] text-slate-400">
              {state.status === "finished" ? "Game Over" : mine ? "Your Turn" : "Player Turn"}
            </div>
            <div className="mt-1 flex items-center justify-end gap-2">
              <span className={cx("h-3 w-3 rounded-full", COLORS[current.color].solid)} />
              <span className="truncate text-sm font-black sm:text-base">{current.name}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onRoll}
            disabled={!canRoll}
            className={cx(
              "relative shrink-0 rounded-2xl p-1 transition",
              canRoll ? "ring-4 ring-emerald-300/70 hover:scale-[1.03]" : "opacity-90",
            )}
            aria-label="Roll dice"
          >
            <DiceFace value={state.dice} disabled={!canRoll} />
            {canRoll && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">Tap</span>}
          </button>

          <div className="min-w-0 flex-1 text-left">
            <div className="text-[10px] font-black uppercase tracking-[.22em] text-slate-400">Dice</div>
            <div className="mt-1 text-xl font-black">{state.dice ?? "—"}</div>
            <div className="truncate text-xs text-slate-500">{state.message}</div>
          </div>
        </div>

        <div className="grid w-full grid-cols-4 gap-2 border-t border-slate-200 pt-3">
          {players.map((player) => {
            const active = player.id === current.id;
            const minePlayer = local ? player.id === playerId : player.userId === userId;
            return (
              <div
                key={player.id}
                className={cx(
                  "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[10px] font-black sm:text-xs",
                  active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500",
                  minePlayer && "ring-2 " + COLORS[player.color].glow,
                )}
              >
                <span className={cx("h-2.5 w-2.5 rounded-full", COLORS[player.color].solid)} />
                <span className="truncate">{player.name}</span>
                {player.isBot && <span className="text-[8px] opacity-60">BOT</span>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
