"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameState } from "@/lib/types";
import { buildReplayFrames, type ReplayFrame } from "@/lib/replay";

function playerLabel(state: GameState, index: number) {
  return state.players[index]?.name ?? "Player";
}

export default function ReplayViewer({ gameId }: { gameId: string }) {
  const [frames,setFrames]=useState<ReplayFrame[]>([]);
  const [index,setIndex]=useState(0);
  const [error,setError]=useState("");
  useEffect(()=>{
    fetch("/api/games/"+gameId+"/replay").then(r=>r.json()).then(b=>{
      if(b.error) throw new Error(b.error);
      setFrames(buildReplayFrames(b.frames??[]));
    }).catch(e=>setError(e instanceof Error?e.message:"Unable to load replay."));
  },[gameId]);
  const frame=frames[index];
  const summary=useMemo(()=>frame?{
    current:playerLabel(frame.state,frame.state.currentPlayerIndex),
    dice:frame.state.dice??"—",
    version:frame.state.stateVersion,
    event:frame.eventType
  }:null,[frame]);
  return <main className="min-h-screen px-4 py-8 text-white"><div className="mx-auto max-w-3xl space-y-5">
    <header className="rounded-3xl border border-white/10 bg-white/[.06] p-6"><p className="text-xs font-bold uppercase tracking-[.3em] text-sky-300">Ludo Play</p><h1 className="mt-2 text-3xl font-black">Game Replay</h1></header>
    {error&&<div className="rounded-2xl bg-red-400/10 p-4 text-red-200">{error}</div>}
    {!error&&!frame&&<div className="rounded-3xl border border-white/10 bg-white/[.06] p-6 text-slate-400">No replay frames available.</div>}
    {frame&&summary&&<section className="rounded-3xl border border-white/10 bg-white/[.06] p-6">
      <div className="grid gap-3 sm:grid-cols-4">{[["Frame",index+1+"/"+frames.length],["Event",summary.event],["Turn",summary.current],["Dice",summary.dice]].map(([k,v])=><div key={k} className="rounded-2xl bg-black/20 p-4"><div className="text-xs text-slate-500">{k}</div><div className="mt-1 font-black">{v}</div></div>)}</div>
      <input type="range" min={0} max={Math.max(0,frames.length-1)} value={index} onChange={e=>setIndex(Number(e.target.value))} className="mt-6 w-full"/>
      <div className="mt-5 flex items-center justify-between"><button disabled={index===0} onClick={()=>setIndex(i=>Math.max(0,i-1))} className="rounded-xl bg-white/10 px-4 py-2 disabled:opacity-30">Previous</button><span className="text-sm text-slate-400">{new Date(frame.createdAt).toLocaleString()}</span><button disabled={index===frames.length-1} onClick={()=>setIndex(i=>Math.min(frames.length-1,i+1))} className="rounded-xl bg-white/10 px-4 py-2 disabled:opacity-30">Next</button></div>
      <div className="mt-5 rounded-2xl bg-black/20 p-4 text-sm text-slate-300">{frame.state.message}</div>
    </section>}
  </div></main>;
}
