"use client";

import { useCallback, useEffect, useState } from "react";
import LudoBoard from "@/components/ludo-board";
import { getCurrentPlayer, getLegalMoves } from "@/game-engine/ludo-engine";
import ChatPanel from "@/components/chat-panel";
import VoiceCommand from "@/components/voice-command";
import type { GameState, PlayerColor } from "@/lib/types";

const COLORS: Record<PlayerColor, string> = {
  red: "bg-red-500",
  blue: "bg-blue-600",
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
};

type GameResponse = { game: GameState; roomId: string | null };

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

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((body) => setUserId(body.user?.id ?? ""))
      .catch(() => undefined);
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Unable to load game."));
  }, [refresh]);

  useEffect(() => {
    if (!roomId) return;
    const interval = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [roomId, refresh]);

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
    setState(body.game as GameState);
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

  if (!state || !current) {
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
    <main className="min-h-screen px-3 py-5 text-white sm:px-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="rounded-3xl border border-white/10 bg-white/[.06] p-4 backdrop-blur-xl sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.3em] text-sky-300">Ludo Play</p>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">Classic Ludo</h1>
              <p className="mt-1 text-sm text-slate-400">Play by tapping your token or using the controls below.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold uppercase tracking-wider">
              {state.status === "finished" ? "GAME OVER" : myTurn ? "YOUR TURN" : "OPPONENT TURN"}
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/[.04] p-2 shadow-2xl sm:p-4">
          <LudoBoard state={state} playerId={current.id === undefined ? null : state.players.find((p) => p.userId === userId)?.id ?? null} legalMoves={legalMoves} onToken={move} />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[.06] p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="flex items-center gap-3">
              <span className={`h-4 w-4 rounded-full ${COLORS[current.color]}`} />
              <div>
                <div className="text-sm font-bold">Current Player</div>
                <div className="text-lg font-black">{current.name}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-24 rounded-2xl bg-black/20 px-5 py-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dice</div>
                <div className="mt-1 text-4xl font-black">{state.dice ?? "—"}</div>
              </div>
              <button
                onClick={roll}
                disabled={!myTurn || state.dice !== null || state.status !== "playing"}
                className="min-w-32 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
              >
                🎲 ROLL DICE
              </button>
            </div>

            <div className="text-left md:text-right">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Message</div>
              <div className="mt-1 text-sm text-slate-200">{state.message}</div>
            </div>
          </div>

          {error && <div className="mt-4 rounded-xl bg-amber-300/10 p-3 text-sm text-amber-200">{error}</div>}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {state.players.map((player) => {
            const mine = player.userId === userId;
            return (
              <div key={player.id} className={`rounded-2xl border border-white/10 bg-white/[.05] p-4 ${mine ? "ring-2 ring-sky-300/50" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${COLORS[player.color]}`} />
                    <span className="font-black">{player.name}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {mine ? "You" : player.isBot ? "Bot" : "Player"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {player.tokens.map((token) => {
                    const active = mine && myTurn && legalMoves.includes(token.id);
                    return (
                      <button
                        key={token.id}
                        type="button"
                        disabled={!active}
                        onClick={() => move(token.id)}
                        className={`aspect-square rounded-xl text-sm font-black text-white transition ${COLORS[player.color]} ${active ? "ring-2 ring-white scale-105" : "opacity-45"}`}
                      >
                        {token.steps >= 58 ? "✓" : token.id + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        {state.status === "playing" && <VoiceCommand gameId={gameId} state={state} enabled={myTurn} onGame={setState} />}

        {roomId && <ChatPanel roomId={roomId} />}

        {state.status === "finished" && (
          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-5 text-center">
            <div className="text-sm font-bold uppercase tracking-widest text-emerald-300">Game Over</div>
            <div className="mt-2 text-3xl font-black">
              🏆 {state.players.find((p) => p.id === state.winnerId)?.name} wins!
            </div>
            <a href="/rooms" className="mt-4 inline-block rounded-xl bg-white px-4 py-2 font-bold text-slate-900">
              Back to Rooms
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
