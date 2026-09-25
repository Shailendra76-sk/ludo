"use client";

import {useEffect,useState} from "react";

type Stats={totalUsers:number;activeUsers:number;gamesToday:number;activeGames:number;completedGames:number;openReports:number};
type Setting={key:string;value:Record<string,unknown>};
export default function AdminPage(){
 const [stats,setStats]=useState<Stats|null>(null); const [users,setUsers]=useState<any[]>([]); const [games,setGames]=useState<any[]>([]); const [reports,setReports]=useState<any[]>([]); const [settings,setSettings]=useState<Setting[]>([]); const [error,setError]=useState("");
 async function load(){
  const calls=["/api/admin/dashboard","/api/admin/users","/api/admin/games","/api/admin/reports","/api/admin/settings"];
  const data=await Promise.all(calls.map(async u=>{const r=await fetch(u);const b=await r.json();if(!r.ok)throw new Error(b.error??"Access denied.");return b;}));
  setStats(data[0]);setUsers(data[1].users??[]);setGames(data[2].games??[]);setReports(data[3].reports??[]);setSettings(data[4].settings??[]);
 }
 useEffect(()=>{load().catch(e=>setError(e instanceof Error?e.message:"Unable to load admin panel."));},[]);
 async function action(userId:string,body:Record<string,unknown>){const r=await fetch("/api/admin/users/"+userId,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const b=await r.json();if(!r.ok)throw new Error(b.error??"Action failed.");await load();}
 async function saveSetting(key:string,value:Record<string,unknown>){
  const r=await fetch("/api/admin/settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,value})});
  const b=await r.json();if(!r.ok)throw new Error(b.error??"Setting update failed.");await load();
 }
 async function report(reportId:number,status:string){const r=await fetch("/api/admin/reports/"+reportId,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});const b=await r.json();if(!r.ok)throw new Error(b.error??"Action failed.");await load();}
 if(error)return <main className="min-h-screen grid place-items-center p-6 text-white"><div className="rounded-3xl bg-red-400/10 p-6">{error}</div></main>;
 return <main className="min-h-screen px-4 py-8 text-white"><div className="mx-auto max-w-7xl space-y-5">
  <header className="rounded-3xl border border-white/10 bg-white/[.06] p-6"><p className="text-xs font-bold uppercase tracking-[.3em] text-sky-300">Ludo Play • Admin</p><h1 className="mt-2 text-3xl font-black">Control Center</h1></header>
  {stats&&<section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{Object.entries(stats).map(([k,v])=><div key={k} className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><div className="text-xs text-slate-400">{k}</div><div className="mt-1 text-2xl font-black">{String(v)}</div></div>)}</section>}
  <section className="grid gap-5 lg:grid-cols-2">
   <div className="rounded-3xl border border-white/10 bg-white/[.06] p-5"><h2 className="text-xl font-black">Players</h2><div className="mt-3 space-y-2">{users.map(u=><div key={u.id} className="flex items-center justify-between rounded-2xl bg-black/20 p-3"><div><b>{u.username}</b><div className="text-xs text-slate-400">{u.email} · {u.gamesPlayed} games · rating {u.rating} · {u.role}</div></div><div className="flex gap-2">{u.role==="player"&&<button onClick={()=>action(u.id,{action:"role",role:"admin"}).catch(e=>setError(e.message))} className="rounded-lg bg-sky-400/10 px-3 py-2 text-xs text-sky-200">Make admin</button>}<button onClick={()=>action(u.id,{action:"suspend"}).catch(e=>setError(e.message))} className="rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-200">Revoke sessions</button></div></div>)}</div></div>
   <div className="rounded-3xl border border-white/10 bg-white/[.06] p-5"><h2 className="text-xl font-black">Games</h2><div className="mt-3 space-y-2">{games.map(g=><div key={g.id} className="rounded-2xl bg-black/20 p-3"><div className="font-bold">{g.id}</div><div className="text-xs text-slate-400">{g.status} · {g.playerCount}P · {g.mode} · v{g.stateVersion} · {new Date(g.updatedAt).toLocaleString()}</div></div>)}</div></div>
  </section>
  <section className="rounded-3xl border border-white/10 bg-white/[.06] p-5"><h2 className="text-xl font-black">Settings</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{settings.map(s=><div key={s.key} className="rounded-2xl bg-black/20 p-4"><div className="flex items-center justify-between"><b>{s.key}</b><button onClick={()=>{const next={...s.value, ...(s.key==="game"?{turnTimeSeconds:Number(s.value.turnTimeSeconds??15)===15?30:15}: {welcomeMessage:String(s.value.welcomeMessage??"Welcome to Ludo Play")}); saveSetting(s.key,next).catch(e=>setError(e.message));}} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold">Toggle sample</button></div><pre className="mt-2 overflow-x-auto text-xs text-slate-400">{JSON.stringify(s.value,null,2)}</pre></div>)}</div></section>
  <section className="rounded-3xl border border-white/10 bg-white/[.06] p-5"><h2 className="text-xl font-black">Reports</h2><div className="mt-3 space-y-2">{reports.map(r=><div key={r.id} className="rounded-2xl bg-black/20 p-3"><div className="flex flex-wrap justify-between gap-2"><b>#{r.id} · {r.reason}</b><span className="text-xs text-slate-400">{r.status}</span></div><div className="text-sm text-slate-300">{r.details}</div><div className="mt-2 flex gap-2"><button onClick={()=>report(r.id,"reviewing").catch(e=>setError(e.message))} className="rounded-lg bg-white/10 px-3 py-2 text-xs">Review</button><button onClick={()=>report(r.id,"resolved").catch(e=>setError(e.message))} className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">Resolve</button><button onClick={()=>report(r.id,"dismissed").catch(e=>setError(e.message))} className="rounded-lg bg-white/10 px-3 py-2 text-xs">Dismiss</button></div></div>)}</div></section>
 </div></main>
}
