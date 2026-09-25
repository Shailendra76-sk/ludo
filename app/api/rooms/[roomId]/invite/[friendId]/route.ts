import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getDb } from "@/db/client";
import { publishRealtimeEvent } from "@/server/realtime-pubsub";

export const runtime = "nodejs";

export async function POST(_: Request, context: { params: Promise<{ roomId: string; friendId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  try {
    const { roomId, friendId } = await context.params;
    if (!friendId || friendId === user.id) return jsonError("Invalid friend.", 400);

    const membership = await getDb().query(
      "SELECT 1 FROM room_players WHERE room_id=$1 AND user_id=$2 LIMIT 1",
      [roomId, user.id],
    );
    if (!membership.rowCount) return jsonError("You are not a member of this room.", 403);

    const friendship = await getDb().query(
      "SELECT 1 FROM friendships WHERE user_id=$1 AND friend_id=$2 LIMIT 1",
      [user.id, friendId],
    );
    if (!friendship.rowCount) return jsonError("You can only invite friends.", 403);

    const room = await getDb().query(
      "SELECT id,code,status,game_id FROM rooms WHERE id=$1 LIMIT 1",
      [roomId],
    );
    if (!room.rowCount || room.rows[0].status === "closed") return jsonError("Room is unavailable.", 400);

    await getDb().query(
      "INSERT INTO notifications(user_id,type,title,body,data) VALUES($1,'room_invite','Room invitation',$2,$3)",
      [
        friendId,
        user.username + " invited you to Ludo room " + room.rows[0].code + ".",
        JSON.stringify({ roomId, gameId: room.rows[0].game_id, roomCode: room.rows[0].code }),
      ],
    );

    await publishRealtimeEvent({
      kind: "room",
      type: "ROOM_INVITE_CREATED",
      roomId,
      gameId: room.rows[0].game_id,
      targetUserId: friendId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to send invite.", 400);
  }
}
