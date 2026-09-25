import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, requireJsonObject } from "@/lib/http";
import { joinRoom } from "@/server/room-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  try {
    const body = requireJsonObject(await request.json());
    const code = String(body.code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return jsonError("Room code must be 6 characters.", 400);
    const roomId = await joinRoom(code, user.id);
    return NextResponse.json({ roomId });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to join room.", 400);
  }
}
