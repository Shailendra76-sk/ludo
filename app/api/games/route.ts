import { NextResponse } from "next/server";
import { createInitialState } from "@/game-engine/ludo-engine";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, requireJsonObject } from "@/lib/http";
import { persistNewGame, validateConfig } from "@/server/game-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  try {
    const body = requireJsonObject(await request.json());
    const config = validateConfig(body.config ?? { playerCount: 4 });
    const state = createInitialState(config.playerCount, config, { userId: user.id, name: user.username });
    await persistNewGame(state);
    return NextResponse.json({ game: state }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to create game.", 400);
  }
}
