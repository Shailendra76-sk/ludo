"use client";

import { useEffect, useState } from "react";
import type { Room, RoomPlayer } from "@/lib/types";

type Props = {
  initialRoomId?: string;
};

type RoomResponse = {
  room: Room;
  players: RoomPlayer[];
  game: { state: { status: string; stateVersion: number; message: string } } | null;
};

export default function RoomLobby({ initialRoomId }: Props) {
  const [roomId, setRoomId] = useState(initialRoomId ?? "");
  const [code, setCode] = useState("");
  const [data, setData] = useState<RoomResponse | null>(null);
  const [players, setPlayers] = useState("4");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  async function requestJson(url: string, options?: RequestInit) {
    const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Request failed.");
    return body;
  }

  async function create() {
    setBusy(true); setMessage("");
    try {
      const body = await requestJson("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ visibility: "private", config: { playerCount: Number(players), mode: "classic" } }),
      });
      setRoomId(body.room.id);
      await refresh(body.room.id);
      setMessage("Room created. Share the code with your players.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to create room.");
    } finally { setBusy(false); }
  }

  async function join() {
    setBusy(true); setMessage("");
    try {
      const body = await requestJson("/api/rooms/join", { method: "POST", body: JSON.stringify({ code }) });
      setRoomId(body.roomId);
      await refresh(body.roomId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to join room.");
    } finally { setBusy(false); }
  }

  async function refresh(id = roomId) {
    if (!id) return;
    try {
      const body = await requestJson("/api/rooms/" + id);
      setData(body);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to load room.");
    }
  }

  async function ready(value: boolean) {
    try {
      await requestJson("/api/rooms/" + roomId + "/ready", { method: "POST", body: JSON.stringify({ ready: value }) });
      await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to update ready state."); }
  }

  async function start() {
    setBusy(true);
    try {
      await requestJson("/api/rooms/" + roomId + "/start", { method: "POST" });
      await refresh();
      setMessage("Game started.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to start game."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    fetch("/api/auth/me").then((response) => response.json()).then((body) => {
      if (body.user?.id) setCurrentUserId(body.user.id);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const id = window.setInterval(() => refresh(roomId), 2000);
    refresh(roomId);
    return () => window.clearInterval(id);
  }, [roomId]);

  const me = data?.players.find((p) => p.userId === currentUserId);
  const meIsReady = me?.ready ?? false;

  return (
    <main className="min-h-screen px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-3xl border border-white/10 bg-white/[.06] p-6 backdrop-blur-xl">
          <p className="text-xs font-bold uppercase tracking-[.3em] text-sky-300">Ludo Play • Rooms</p>
          <h1 className="mt-2 text-3xl font-black">Create or Join a Room</h1>
          <p className="mt-1 text-sm text-slate-400">Phase 4 lobby foundation. Realtime transport is added in the dedicated multiplayer phase.</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[.06] p-5">
            <h2 className="text-xl font-bold">Create Room</h2>
            <label className="mt-4 block text-sm text-slate-400">Players</label>
            <select value={players} onChange={(e) => setPlayers(e.target.value)} className="mt-2 w-full rounded-xl bg-slate-900 px-3 py-3">
              <option value="2">2 Players</option>
              <option value="3">3 Players</option>
              <option value="4">4 Players</option>
            </select>
            <button disabled={busy} onClick={create} className="mt-4 w-full rounded-xl bg-white px-4 py-3 font-black text-slate-900 disabled:opacity-50">Create Room</button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[.06] p-5">
            <h2 className="text-xl font-bold">Join Room</h2>
            <label className="mt-4 block text-sm text-slate-400">6-character code</label>
            <input maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="mt-2 w-full rounded-xl bg-slate-900 px-3 py-3 font-mono tracking-widest" placeholder="A7K9P2" />
            <button disabled={busy || code.length !== 6} onClick={join} className="mt-4 w-full rounded-xl bg-sky-400 px-4 py-3 font-black text-slate-950 disabled:opacity-50">Join Room</button>
          </div>
        </section>

        {data && (
          <section className="rounded-3xl border border-white/10 bg-white/[.06] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm text-slate-400">Room code</div>
                <div className="mt-1 text-3xl font-black tracking-[.25em]">{data.room.code}</div>
              </div>
              <div className="rounded-xl bg-black/20 px-4 py-2 text-sm">{data.players.length}/{data.room.maxPlayers} players</div>
            </div>

            <div className="mt-6 space-y-3">
              {data.players.map((player) => (
                <div key={player.userId} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div>
                    <div className="font-bold">{player.username}</div>
                    <div className="text-xs text-slate-400">Slot {player.playerSlot + 1}{player.userId === data.room.hostUserId ? " • Host" : ""}</div>
                  </div>
                  <span className={player.ready ? "text-emerald-300" : "text-slate-500"}>{player.ready ? "READY" : "NOT READY"}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={() => ready(!meIsReady)} className="rounded-xl bg-emerald-400 px-4 py-3 font-black text-slate-950">Toggle Ready</button>
              {me && data.room.hostUserId === me.userId && (
                <button onClick={start} disabled={busy} className="rounded-xl bg-white px-4 py-3 font-black text-slate-900 disabled:opacity-50">Start Game</button>
              )}
            </div>

            {data.game && <p className="mt-4 text-sm text-slate-400">Game state version: {data.game.state.stateVersion} • {data.game.state.message}</p>}
          </section>
        )}

        {message && <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-200">{message}</div>}
      </div>
    </main>
  );
}
