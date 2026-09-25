"use client";

import type { GameState, Player, PlayerColor } from "@/lib/types";

const COLOR: Record<PlayerColor, { solid: string; soft: string; border: string; text: string }> = {
  red: { solid: "bg-red-500", soft: "bg-red-50", border: "border-red-300", text: "text-red-700" },
  green: { solid: "bg-emerald-500", soft: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700" },
  yellow: { solid: "bg-amber-400", soft: "bg-amber-50", border: "border-amber-300", text: "text-amber-700" },
  blue: { solid: "bg-blue-600", soft: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
};

const PIPS: Record<number, number[]> = { 1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8] };

function cx(...items: Array<string | false | null | undefined>) { return items.filter(Boolean).join(" "); }

export default function LudoPlayerDice({
  player, state, isCurrent, isMine, onRoll,
}: {
  player: Player; state: GameState; isCurrent: boolean; isMine: boolean; onRoll: () => void;
}) {
  const palette = COLOR[player.color];
  const canRoll = isCurrent && isMine && state.dice === null && state.status === "playing";
  const dots = isCurrent && state.dice ? PIPS[state.dice] ?? [] : [];
  return (
    <div className={cx("w-full rounded-2xl border-2 p-2 text-center shadow-lg sm:p-2.5", palette.soft, palette.border, isCurrent && "ring-2 ring-slate-900/10")}>
      <div className="flex items-center justify-center gap-1.5">
        <span className={cx("h-2.5 w-2.5 rounded-full", palette.solid)} />
        <span className={cx("truncate text-[10px] font-black uppercase tracking-widest", palette.text)}>{player.name}</span>
      </div>
      <button type="button" disabled={!canRoll} onClick={onRoll} aria-label={"Dice for " + player.name}
        className={cx("mx-auto mt-2 block rounded-xl p-1 transition", canRoll ? "scale-105 ring-4 ring-emerald-300/80 animate-pulse" : "")}>
        <div className={cx("grid h-14 w-14 grid-cols-3 grid-rows-3 gap-1 rounded-xl border-2 bg-white p-1.5 shadow-md sm:h-16 sm:w-16", palette.border)}>
          {Array.from({length:9},(_,i)=><span key={i} className={cx("rounded-full",dots.includes(i)?cx(palette.solid,"shadow-sm"):"bg-transparent")} />)}
        </div>
      </button>
      <div className="mt-1 text-[8px] font-black uppercase tracking-widest text-slate-400">
        {canRoll ? "TAP DICE" : isCurrent ? (state.dice !== null ? "CHOOSE TOKEN" : "TURN") : player.isBot ? "BOT" : "WAIT"}
      </div>
    </div>
  );
}
