import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, rateLimit, clientAddress, requireJsonObject } from "@/lib/http";
import { applyDice, moveToken } from "@/game-engine/ludo-engine";
import { transactGame } from "@/server/game-store";
import { secureServerDice } from "@/server/random";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ gameId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!rateLimit("voice:" + clientAddress(request) + ":" + user.id, 40, 60_000)) {
    return jsonError("Too many voice commands. Try again later.", 429);
  }

  try {
    const body = requireJsonObject(await request.json());
    const actionId = String(body.actionId ?? "");
    const intent = body.intent;
    if (!actionId || !intent || typeof intent !== "object" || Array.isArray(intent)) {
      return jsonError("Invalid voice action.", 400);
    }

    const { gameId } = await context.params;
    const state = await transactGame(gameId, actionId, user.id, "VOICE_COMMAND", (current) => {
      const currentPlayer = current.players[current.currentPlayerIndex];
      if (!currentPlayer || currentPlayer.userId !== user.id) {
        throw new Error("You are not the current player.");
      }

      const input = intent as Record<string, unknown>;
      if (input.type === "roll") {
        // The spoken number is never trusted as a dice result.
        const dice = secureServerDice();
        const next = applyDice(current, dice);
        return { state: next, payload: { command: "roll", dice } };
      }

      if (input.type === "move") {
        const tokenId = Number(input.tokenId);
        if (!Number.isInteger(tokenId) || tokenId < 0 || tokenId > 3) {
          throw new Error("Invalid token command.");
        }
        const next = moveToken(current, tokenId);
        if (next === current || next.message.startsWith("Invalid move.")) {
          throw new Error("Invalid token move.");
        }
        return { state: next, payload: { command: "move", tokenId } };
      }

      throw new Error("Unsupported voice command.");
    });

    return NextResponse.json({ game: state });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Voice action failed.", 400);
  }
}
