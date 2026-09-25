import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, requireJsonObject } from "@/lib/http";
import { moveToken } from "@/game-engine/ludo-engine";
import { transactGame } from "@/server/game-store";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ gameId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  try {
    const body = requireJsonObject(await request.json());
    const actionId = String(body.actionId ?? "");
    const tokenId = Number(body.tokenId);
    if (!actionId || !Number.isInteger(tokenId) || tokenId < 0 || tokenId > 3) return jsonError("Invalid action.", 400);
    const { gameId } = await context.params;

    const state = await transactGame(gameId, actionId, user.id, "TOKEN_MOVED", (current) => ({
      state: moveToken(current, tokenId),
      payload: { tokenId },
    }));
    return NextResponse.json({ game: state });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to move token.", 400);
  }
}
