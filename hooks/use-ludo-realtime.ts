"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

type Props = {
  roomId: string;
  onEvent?: (event: Record<string, unknown>) => void;
};

export function useLudoRealtime({ roomId, onEvent }: Props) {
  const callback = useRef(onEvent);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");

  useEffect(() => {
    callback.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!roomId) return;

    const url = process.env.NEXT_PUBLIC_REALTIME_URL;
    if (!url) {
      setStatus("error");
      return;
    }

    let socket: Socket | null = null;
    let cancelled = false;

    setStatus("connecting");

    fetch("/api/realtime/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId }),
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Realtime ticket request failed.");
        return body as { ticket: string };
      })
      .then(({ ticket }) => {
        if (cancelled) return;
        socket = io(url, {
          transports: ["websocket", "polling"],
          auth: { ticket },
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 500,
          reconnectionDelayMax: 5000,
        });

        socket.on("connect", () => setStatus("connected"));
        socket.on("disconnect", () => setStatus("connecting"));
        socket.on("connect_error", async () => {
          setStatus("error");
          try {
            const response = await fetch("/api/realtime/ticket", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ roomId }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok || !body.ticket || !socket) return;
            socket.auth = { ticket: body.ticket };
            socket.connect();
          } catch {
            // The normal Socket.IO reconnect loop remains active.
          }
        });
        socket.on("realtime:event", (event) => callback.current?.(event));
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [roomId]);

  return { status };
}
