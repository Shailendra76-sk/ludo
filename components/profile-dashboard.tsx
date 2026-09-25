"use client";

import { useEffect, useState } from "react";

type Profile = {
  display_name:string; bio:string; language:string; theme:string; rating:number; xp:number;
  games_played:number; wins:number; losses:number; current_streak:number; best_streak:number;
  tokens_captured:number; tokens_finished:number;
};

export default function ProfileDashboard() {
  const [profile,setProfile]=useState<Profile|null>(null);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  useEffect(()=>{ fetch("/api/profile").then(r=>r.json()).then(b=>setProfile(b.profile)).catch(()=>setMessage("Unable to load profile.")).finally(()=>setLoading(false)); },[]);
  async function save(){
    if(!profile) return;
    const r=await fetch("/api/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({display_name:profile.display_name,bio:profile.bio,language:profile.language,theme:profile.theme})});
    const b=await r.json().catch(()=>({}));
    if(!r.ok){setMessage(b.error??"Unable to save.");return;}
    setProfile(b.profile);setMessage("Profile saved.");
  }
  if(loading) return <main className="min-h-screen grid place-items-center text-white">Loading profile…</main>;
  if(!profile) return <main className="min-h-screen grid place-items-center text-white">Profile unavailable.</main>;
  const winRate=profile.games_played?Math.round((profile.wins/profile.games_played)*100):0;
  return <main className="min-h-screen px-4 py-8 text-white"><div className="mx-auto max-w-5xl space-y-5">
    <header className="rounded-3xl border border-white/10 bg-white/[.06] p-6"><p className="text-xs font-bold uppercase tracking-[.3em] text-sky-300">Ludo Play • Profile</p><h1 className="mt-2 text-3xl font-black">{profile.display_name}</h1><p className="mt-1 text-slate-400">Your statistics and settings.</p></header>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
      ["Rating",profile.rating],["XP",profile.xp],["Games",profile.games_played],["Win Rate",winRate+"%"]
    ].map(([k,v])=><div key={k} className="rounded-2xl border border-white/10 bg-white/[.05] p-5"><div className="text-sm text-slate-400">{k}</div><div className="mt-1 text-3xl font-black">{v}</div></div>)}</section>
    <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-3xl border border-white/10 bg-white/[.06] p-6"><h2 className="text-xl font-black">Profile</h2>
        <label className="mt-4 block text-sm text-slate-400">Display name</label><input value={profile.display_name} onChange={e=>setProfile({...profile,display_name:e.target.value})} className="mt-2 w-full rounded-xl bg-slate-900 px-3 py-3"/>
        <label className="mt-4 block text-sm text-slate-400">Bio</label><textarea value={profile.bio} onChange={e=>setProfile({...profile,bio:e.target.value})} maxLength={280} className="mt-2 min-h-28 w-full rounded-xl bg-slate-900 px-3 py-3"/>
        <div className="mt-4 flex gap-2"><button onClick={()=>setProfile({...profile,language:profile.language==="en"?"hi":"en"})} className="rounded-xl bg-white/10 px-4 py-2">Language: {profile.language}</button><button onClick={()=>setProfile({...profile,theme:profile.theme==="dark"?"light":"dark"})} className="rounded-xl bg-white/10 px-4 py-2">Theme: {profile.theme}</button></div>
        <button onClick={save} className="mt-5 rounded-xl bg-white px-5 py-3 font-black text-slate-900">Save</button>{message&&<p className="mt-3 text-sm text-slate-300">{message}</p>}
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/[.06] p-6"><h2 className="text-xl font-black">Progress</h2><div className="mt-4 space-y-4 text-sm"><div className="flex justify-between"><span>Wins</span><b>{profile.wins}</b></div><div className="flex justify-between"><span>Losses</span><b>{profile.losses}</b></div><div className="flex justify-between"><span>Current streak</span><b>{profile.current_streak}</b></div><div className="flex justify-between"><span>Best streak</span><b>{profile.best_streak}</b></div><div className="flex justify-between"><span>Tokens captured</span><b>{profile.tokens_captured}</b></div><div className="flex justify-between"><span>Tokens finished</span><b>{profile.tokens_finished}</b></div></div></div>
    </section>
  </div></main>;
}
