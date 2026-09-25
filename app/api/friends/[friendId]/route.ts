import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { removeFriend, blockUser } from "@/server/social-store";

export const runtime = "nodejs";

export async function DELETE(_: Request, context: { params: Promise<{ friendId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { friendId } = await context.params;
  await removeFriend(user.id, friendId);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, context: { params: Promise<{ friendId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    const { friendId } = await context.params;
    await blockUser(user.id, friendId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to block player.", 400);
  }
}
