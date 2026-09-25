"use client";

import { useCallback, useEffect, useState } from "react";
import LudoBoard from "@/components/ludo-board";
import LudoPlayerDice from "@/components/ludo-player-dice";
import LudoTableLayout from "@/components/ludo-table-layout";
import { getCurrentPlayer, getLegalMoves } from "@/game-engine/ludo-engine";
import { useLudoRealtime } from "@/hooks/use-ludo-realtime";
import ChatPanel from "@/components/chat-panel";
import VoiceCommand from "@/components/voice-command";
import type { GameState } from "@/lib/types";

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
    const interval = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [roomId, realtimeStatus, refresh]);

  const current = state ? getCurrentPlayer(state) : null;
  const legalMoves = state ? getLegalMoves(state) : [];
  const myPlayer = state?.players.find((player) => player.userId === userId) ?? null;
  const myTurn = Boolean(current && myPlayer && current.id === myPlayer.id);

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
      <main className="grid min-h-screen place-items-center bg-[#07111f] p-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[.06] px-8 py-6 text-center">
          <div className="text-xs font-bold uppercase tracking-[.25em] text-sky-300">Ludo Play</div>
          <div className="mt-2 text-xl font-black">Loading game…</div>
          {error && <div className="mt-3 text-sm text-amber-300">{error}</div>}
        </div>
      </main>
    );
  }

  const myPlayerId = myPlayer?.id ?? null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#18345c_0,#08111f_48%,#040914_100%)] px-3 py-4 text-white sm:px-6 sm:py-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.06] px-4 py-3 backdrop-blur-xl">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.3em] text-sky-300">Ludo Play • Online</p>
            <h1 className="text-xl font-black sm:text-2xl">Classic Ludo</h1>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest">
            <span className={realtimeStatus === "connected" ? "h-2.5 w-2.5 rounded-full bg-emerald-400" : "h-2.5 w-2.5 rounded-full bg-amber-400"} />
            {realtimeStatus === "connected" ? "Live" : "Syncing"}
          </div>
        </header>

        <LudoTableLayout
          topLeft={
            state.players[1] ? (
              <LudoPlayerDice
                player={state.players[1]}
                state={state}
                isCurrent={state.players[1].id === current.id}
                isMine={state.players[1].userId === userId}
                onRoll={roll}
              />
            ) : null
          }
          topRight={
            state.players[2] ? (
              <LudoPlayerDice
                player={state.players[2]}
                state={state}
                isCurrent={state.players[2].id === current.id}
                isMine={state.players[2].userId === userId}
                onRoll={roll}
              />
            ) : null
          }
          bottomLeft={
            state.players[0] ? (
              <LudoPlayerDice
                player={state.players[0]}
                state={state}
                isCurrent={state.players[0].id === current.id}
                isMine={state.players[0].userId === userId}
                onRoll={roll}
              />
            ) : null
          }
          bottomRight={
            state.players[3] ? (
              <LudoPlayerDice
                player={state.players[3]}
                state={state}
                isCurrent={state.players[3].id === current.id}
                isMine={state.players[3].userId === userId}
                onRoll={roll}
              />
            ) : null
          }
        >
          <div className="rounded-[30px] border border-white/10 bg-black/20 p-2 shadow-2xl sm:p-4">
            <LudoBoard
              state={state}
              playerId={myPlayerId}
              legalMoves={legalMoves}
              onToken={myTurn ? move : undefined}
            />
          </div>
        </LudoTableLayout>

        {error && <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-200">{error}</div>}

        {state.status === "playing" && <VoiceCommand gameId={gameId} state={state} enabled={myTurn} onGame={setState} />}

        {roomId && <ChatPanel roomId={roomId} />}

        {state.status === "finished" && (
          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-6 text-center">
            <div className="text-xs font-black uppercase tracking-[.25em] text-emerald-300">Game Over</div>
            <div className="mt-2 text-3xl font-black">
              🏆 {state.players.find((player) => player.id === state.winnerId)?.name} wins!
            </div>
            <a href="/rooms" className="mt-4 inline-block rounded-xl bg-white px-5 py-3 font-black text-slate-900">
              Back to Rooms
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
