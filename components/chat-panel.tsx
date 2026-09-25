"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { useLudoRealtime } from "@/hooks/use-ludo-realtime";

export default function ChatPanel({ roomId }: { roomId: string }) {
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [body,setBody]=useState("");
  const [error,setError]=useState("");
  const endRef=useRef<HTMLDivElement|null>(null);

  async function load() {
    const r=await fetch("/api/rooms/"+roomId+"/chat");
    const b=await r.json();
    if(!r.ok) throw new Error(b.error??"Unable to load chat.");
    setMessages(b.messages??[]);
  }

  const {status}=useLudoRealtime({roomId,onEvent:event=>{
    if(event.kind==="chat" && event.type==="CHAT_MESSAGE" && event.message){
      setMessages(prev=>{
        const incoming=event.message as ChatMessage;
        if(prev.some(m=>m.id===incoming.id)) return prev;
        return [...prev,incoming].slice(-100);
      });
    }
  }});

  useEffect(()=>{load().catch(e=>setError(e instanceof Error?e.message:"Unable to load chat."));},[roomId]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[messages.length]);

  async function send() {
    const text=body.trim();
    if(!text)return;
    try {
      const r=await fetch("/api/rooms/"+roomId+"/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:text})});
      const b=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(b.error??"Unable to send message.");
      setMessages(prev=>prev.some(m=>m.id===b.message.id)?prev:[...prev,b.message].slice(-100));
      setBody("");
      setError("");
    } catch(e) { setError(e instanceof Error?e.message:"Unable to send message."); }
  }

  return <div className="rounded-3xl border border-white/10 bg-white/[.06] p-4"><div className="flex items-center justify-between"><h2 className="font-black">Chat</h2><span className="text-xs text-slate-400">{status}</span></div><div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-2xl bg-black/20 p-3">{messages.map(m=><div key={m.id}><b className="text-sm">{m.username}</b><div className="text-sm text-slate-300">{m.body}</div></div>)}<div ref={endRef}/></div><div className="mt-3 flex gap-2"><input value={body} maxLength={500} onChange={e=>setBody(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Write a message…" className="min-w-0 flex-1 rounded-xl bg-slate-900 px-3 py-3"/><button onClick={send} className="rounded-xl bg-white px-4 py-3 font-black text-slate-900">Send</button></div>{error&&<p className="mt-2 text-xs text-amber-300">{error}</p>}</div>;
}
