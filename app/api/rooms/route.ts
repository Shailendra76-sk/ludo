import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, requireJsonObject } from "@/lib/http";
import { validateConfig } from "@/server/game-store";
import { createRoom } from "@/server/room-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  try {
    const body = requireJsonObject(await request.json());
    const config = validateConfig(body.config ?? { playerCount: 4 });
    const visibility = body.visibility === "public" ? "public" : "private";
    const room = await createRoom(user.id, config, visibility);
    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to create room.", 400);
  }
}
