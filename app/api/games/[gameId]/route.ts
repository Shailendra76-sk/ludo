import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { readGame } from "@/server/game-store";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ gameId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { gameId } = await context.params;
  const game = await readGame(gameId);
  if (!game) return jsonError("Game not found.", 404);
  const players = Array.isArray(game.state?.players) ? game.state.players : [];
  if (!players.some((player: { userId?: string | null }) => player.userId === user.id)) {
    return jsonError("You are not a member of this game.", 403);
  }
  return NextResponse.json({ game: game.state, roomId: game.room_id ?? null });
}
