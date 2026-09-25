import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, requireJsonObject } from "@/lib/http";
import { applyDice } from "@/game-engine/ludo-engine";
import { transactGame } from "@/server/game-store";
import { secureServerDice } from "@/server/random";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ gameId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  try {
    const body = requireJsonObject(await request.json());
    const actionId = String(body.actionId ?? "");
    if (!actionId) return jsonError("actionId is required.", 400);
    const { gameId } = await context.params;

    const state = await transactGame(gameId, actionId, user.id, "DICE_ROLLED", (current) => {
      const currentPlayer = current.players[current.currentPlayerIndex];
      if (!currentPlayer || currentPlayer.userId !== user.id) throw new Error("You are not the current player.");
      const dice = secureServerDice();
      const next = applyDice(current, dice);
      if (next === current) throw new Error("Unable to roll dice.");
      return { state: next, payload: { dice } };
    });
    return NextResponse.json({ game: state });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to roll dice.", 400);
  }
}
