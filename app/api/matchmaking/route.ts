import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, requireJsonObject } from "@/lib/http";
import { cancelMatch, getMatchStatus, queueForMatch } from "@/server/matchmaking-store";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  return NextResponse.json(await getMatchStatus(user.id));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  try {
    const body = requireJsonObject(await request.json());
    const count = Number(body.playerCount);
    if (count !== 2 && count !== 3 && count !== 4) return jsonError("playerCount must be 2, 3 or 4.", 400);
    const result = await queueForMatch(user.id, count);
    return NextResponse.json(result, { status: result.roomId ? 201 : 202 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to join matchmaking.", 400);
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  await cancelMatch(user.id);
  return NextResponse.json({ ok: true });
}
