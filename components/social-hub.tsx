"use client";

import { useEffect, useState } from "react";

type Friend = { userId:string; username:string; displayName:string; online:boolean; inGame:boolean; };
type SearchUser = Friend;
type Request = { id:string; requesterId:string; requesterUsername:string; requesterDisplayName:string; addresseeId:string; status:string; };

export default function SocialHub() {
  const [friends,setFriends]=useState<Friend[]>([]);
  const [incoming,setIncoming]=useState<Request[]>([]);
  const [search,setSearch]=useState("");
  const [results,setResults]=useState<SearchUser[]>([]);
  const [notifications,setNotifications]=useState<{id:number;title:string;body:string;readAt:string|null}[]>([]);
  const [unread,setUnread]=useState(0);
  const [message,setMessage]=useState("");

  async function json(url:string, options?:RequestInit) {
    const r=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options?.headers??{})}});
    const b=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(b.error??"Request failed.");
    return b;
  }

  async function load() {
    const [f,req,n]=await Promise.all([
      json("/api/friends"),
      json("/api/friends/requests?direction=incoming"),
      json("/api/notifications"),
    ]);
    setFriends(f.friends??[]); setIncoming(req.requests??[]); setNotifications(n.items??[]); setUnread(n.unread??0);
  }

  useEffect(()=>{ load().catch(e=>setMessage(e instanceof Error?e.message:"Unable to load social data.")); },[]);

  async function find() {
    if(search.trim().length<2){setResults([]);return;}
    try { const b=await json("/api/social/search?q="+encodeURIComponent(search.trim())); setResults(b.users??[]); }
    catch(e){setMessage(e instanceof Error?e.message:"Search failed.");}
  }

  async function add(userId:string) {
    try { await json("/api/friends",{method:"POST",body:JSON.stringify({userId})}); setMessage("Friend request sent."); await load(); }
    catch(e){setMessage(e instanceof Error?e.message:"Unable to send request.");}
  }

  async function respond(id:string, decision:"accepted"|"rejected") {
    try { await json("/api/friends/requests/"+id,{method:"POST",body:JSON.stringify({decision})}); await load(); }
    catch(e){setMessage(e instanceof Error?e.message:"Unable to respond.");}
  }

  async function remove(userId:string) {
    try { await fetch("/api/friends/"+userId,{method:"DELETE"}); await load(); }
    catch(e){setMessage(e instanceof Error?e.message:"Unable to remove friend.");}
  }

  async function block(userId:string) {
    try {
      const b=await json("/api/friends/"+userId,{method:"POST",body:JSON.stringify({})});
      void b;
      setMessage("Player blocked.");
      await load();
    } catch(e){setMessage(e instanceof Error?e.message:"Unable to block player.");}
  }

  async function markAll() {
    await json("/api/notifications",{method:"POST",body:JSON.stringify({id:"all"})});
    await load();
  }

  return <main className="min-h-screen px-4 py-8 text-white"><div className="mx-auto max-w-6xl space-y-5">
    <header className="rounded-3xl border border-white/10 bg-white/[.06] p-6"><p className="text-xs font-bold uppercase tracking-[.3em] text-sky-300">Ludo Play • Social</p><h1 className="mt-2 text-3xl font-black">Friends & Notifications</h1><p className="mt-1 text-sm text-slate-400">Connect with players and stay informed.</p></header>
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-3xl border border-white/10 bg-white/[.06] p-5">
        <h2 className="text-xl font-black">Find Players</h2>
        <div className="mt-3 flex gap-2"><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&find()} placeholder="Username or display name" className="min-w-0 flex-1 rounded-xl bg-slate-900 px-3 py-3"/><button onClick={find} className="rounded-xl bg-sky-400 px-4 py-3 font-black text-slate-950">Search</button></div>
        <div className="mt-4 space-y-2">{results.map(u=><div key={u.userId} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-3"><div><b>{u.displayName}</b><div className="text-xs text-slate-400">@{u.username} · {u.online?"Online":"Offline"}{u.inGame?" · In game":""}</div></div><button onClick={()=>add(u.userId)} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold">Add</button></div>)}</div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/[.06] p-5">
        <div className="flex items-center justify-between"><h2 className="text-xl font-black">Incoming Requests</h2><span className="rounded-full bg-white/10 px-3 py-1 text-sm">{incoming.length}</span></div>
        <div className="mt-4 space-y-2">{incoming.map(r=><div key={r.id} className="rounded-2xl border border-white/10 bg-black/20 p-3"><b>{r.requesterDisplayName}</b><div className="mt-2 flex gap-2"><button onClick={()=>respond(r.id,"accepted")} className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-black text-slate-950">Accept</button><button onClick={()=>respond(r.id,"rejected")} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold">Reject</button></div></div>)}</div>
      </div>
    </section>
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-3xl border border-white/10 bg-white/[.06] p-5"><h2 className="text-xl font-black">Friends</h2><div className="mt-4 space-y-2">{friends.map(f=><div key={f.userId} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-3"><div><b>{f.displayName}</b><div className="text-xs text-slate-400">@{f.username} · {f.online?"Online":"Offline"}{f.inGame?" · In game":""}</div></div><div className="flex gap-2"><button onClick={()=>remove(f.userId)} className="rounded-lg bg-white/10 px-3 py-2 text-sm">Remove</button><button onClick={()=>block(f.userId)} className="rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-200">Block</button></div></div>)}{!friends.length&&<p className="text-sm text-slate-500">No friends yet.</p>}</div></div>
      <div className="rounded-3xl border border-white/10 bg-white/[.06] p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Notifications</h2>{unread>0&&<button onClick={markAll} className="text-sm text-sky-300">Mark all read</button>}</div><div className="mt-4 space-y-2">{notifications.map(n=><div key={n.id} className={"rounded-2xl border border-white/10 p-3 "+(n.readAt?"bg-black/10":"bg-sky-400/10")}><b>{n.title}</b><div className="mt-1 text-sm text-slate-300">{n.body}</div></div>)}{!notifications.length&&<p className="text-sm text-slate-500">No notifications.</p>}</div></div>
    </section>
    {message&&<div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-200">{message}</div>}
  </div></main>;
}
