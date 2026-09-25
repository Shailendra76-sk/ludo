import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, requireJsonObject } from "@/lib/http";
import { applyDice, getCurrentPlayer, getLegalMoves, moveToken } from "@/game-engine/ludo-engine";
import { transactGame } from "@/server/game-store";
import { secureServerDice } from "@/server/random";
import { chooseBotToken } from "@/server/bot-ai";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ gameId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  try {
    const body = requireJsonObject(await request.json());
    const actionId = String(body.actionId ?? "");
    if (!actionId) return jsonError("actionId is required.", 400);
    const { gameId } = await context.params;

    const state = await transactGame(gameId, actionId, user.id, "BOT_TURN", (current) => {
      const bot = getCurrentPlayer(current);
      if (!bot?.isBot) throw new Error("It is not a bot turn.");

      const dice = secureServerDice();
      const rolled = applyDice(current, dice);
      if (rolled.currentPlayerIndex !== current.currentPlayerIndex && rolled.dice === null) {
        return { state: rolled, payload: { botId: bot.id, dice, tokenId: null } };
      }

      const legal = getLegalMoves(rolled);
      if (legal.length === 0) {
        return { state: rolled, payload: { botId: bot.id, dice, tokenId: null } };
      }

      const tokenId = chooseBotToken(rolled);
      if (tokenId === null) throw new Error("Bot could not choose a legal move.");

      const moved = moveToken(rolled, tokenId);
      return { state: moved, payload: { botId: bot.id, dice, tokenId } };
    });

    return NextResponse.json({ game: state });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to execute bot turn.", 400);
  }
}
