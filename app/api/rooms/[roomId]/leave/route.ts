import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { leaveRoom } from "@/server/room-store";

export const runtime = "nodejs";

export async function POST(_: Request, context: { params: Promise<{ roomId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  try {
    const { roomId } = await context.params;
    await leaveRoom(roomId, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to leave room.", 400);
  }
}
