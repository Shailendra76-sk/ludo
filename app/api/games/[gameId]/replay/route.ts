import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getReplay } from "@/server/replay-store";
import { buildReplayFrames } from "@/lib/replay";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ gameId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    const { gameId } = await context.params;
    const events = await getReplay(gameId, user.id);
    return NextResponse.json({ frames: buildReplayFrames(events) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to load replay.", 403);
  }
}
