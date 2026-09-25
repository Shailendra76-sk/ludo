import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getGameHistory } from "@/server/stats-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  return NextResponse.json({ history: await getGameHistory(user.id, limit) });
}
