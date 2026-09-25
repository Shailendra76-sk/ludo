import { createServer } from "node:http";
import { createClient } from "redis";
import { Server } from "socket.io";
import { CHANNEL } from "@/server/realtime-pubsub";
import { verifyRealtimeTicket } from "@/lib/realtime-ticket";
import { getDb } from "@/db/client";

const port = Number(process.env.REALTIME_PORT ?? 3001);
const origin = process.env.REALTIME_CORS_ORIGIN ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const redisUrl = process.env.REDIS_URL;

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required for realtime server.");
}
if (!redisUrl) {
  throw new Error("REDIS_URL is required for realtime server.");
}

const httpServer = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "ludo-realtime" }));
    return;
  }
  response.writeHead(404);
  response.end();
});

const io = new Server(httpServer, {
  cors: {
    origin,
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

io.use(async (socket, next) => {
  try {
    const ticket = typeof socket.handshake.auth?.ticket === "string" ? socket.handshake.auth.ticket : "";
    const verified = verifyRealtimeTicket(ticket);
    if (!verified) return next(new Error("Invalid or expired realtime ticket."));

    const member = await getDb().query(
      "SELECT 1 FROM room_players WHERE room_id=$1 AND user_id=$2 LIMIT 1",
      [verified.roomId, verified.userId],
    );
    if (!member.rowCount) return next(new Error("You are not a member of this room."));

    socket.data.userId = verified.userId;
    socket.data.roomId = verified.roomId;
    return next();
  } catch {
    return next(new Error("Realtime authentication failed."));
  }
});

io.on("connection", (socket) => {
  const roomId = socket.data.roomId as string;
  socket.join("room:" + roomId);
  socket.emit("realtime:connected", { roomId });
  socket.on("room:ping", () => socket.emit("room:pong", { at: Date.now() }));
});

const subscriber = createClient({ url: redisUrl });
subscriber.on("error", (error) => console.error("[realtime] redis error", error));

await subscriber.connect();
await subscriber.subscribe(CHANNEL, (raw) => {
  try {
    const event = JSON.parse(raw) as { roomId?: string; kind?: string };
    if (!event.roomId) return;
    io.to("room:" + event.roomId).emit("realtime:event", event);
  } catch {
    // Ignore malformed pub/sub messages.
  }
});

httpServer.listen(port, () => {
  console.log("Ludo realtime server listening on port " + port);
});
