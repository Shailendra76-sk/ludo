import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getRoom } from "@/server/room-store";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ roomId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  try {
    const { roomId } = await context.params;
    const data = await getRoom(roomId);
    if (!data) return jsonError("Room not found.", 404);
    if (!data.players.some((player) => player.userId === user.id)) {
      return jsonError("You are not a member of this room.", 403);
    }
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to load room.", 400);
  }
}
