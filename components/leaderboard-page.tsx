"use client";

import { useEffect, useState } from "react";

export default function LeaderboardPage() {
  const [rows,setRows]=useState<any[]>([]);
  useEffect(()=>{fetch("/api/leaderboard").then(r=>r.json()).then(b=>setRows(b.leaderboard??[]));},[]);
  return <main className="min-h-screen px-4 py-8 text-white"><div className="mx-auto max-w-5xl">
    <header className="mb-5 rounded-3xl border border-white/10 bg-white/[.06] p-6"><p className="text-xs font-bold uppercase tracking-[.3em] text-sky-300">Ludo Play</p><h1 className="mt-2 text-3xl font-black">Leaderboard</h1></header>
    <div className="overflow-hidden rounded-3xl border border-white/10"><table className="w-full text-left"><thead className="bg-white/[.06]"><tr><th className="p-4">#</th><th className="p-4">Player</th><th className="p-4">Rating</th><th className="p-4">Wins</th><th className="p-4">XP</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t border-white/10"><td className="p-4 font-black">{r.rank}</td><td className="p-4">{r.display_name}</td><td className="p-4 font-bold">{r.rating}</td><td className="p-4">{r.wins}</td><td className="p-4">{r.xp}</td></tr>)}</tbody></table></div>
  </div></main>;
}
