import { getDb } from "@/db/client";
import { publishRealtimeEvent } from "@/server/realtime-pubsub";
import type { ChatMessage } from "@/lib/types";

const MAX_BODY = 500;
const MAX_PER_MINUTE = 30;

export async function assertRoomMember(roomId: string, userId: string) {
  const result = await getDb().query(
    "SELECT 1 FROM room_players WHERE room_id=$1 AND user_id=$2 LIMIT 1",
    [roomId, userId],
  );
  if (!result.rowCount) throw new Error("You are not a member of this room.");
}

export async function listChatMessages(roomId: string, userId: string, limit = 50): Promise<ChatMessage[]> {
  await assertRoomMember(roomId, userId);
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const result = await getDb().query(
    `SELECT cm.id,cm.room_id,cm.user_id,u.username,cm.body,cm.created_at
     FROM chat_messages cm JOIN users u ON u.id=cm.user_id
     WHERE cm.room_id=$1
     ORDER BY cm.id DESC LIMIT $2`,
    [roomId, safeLimit],
  );
  return result.rows.reverse().map((row) => ({
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    username: row.username,
    body: row.body,
    createdAt: row.created_at,
  }));
}

export async function sendChatMessage(roomId: string, userId: string, body: string) {
  await assertRoomMember(roomId, userId);
  const text = body.trim();
  if (text.length < 1 || text.length > MAX_BODY) throw new Error("Message must be 1–500 characters.");

  const recent = await getDb().query(
    "SELECT COUNT(*)::int AS count FROM chat_messages WHERE room_id=$1 AND user_id=$2 AND created_at>now()-interval '1 minute'",
    [roomId, userId],
  );
  if (recent.rows[0].count >= MAX_PER_MINUTE) throw new Error("Chat rate limit reached. Try again shortly.");

  const result = await getDb().query(
    "INSERT INTO chat_messages(room_id,user_id,body) VALUES($1,$2,$3) RETURNING id,room_id,user_id,created_at",
    [roomId, userId, text],
  );
  const row = result.rows[0];
  const user = await getDb().query("SELECT username FROM users WHERE id=$1", [userId]);
  const message: ChatMessage = {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    username: user.rows[0].username,
    body: text,
    createdAt: row.created_at,
  };

  await publishRealtimeEvent({
    kind: "chat",
    type: "CHAT_MESSAGE",
    roomId,
    message,
  });

  return message;
}
