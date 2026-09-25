import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, requireJsonObject } from "@/lib/http";
import { listFriends, sendFriendRequest } from "@/server/social-store";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  return NextResponse.json({ friends: await listFriends(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    const body = requireJsonObject(await request.json());
    await sendFriendRequest(user.id, String(body.userId ?? ""));
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to send request.", 400);
  }
}
