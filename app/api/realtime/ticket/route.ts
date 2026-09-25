import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, requireJsonObject } from "@/lib/http";
import { getRoom } from "@/server/room-store";
import { issueRealtimeTicket } from "@/lib/realtime-ticket";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  try {
    const body = requireJsonObject(await request.json());
    const roomId = String(body.roomId ?? "");
    if (!roomId) return jsonError("roomId is required.", 400);

    const data = await getRoom(roomId);
    if (!data) return jsonError("Room not found.", 404);
    if (!data.players.some((player) => player.userId === user.id)) {
      return jsonError("You are not a member of this room.", 403);
    }

    const ticket = issueRealtimeTicket(user.id, roomId);
    return NextResponse.json({
      ticket,
      realtimeUrl: process.env.NEXT_PUBLIC_REALTIME_URL ?? null,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to issue realtime ticket.", 400);
  }
}
