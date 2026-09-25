"use client";

import { useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/types";
import { explainVoiceIntent, parseVoiceCommand, type VoiceIntent } from "@/lib/voice-command";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onstart?: () => void;
  onend?: () => void;
  onerror?: (event: { error?: string }) => void;
  onresult?: (event: {
    resultIndex: number;
    results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
  }) => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export default function VoiceCommand({ gameId, state, enabled = true, onGame }: {
  gameId: string;
  state: GameState;
  enabled?: boolean;
  onGame: (game: GameState) => void;
}) {
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("Tap mic and speak.");
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      setStatus("Voice input is not supported in this browser.");
      return;
    }

    const instance = new Ctor();
    instance.continuous = false;
    instance.interimResults = true;
    instance.lang = typeof navigator.language === "string" && navigator.language.toLowerCase().startsWith("en") ? "en-IN" : "hi-IN";
    instance.onstart = () => {
      setListening(true);
      setStatus("Listening… say “six”, “roll dice”, or “token two”.");
    };
    instance.onend = () => setListening(false);
    instance.onerror = () => {
      setListening(false);
      setStatus("Voice input failed. Try again.");
    };
    instance.onresult = async (event) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const value = event.results[i];
        if (value.isFinal) finalText += value[0].transcript;
      }
      if (!finalText) return;
      setTranscript(finalText);

      const intent: VoiceIntent | null = parseVoiceCommand(finalText, state);
      if (!intent) {
        setStatus("Command not understood.");
        return;
      }

      setStatus(explainVoiceIntent(intent));
      try {
        const response = await fetch("/api/games/" + gameId + "/voice-command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionId: crypto.randomUUID(), intent }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Voice action failed.");
        onGame(body.game as GameState);
        setStatus(intent.type === "roll" ? "Dice rolled by voice." : "Token moved by voice.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Voice action failed.");
      }
    };
    recognition.current = instance;
    return () => {
      instance.stop();
      recognition.current = null;
    };
  }, [gameId, onGame, state]);

  if (!enabled) return null;

  function toggle() {
    if (!supported || !recognition.current) return;
    if (listening) {
      recognition.current.stop();
      return;
    }
    setTranscript("");
    try {
      recognition.current.start();
    } catch {
      setStatus("Microphone is already active.");
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Voice control</div>
          <div className="mt-1 text-sm text-slate-200">{status}</div>
        </div>
        <button
          onClick={toggle}
          disabled={!supported}
          aria-label={listening ? "Stop voice input" : "Start voice input"}
          className={"grid h-12 w-12 place-items-center rounded-full text-xl font-black " + (listening ? "bg-red-400 text-white" : "bg-white text-slate-900") + " disabled:opacity-40"}
        >
          {listening ? "■" : "🎙️"}
        </button>
      </div>
      {transcript && <div className="mt-3 rounded-xl bg-white/[.05] p-3 text-sm text-slate-300">Heard: “{transcript}”</div>}
      <div className="mt-2 text-[11px] text-slate-500">Voice only creates predefined game actions; the server validates every action.</div>
    </div>
  );
}
