import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, requireJsonObject } from "@/lib/http";
import { setReady } from "@/server/room-store";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  try {
    const body = requireJsonObject(await request.json());
    const ready = Boolean(body.ready);
    const { roomId } = await context.params;
    await setReady(roomId, user.id, ready);
    return NextResponse.json({ ok: true, ready });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to change ready state.", 400);
  }
}
