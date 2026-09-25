"use client";

import { useEffect, useState } from "react";

export default function MatchmakingPanel() {
  const [players,setPlayers]=useState("2");
  const [status,setStatus]=useState("idle");
  const [roomCode,setRoomCode]=useState("");
  const [gameId,setGameId]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function refresh() {
    const r=await fetch("/api/matchmaking",{cache:"no-store"});
    const b=await r.json();
    if(!r.ok) throw new Error(b.error??"Unable to check matchmaking.");
    setStatus(b.status);
    setRoomCode(b.roomCode??"");
    setGameId(b.gameId??"");
  }

  useEffect(()=>{ refresh().catch(e=>setMessage(e instanceof Error?e.message:"Unable to load matchmaking.")); },[]);

  useEffect(()=>{
    if(status!=="queued") return;
    const id=window.setInterval(()=>refresh().catch(()=>undefined),1500);
    return ()=>window.clearInterval(id);
  },[status]);

  async function findMatch() {
    setBusy(true); setMessage("");
    try {
      const r=await fetch("/api/matchmaking",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({playerCount:Number(players)})});
      const b=await r.json();
      if(!r.ok) throw new Error(b.error??"Unable to start matchmaking.");
      if(b.roomId){setRoomCode(b.roomCode??"");setGameId(b.gameId??"");setStatus("matched");}
      else setStatus("queued");
    } catch(e){setMessage(e instanceof Error?e.message:"Unable to start matchmaking.");}
    finally{setBusy(false);}
  }

  async function cancel() {
    await fetch("/api/matchmaking",{method:"DELETE"});
    setStatus("idle"); setRoomCode(""); setGameId("");
  }

  return <main className="min-h-screen px-4 py-8 text-white"><div className="mx-auto max-w-2xl space-y-5">
    <header className="rounded-3xl border border-white/10 bg-white/[.06] p-6"><p className="text-xs font-bold uppercase tracking-[.3em] text-sky-300">Ludo Play</p><h1 className="mt-2 text-3xl font-black">Quick Match</h1><p className="mt-1 text-sm text-slate-400">Find public opponents automatically.</p></header>
    <section className="rounded-3xl border border-white/10 bg-white/[.06] p-6">
      <label className="text-sm text-slate-400">Players</label>
      <select value={players} onChange={e=>setPlayers(e.target.value)} disabled={status==="queued"} className="mt-2 w-full rounded-xl bg-slate-900 px-3 py-3"><option value="2">2 Players</option><option value="3">3 Players</option><option value="4">4 Players</option></select>
      <div className="mt-5 rounded-2xl bg-black/20 p-5 text-center"><div className="text-xs uppercase tracking-widest text-slate-500">Status</div><div className="mt-2 text-2xl font-black">{status==="queued"?"Searching…":status==="matched"?"Match found":"Ready"}</div>{roomCode&&<div className="mt-2 text-sm text-slate-400">Room {roomCode}</div>}</div>
      {status==="matched" ? <a href={"/play/"+gameId} className="mt-4 block rounded-xl bg-emerald-400 px-4 py-3 text-center font-black text-slate-950">Open Match</a> : status==="queued" ? <button onClick={cancel} className="mt-4 w-full rounded-xl bg-white/10 px-4 py-3 font-bold">Cancel Search</button> : <button disabled={busy} onClick={findMatch} className="mt-4 w-full rounded-xl bg-white px-4 py-3 font-black text-slate-900 disabled:opacity-50">Find Match</button>}
      {message&&<p className="mt-3 text-sm text-amber-300">{message}</p>}
    </section>
  </div></main>;
}
